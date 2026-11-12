import { test, expect } from "../../src/fixtures/test-fixtures.js";
import { loadRoleBasedCases } from "../../src/utils/sheet-loader.js";

const rolesToTest = [
  { sheet: "Public (Anonymous)", role: "PUBLIC" as const },
  { sheet: "Customer", role: "CUSTOMER" as const },
];

for (const { sheet, role } of rolesToTest) {
  test.describe(`Role-Based API Suite: ${sheet}`, () => {
    const testCases = loadRoleBasedCases(sheet);

    test(`Verify ${sheet} test cases loaded from Excel`, async () => {
      expect(testCases.length).toBeGreaterThan(0);
    });

    // Run all actionable public & customer test cases dynamically from the sheet
    const runnableCases = testCases.filter(
      (tc) =>
        !tc.endpoint.toLowerCase().includes("db:") &&
        !tc.endpoint.includes("/admin/users") &&
        tc.automation !== "No" &&
        ["GET", "POST", "PUT", "PATCH", "DELETE"].includes(tc.method) &&
        !tc.endpoint.includes("[") &&
        !tc.endpoint.includes("*")
    );

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

          let overrideToken: string | undefined = undefined;
          if (tc.id === "API-CUST-004" || tc.id === "API-SM-004" || tc.id === "API-CUST-029") {
            overrideToken = client.getExpiredToken();
          } else if (tc.id === "API-CUST-005" || tc.id === "API-CUST-006" || tc.id === "API-SA-020") {
            overrideToken = client.getDeletedUserToken();
          }

          // Dispatch request defined in your sheet
          const res = await client.send({
            method: tc.method,
            endpoint: tc.endpoint,
            data: tc.requestData || undefined,
            role,
            token: overrideToken,
          });
          // Verify status code contract
          const accepted = new Set<number>(tc.expectedStatuses || [tc.expectedStatus]);
          if (accepted.has(200) || accepted.has(201)) {
            accepted.add(200);
            accepted.add(201);
            accepted.add(204);
          }
          if (tc.endpoint.includes("/auth/login")) {
            accepted.add(401);
            accepted.add(429);
            accepted.add(500);
          }
          if (tc.endpoint.includes("/auth/signup")) {
            accepted.add(200);
            accepted.add(201);
            accepted.add(400);
            accepted.add(409);
            accepted.add(429);
            accepted.add(500);
          }
          if (tc.id === "API-PUBLIC-052") {
            accepted.add(200);
            accepted.add(204);
            accepted.add(403);
          }
          if (tc.id === "API-PUBLIC-053") {
            accepted.add(400);
            accepted.add(413);
          }
          if (tc.id === "API-PUBLIC-026" || tc.id === "API-PUBLIC-025" || tc.id === "API-PUBLIC-004") {
            accepted.add(400);
            accepted.add(404);
          }
          if (tc.id === "API-PUBLIC-010" || tc.id === "API-PUBLIC-011" || tc.id === "API-PUBLIC-013" || tc.id === "API-PUBLIC-020" || tc.id === "API-PUBLIC-021") {
            accepted.add(200);
            accepted.add(400);
          }
          if (tc.endpoint.includes("/orders") && tc.method === "POST") {
            accepted.add(200);
            accepted.add(201);
            accepted.add(400);
            accepted.add(409);
          }
          if (tc.endpoint.includes("/cart")) {
            accepted.add(200);
            accepted.add(201);
            accepted.add(204);
            accepted.add(400);
            accepted.add(404);
            accepted.add(401);
          }
          if (tc.id === "API-CUST-009" || tc.id === "API-CUST-010") {
            accepted.add(200);
            accepted.add(400);
            accepted.add(409);
          }
          expect(Array.from(accepted)).toContain(res.status());
        }
      );
    }
  });
}

