import { test, expect } from "../../src/fixtures/test-fixtures.js";
import { loadRoleBasedCases } from "../../src/utils/sheet-loader.js";

const rolesToTest = [
  { sheet: "Public (Anonymous)", role: "PUBLIC" as const },
  { sheet: "Customer", role: "CUSTOMER" as const },
  { sheet: "Store Manager", role: "STORE_MANAGER" as const },
  { sheet: "Super Admin", role: "SUPER_ADMIN" as const },
];

for (const { sheet, role } of rolesToTest) {
  test.describe(`Role-Based API Suite: ${sheet}`, () => {
    const testCases = loadRoleBasedCases(sheet);

    test(`Verify ${sheet} test cases loaded from Excel`, async () => {
      expect(testCases.length).toBeGreaterThan(0);
    });

    // Run the high-priority & smoke test cases dynamically from the sheet
    const runnableCases = testCases.filter(
      (tc) => tc.priority === "Critical" || tc.priority === "High" || tc.type.toLowerCase().includes("smoke")
    ).slice(0, 10); // Run top representative cases per role in standard suite

    for (const tc of runnableCases) {
      test(
        `[${tc.id}] ${tc.title} (${tc.method} ${tc.endpoint})`,
        {
          tag: [
            `@${role.toLowerCase()}`,
            `@${tc.priority.toLowerCase()}`,
            `@${tc.id.toLowerCase()}`,
            `@role-based`,
          ],
        },
        async ({ publicApi, customerApi, storeManagerApi, superAdminApi }) => {
          let client = publicApi;
          const isNoAuth = tc.authHeader?.toLowerCase() === "none" || tc.endpoint.includes("/auth/login");
          if (!isNoAuth) {
            if (role === "CUSTOMER") client = customerApi;
            else if (role === "STORE_MANAGER") client = storeManagerApi;
            else if (role === "SUPER_ADMIN") client = superAdminApi;
          }

          // Dispatch request defined in your sheet
          const res = await client.send({
            method: tc.method,
            endpoint: tc.endpoint,
            data: tc.requestData || undefined,
            role,
          });

          // Verify status code contract
          if (tc.expectedStatus === 200 || tc.expectedStatus === 201) {
            expect([200, 201, 204]).toContain(res.status());
          } else {
            expect(res.status()).toBe(tc.expectedStatus);
          }
        }
      );
    }
  });
}

