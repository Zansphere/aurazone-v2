import { test as baseTest, expect } from "@playwright/test";
import { ApiClient } from "../utils/api-client.js";
import { TestDataGenerator } from "../utils/test-data.generator.js";

type AuraZoneFixtures = {
  publicApi: ApiClient;
  customerApi: ApiClient;
  storeManagerApi: ApiClient;
  superAdminApi: ApiClient;
  testCustomer: ReturnType<typeof TestDataGenerator.generateCustomer>;
  testAddress: ReturnType<typeof TestDataGenerator.generateAddress>;
};

export const test = baseTest.extend<AuraZoneFixtures>({
  publicApi: async ({ request }, use) => {
    const client = new ApiClient(request, "PUBLIC");
    await use(client);
  },

  customerApi: async ({ request }, use) => {
    const client = new ApiClient(request, "CUSTOMER");
    await use(client);
  },

  storeManagerApi: async ({ request }, use) => {
    const client = new ApiClient(request, "STORE_MANAGER");
    await use(client);
  },

  superAdminApi: async ({ request }, use) => {
    const client = new ApiClient(request, "SUPER_ADMIN");
    await use(client);
  },

  testCustomer: async ({}, use) => {
    await use(TestDataGenerator.generateCustomer());
  },

  testAddress: async ({}, use) => {
    await use(TestDataGenerator.generateAddress());
  },
});

export { expect };
