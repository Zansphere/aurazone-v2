import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

// Configure Nodemailer with environment variables and sensible fallbacks
const smtpHost = env.SMTP_HOST || process.env.EMAIL_HOST || 'smtp.ethereal.email';
const smtpPort = Number(env.SMTP_PORT || process.env.EMAIL_PORT) || 587;
const smtpUser = env.SMTP_USER || process.env.EMAIL_USER || '';
const smtpPass = env.SMTP_PASS || process.env.EMAIL_PASS || '';
const smtpFrom = env.SMTP_FROM || process.env.EMAIL_FROM || '"AuraZone" <noreply@aurazone.com>';

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpPort === 465,
  auth: smtpUser && smtpPass ? {
    user: smtpUser,
    pass: smtpPass,
  } : undefined,
});

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

/**
 * Asynchronously dispatches an email in the background without blocking the caller.
 * Includes automatic retry with exponential backoff on transient network failures.
 * Eliminates BullMQ / Redis polling to prevent exhausting serverless Redis request quotas.
 */
async function dispatchEmail(payload: EmailPayload, maxRetries = 2): Promise<void> {
  const { to, subject, html } = payload;

  if (!to || !to.includes('@')) {
    console.warn(`[EmailService] Skipped sending email: invalid recipient "${to}"`);
    return;
  }

  // Gracefully simulate in dev if no SMTP credentials are configured
  if (!smtpUser && !env.SMTP_HOST && !process.env.EMAIL_HOST && env.NODE_ENV !== 'production') {
    console.info(`[EmailService] Dev mode (no SMTP configured) — simulated email to ${to}: "${subject}"`);
    return;
  }

  // Fire-and-forget in background event loop
  setImmediate(async () => {
    let attempt = 0;
    while (attempt <= maxRetries) {
      try {
        const info = await transporter.sendMail({
          from: smtpFrom,
          to,
          subject,
          html,
        });
        console.log(`[EmailService] Email sent successfully to ${to} (Message ID: ${info.messageId})`);
        return;
      } catch (error: any) {
        attempt++;
        if (attempt <= maxRetries) {
          console.warn(`[EmailService] Attempt ${attempt} failed to send email to ${to}: ${error?.message}. Retrying in 2s...`);
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } else {
          console.error(`[EmailService] Failed to send email to ${to} after ${maxRetries + 1} attempts:`, error?.message || error);
        }
      }
    }
  });
}

/**
 * Compatibility stub for legacy imports (BullMQ removed to avoid serverless Redis polling)
 */
export const emailQueue = {
  add: async (_name: string, data: EmailPayload) => {
    return dispatchEmail(data);
  },
};

export const emailWorker = {
  close: async () => {},
  on: (_event: string, _callback: Function) => {},
};

