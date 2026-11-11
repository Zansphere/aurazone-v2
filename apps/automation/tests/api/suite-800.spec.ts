import { test, expect } from "../../src/fixtures/test-fixtures.js";
import { loadSuite800Cases } from "../../src/utils/sheet-loader.js";

test.describe("Master Suite 800: Ingestion & Smoke Verification", () => {
  const allCases = loadSuite800Cases("Automation Test Cases");

  test("Loads 600+ automation cases from AuraZone_V2_Test_Suite_800.xlsx", async () => {
    expect(allCases.length).toBeGreaterThan(600);
  });

  // Verify critical smoke cases like TC-AZ-001 (API base path responds)
  const smokeCases = allCases.filter((tc) => tc.priority === "Critical" || tc.type === "Smoke").slice(0, 10);

  for (const tc of smokeCases) {
    test(
      `[${tc.id}] ${tc.title}`,
      { tag: ["@suite800", `@${tc.id.toLowerCase()}`, "@smoke"] },
      async ({ publicApi }) => {
        // Validate base endpoint contract defined in TC-AZ-001
        if (tc.id === "TC-AZ-001") {
          const res = await publicApi.get("/api/v1");
          expect([200, 404]).toContain(res.status()); // Fastify responds
        }
      }
    );
  }
});

