import { Queue, Worker, Job } from 'bullmq';
import nodemailer from 'nodemailer';
import { Redis } from 'ioredis';
import { env } from '../config/env.js';

// Configure Nodemailer
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: Number(process.env.SMTP_PORT) || 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

// Connection for BullMQ
const redisConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

// Queue for emails
export const emailQueue = new Queue<EmailPayload>('emailQueue', {
  connection: redisConnection,
});

// Worker to process emails
export const emailWorker = new Worker<EmailPayload>(
  'emailQueue',
  async (job: Job<EmailPayload>) => {
    try {
      const { to, subject, html } = job.data;
      const info = await transporter.sendMail({
        from: `"AuraZone" <${process.env.SMTP_FROM || 'noreply@aurazone.com'}>`,
        to,
        subject,
        html,
      });
      console.log(`Email sent to ${to}: ${info.messageId}`);
    } catch (error) {
      console.error(`Failed to send email to ${job.data.to}`, error);
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
  }
);

emailWorker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed with error ${err.message}`);
});

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
    await emailQueue.add('orderConfirmation', {
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
    await emailQueue.add('orderStatusUpdate', {
      to: email,
      subject: `Order Update: #${orderNumber} is ${status} | AuraZone`,
      html: createEmailWrapper(
        `Order Update #${orderNumber}`,
        `
          <h1 class="h1">Order Status Update</h1>
          <p>Your order <span class="badge">#${orderNumber}</span> status has been updated to:</p>
          <div style="background: #ecfdf5; border: 1px solid #a7f3d0; padding: 16px; border-radius: 10px; margin: 20px 0; text-align: center;">
            <p style="margin: 0; font-size: 18px; font-weight: 700; color: #065f46;">${status}</p>
          </div>
          <a href="${env.CUSTOMER_URL}/orders" class="btn">Track Order Progress</a>
        `
      ),
    });
  },

  async sendPasswordResetEmail(email: string, resetUrl: string) {
    await emailQueue.add('passwordReset', {
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
    await emailQueue.add('emailVerification', {
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
    await emailQueue.add('contactForm', {
      to: process.env.SMTP_FROM || 'support@aurazone.com',
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