import path from "path";
import jwt from "jsonwebtoken";
import newman from "newman";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env.test") });

const jwtSecret = process.env.JWT_SECRET || "dev-jwt-secret-min-32-chars-long-aurazone-2026";
const apiUrl = process.env.API_URL || "http://localhost:4000/api/v1";

const adminToken = jwt.sign(
  {
    userId: "4beca3a6-04c0-4b93-9514-1d5a7b922c46",
    email: "admin@aurazone.com",
    role: "SUPER_ADMIN",
  },
  jwtSecret,
  { expiresIn: "24h" }
);

const customerToken = jwt.sign(
  {
    userId: "b1c76037-cd4a-42f7-82d7-1d66f60d5aba",
    email: "arjun.patel@example.com",
    role: "CUSTOMER",
  },
  jwtSecret,
  { expiresIn: "24h" }
);

const collectionPath = path.resolve(__dirname, "../../fixtures/AuraZone_Admin_API_14_Modules_Collection.json");

console.log("[Newman Runner] Starting Newman execution of 14 Admin Modules Collection...");
console.log(`[Newman Runner] Target Base URL: ${apiUrl}`);

newman.run(
  {
    collection: collectionPath,
    reporters: "cli",
    envVar: [
      { key: "baseUrl", value: apiUrl },
      { key: "adminToken", value: adminToken },
      { key: "customerToken", value: customerToken },
    ],
  },
  function (err, summary) {
    if (err) {
      console.error("[Newman Runner] Error:", err);
      process.exit(1);
    }
    const failures = summary.run.failures.length;
    console.log(`[Newman Runner] Completed. Total requests: ${summary.run.stats.requests.total}, Failures: ${failures}`);
    process.exit(failures > 0 ? 1 : 0);
  }
);

