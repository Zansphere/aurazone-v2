import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, "../../.env.test") });
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

export const envConfig = {
  env: process.env.TEST_ENV || "local",
  
  // Base Service URLs
  apiUrl: process.env.TEST_API_URL || `http://localhost:${process.env.PORT || 4000}/api/v1`,
  webUrl: process.env.TEST_WEB_URL || process.env.CUSTOMER_URL || "http://localhost:3000",
  adminWebUrl: process.env.TEST_ADMIN_URL || process.env.ADMIN_URL || "http://localhost:3001",

  // Authentication secrets
  jwtSecret: process.env.JWT_SECRET || process.env.ACCESS_TOKEN_SECRET || "dev-jwt-secret-change-in-production-aurazone-v2",

  // Test credentials (matching seeded database records)
  users: {
    superAdmin: {
      email: process.env.TEST_ADMIN_EMAIL || "admin@aurazone.com",
      password: process.env.TEST_ADMIN_PASSWORD || "Admin@123",
      role: "SUPER_ADMIN",
    },
    storeManager: {
      email: process.env.TEST_MANAGER_EMAIL || "manager@aurazone.com",
      password: process.env.TEST_MANAGER_PASSWORD || "Admin@123",
      role: "STORE_MANAGER",
    },
    customer: {
      email: process.env.TEST_CUSTOMER_EMAIL || "arjun.patel@example.com",
      password: process.env.TEST_CUSTOMER_PASSWORD || "Customer@123",
      role: "CUSTOMER",
    },
  },

  // Mobile App Automation (Flutter Android)
  mobile: {
    appiumHost: process.env.APPIUM_HOST || "127.0.0.1",
    appiumPort: parseInt(process.env.APPIUM_PORT || "4723", 10),
    platformName: "Android",
    automationName: "UiAutomator2",
    deviceName: process.env.ANDROID_DEVICE_NAME || "Android Emulator",
    appPath: process.env.ANDROID_APK_PATH || path.resolve(__dirname, "../../fixtures/apps/app-debug.apk"),
    appPackage: process.env.ANDROID_APP_PACKAGE || "com.zansphere.aurazone_admin",
    appActivity: process.env.ANDROID_APP_ACTIVITY || "com.zansphere.aurazone_admin.MainActivity",
    noReset: false,
    newCommandTimeout: 60,
  },

  // Sheet Fixtures Paths
  sheets: {
    suite800: path.resolve(__dirname, "../../fixtures/sheets/AuraZone_V2_Test_Suite_800.xlsx"),
    roleBasedApi: path.resolve(__dirname, "../../fixtures/sheets/AuraZone_V2_Role_Based_API_Test_Cases.xlsx"),
    databaseTesting: path.resolve(__dirname, "../../fixtures/sheets/AuraZone_V2_Database_Testing_Sheet.xlsx"),
  },
};

