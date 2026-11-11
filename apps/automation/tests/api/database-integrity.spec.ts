import { test, expect } from "../../src/fixtures/test-fixtures.js";
import { loadDatabaseCases } from "../../src/utils/sheet-loader.js";

test.describe("Database Testing: Constraint & Schema Integrity", () => {
  const dbCases = loadDatabaseCases();

  test("Loads DB Test Cases from AuraZone_V2_Database_Testing_Sheet.xlsx", async () => {
    expect(dbCases.length).toBeGreaterThan(0);
  });

  test("DB Constraint: Verify duplicate email rejection (Unique Constraint)", async ({ publicApi }) => {
    // TC verification for User unique email constraint
    const duplicateEmail = `existing_${Date.now()}@aurazone.com`;
    const res1 = await publicApi.post("/auth/signup", {
      email: duplicateEmail,
      password: "TestPassword123!",
      fullName: "Original User",
      role: "CUSTOMER",
    });

    if (res1.status() === 201) {
      const res2 = await publicApi.post("/auth/signup", {
        email: duplicateEmail,
        password: "TestPassword123!",
        fullName: "Duplicate User",
        role: "CUSTOMER",
      });
      // Should reject with 409 or 400
      expect([400, 409]).toContain(res2.status());
    }
  });
});
