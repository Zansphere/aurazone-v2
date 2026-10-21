import path from "path";
import dotenv from "dotenv";

// Load .env whether started from apps/api or repo root
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

export const env = {
  // Server
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: Number(process.env.PORT ?? 4000),
  HOST: process.env.HOST ?? "0.0.0.0",

  // Database
  DATABASE_URL: process.env.DATABASE_URL ?? "",

  // Redis
  REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",

  // JWT
  JWT_SECRET: process.env.JWT_SECRET ?? process.env.ACCESS_TOKEN_SECRET ?? "dev-jwt-secret-change-in-production",
  ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET ?? process.env.JWT_SECRET ?? "dev-jwt-secret-change-in-production",
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET ?? process.env.JWT_SECRET ?? "dev-jwt-secret-change-in-production",
  JWT_ACCESS_EXPIRES: process.env.JWT_ACCESS_EXPIRES ?? "15m",
  JWT_REFRESH_EXPIRES: process.env.JWT_REFRESH_EXPIRES ?? "7d",

  // Cookies
  COOKIE_SECRET: process.env.COOKIE_SECRET ?? "dev-cookie-secret-change-in-production",
  COOKIE_DOMAIN: process.env.COOKIE_DOMAIN ?? "localhost",
  COOKIE_SECURE: process.env.NODE_ENV === "production",

  // S3
  S3_BUCKET: process.env.AWS_S3_BUCKET ?? process.env.S3_BUCKET ?? "",
  S3_REGION: process.env.AWS_REGION ?? process.env.S3_REGION ?? "ap-south-1",
  S3_ACCESS_KEY: process.env.AWS_ACCESS_KEY_ID ?? process.env.S3_ACCESS_KEY ?? "",
  S3_SECRET_KEY: process.env.AWS_SECRET_ACCESS_KEY ?? process.env.S3_SECRET_KEY ?? "",

  // Email (SMTP)
  SMTP_HOST: process.env.SMTP_HOST ?? "",
  SMTP_PORT: Number(process.env.SMTP_PORT ?? 587),
  SMTP_USER: process.env.SMTP_USER ?? "",
  SMTP_PASS: process.env.SMTP_PASS ?? "",
  SMTP_FROM: process.env.SMTP_FROM ?? "noreply@aurazone.com",

  // Razorpay
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID ?? "",
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET ?? "",
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET ?? "",

  // Frontend URLs (for CORS, emails)
  CUSTOMER_URL: process.env.CUSTOMER_URL ?? "http://localhost:3000",
  ADMIN_URL: process.env.ADMIN_URL ?? "http://localhost:3001",
} as const;

export type Env = typeof env;

// ─── Production fail-fast ────────────────────────────────────────────────────
// In production, all critical secrets MUST be explicitly provided.
if (env.NODE_ENV === "production") {
  const required: Array<[string, string]> = [
    ["DATABASE_URL", env.DATABASE_URL],
    ["JWT_SECRET", env.JWT_SECRET],
    ["COOKIE_SECRET", env.COOKIE_SECRET],
    ["RAZORPAY_KEY_ID", env.RAZORPAY_KEY_ID],
    ["RAZORPAY_KEY_SECRET", env.RAZORPAY_KEY_SECRET],
    ["RAZORPAY_WEBHOOK_SECRET", env.RAZORPAY_WEBHOOK_SECRET],
  ];

  const insecureDefaults = [
    "dev-jwt-secret-change-in-production",
    "dev-cookie-secret-change-in-production",
  ];

  for (const [name, value] of required) {
    if (!value || insecureDefaults.includes(value)) {
      console.error(`FATAL: Environment variable ${name} is missing or set to an insecure default.`);
      process.exit(1);
    }
  }
}

// Security check: Warn if using superuser/owner role for application connection
if (env.DATABASE_URL.includes("neondb_owner") || env.DATABASE_URL.includes("postgres:postgres")) {
  console.warn(
    "[SECURITY WARNING] Database connection URL appears to use an administrative/owner role (e.g., 'neondb_owner'). " +
    "For production defense-in-depth, configure a dedicated application role with least-privilege (DML only, no DDL/DROP) permissions."
  );
}