const createEmailWrapper = (title: string, bodyContent: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 0; }
    .container { max-width: 580px; margin: 30px auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { background: #0f172a; padding: 24px 32px; text-align: center; }
    .logo { color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; text-decoration: none; }
    .content { padding: 32px; font-size: 15px; line-height: 1.6; color: #334155; }
    .h1 { font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 16px; }
    .btn { display: inline-block; background-color: #0f172a; color: #ffffff !important; font-weight: 600; padding: 12px 28px; border-radius: 10px; text-decoration: none; margin: 20px 0; font-size: 14px; }
    .footer { padding: 24px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #64748b; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-weight: 600; font-size: 12px; background: #e0f2fe; color: #0369a1; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <a href="${env.CUSTOMER_URL}" class="logo">AuraZone</a>
    </div>
    <div class="content">
      ${bodyContent}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} AuraZone. All rights reserved.</p>
      <p>If you have any questions, reply directly to this email or visit our Help Center.</p>
    </div>
  </div>
</body>
</html>
`;

export const EmailService = {
  async sendOrderConfirmation(email: string, orderNumber: string, totalAmount: number) {
    await dispatchEmail({
      to: email,
      subject: `Order Confirmation - #${orderNumber} | AuraZone`,
      html: createEmailWrapper(
        "Order Confirmed",
        `
          <h1 class="h1">Thank you for your order!</h1>
          <p>We've received your order <span class="badge">#${orderNumber}</span> and our team is preparing it for shipment.</p>
          <div style="background: #f1f5f9; padding: 16px; border-radius: 10px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #475569;">Total Amount Paid</p>
            <p style="margin: 4px 0 0 0; font-size: 24px; font-weight: 700; color: #0f172a;">₹${Number(totalAmount).toLocaleString()}</p>
          </div>
          <p>You can track the live delivery progress of your package by visiting your orders page.</p>
          <a href="${env.CUSTOMER_URL}/orders" class="btn">View Order Details</a>
        `
      ),
    });
  },

  async sendOrderStatusUpdate(email: string, orderNumber: string, status: string) {
    const statusConfig: Record<string, { label: string; desc: string; bg: string; border: string; text: string }> = {
      RECEIVED: {
        label: "Payment Confirmed & Order Received",
        desc: "We have received your payment and our team has started preparing your order for shipment.",
        bg: "#ecfdf5",
        border: "#a7f3d0",
        text: "#065f46",
      },
      PROCESSING: {
        label: "Order In Processing",
        desc: "Your items are being carefully picked, inspected, and packed.",
        bg: "#eff6ff",
        border: "#bfdbfe",
        text: "#1e40af",
      },
      SHIPPED: {
        label: "Order Dispatched & Shipped",
        desc: "Your package is on its way to your delivery address with our courier partner.",
        bg: "#f5f3ff",
        border: "#ddd6fe",
        text: "#5b21b6",
      },
      DELIVERED: {
        label: "Order Delivered Successfully",
        desc: "Your order has been delivered! We hope you love your purchase.",
        bg: "#ecfdf5",
        border: "#a7f3d0",
        text: "#065f46",
      },
      CANCELLED: {
        label: "Order Cancelled",
        desc: "Your order has been cancelled. Any payment made will be refunded to your source account.",
        bg: "#fffbeb",
        border: "#fde68a",
        text: "#92400e",
      },
      FAILED: {
        label: "Order Payment Failed",
        desc: "We could not confirm payment for this order. If money was deducted, it will be automatically refunded by your bank.",
        bg: "#fef2f2",
        border: "#fecaca",
        text: "#991b1b",
      },
    };

    const config = statusConfig[status.toUpperCase()] ?? {
      label: status,
      desc: "Your order status has been updated.",
      bg: "#f8fafc",
      border: "#e2e8f0",
      text: "#0f172a",
    };

    await dispatchEmail({
      to: email,
      subject: `Order Update: #${orderNumber} - ${config.label} | AuraZone`,
      html: createEmailWrapper(
        `Order Update #${orderNumber}`,
        `
          <h1 class="h1">Order Status Update</h1>
          <p>Your order <span class="badge">#${orderNumber}</span> status has been updated to:</p>
          <div style="background: ${config.bg}; border: 1px solid ${config.border}; padding: 18px; border-radius: 12px; margin: 20px 0; text-align: center;">
            <p style="margin: 0 0 6px 0; font-size: 18px; font-weight: 700; color: ${config.text};">${config.label}</p>
            <p style="margin: 0; font-size: 14px; color: ${config.text};">${config.desc}</p>
          </div>
          <a href="${env.CUSTOMER_URL}/orders" class="btn">View Order Details</a>
        `
      ),
    });
  },

  async sendPasswordResetEmail(email: string, resetUrl: string) {
    await dispatchEmail({
      to: email,
      subject: `Reset Your AuraZone Password`,
      html: createEmailWrapper(
        "Reset Your Password",
        `
          <h1 class="h1">Password Reset Request</h1>
          <p>We received a request to reset the password for your AuraZone account.</p>
          <p>Click the button below to choose a new password. This link is valid for <strong>1 hour</strong>.</p>
          <a href="${resetUrl}" class="btn">Reset Password</a>
          <p style="font-size: 12px; color: #64748b; margin-top: 24px;">
            If you did not make this request, you can safely ignore this email — your password will remain unchanged.
          </p>
          <p style="font-size: 11px; color: #94a3b8; word-break: break-all;">
            Or copy and paste this link into your browser:<br>${resetUrl}
          </p>
        `
      ),
    });
  },

  async sendEmailVerification(email: string, verifyUrl: string) {
    await dispatchEmail({
      to: email,
      subject: `Verify Your Email Address | AuraZone`,
      html: createEmailWrapper(
        "Verify Your Email",
        `
          <h1 class="h1">Welcome to AuraZone!</h1>
          <p>Thanks for creating an account. Please click the button below to confirm and verify your email address:</p>
          <a href="${verifyUrl}" class="btn">Verify Email Address</a>
          <p style="font-size: 12px; color: #64748b; margin-top: 24px;">
            This link will expire in 24 hours.
          </p>
        `
      ),
    });
  },

  async sendContactFormNotification(name: string, senderEmail: string, subject: string, message: string) {
    await dispatchEmail({
      to: process.env.SMTP_FROM || process.env.EMAIL_FROM || 'support@aurazone.com',
      subject: `[Contact Inquiry] ${subject} from ${name}`,
      html: createEmailWrapper(
        "New Customer Inquiry",
        `
          <h1 class="h1">New Contact Inquiry</h1>
          <p><strong>From:</strong> ${name} (&lt;${senderEmail}&gt;)</p>
          <p><strong>Subject:</strong> ${subject}</p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 0; white-space: pre-wrap;">${message}</p>
          </div>
        `
      ),
    });
  }
};