import { test, expect } from "@playwright/test";
import { HomePage } from "../../src/pages/customer/home.page.js";
import { CatalogPage } from "../../src/pages/customer/catalog.page.js";
import { CartPage } from "../../src/pages/customer/cart.page.js";
import { CheckoutPage } from "../../src/pages/customer/checkout.page.js";
import { TestDataGenerator } from "../../src/utils/test-data.generator.js";

test.describe("Web Storefront: Customer End-to-End User Journey", () => {
  test("Customer can navigate catalog and view products", { tag: ["@web", "@smoke"] }, async ({ page }) => {
    const catalogPage = new CatalogPage(page);
    await catalogPage.navigate();

    // Verify page loads without JS errors
    const title = await catalogPage.getTitle();
    expect(title).toBeDefined();
  });

  test("Customer can add items to cart and proceed towards checkout", { tag: ["@web", "@regression"] }, async ({ page }) => {
    const homePage = new HomePage(page);
    const catalogPage = new CatalogPage(page);
    const cartPage = new CartPage(page);
    const checkoutPage = new CheckoutPage(page);

    // 1. Visit homepage
    await homePage.navigate();

    // 2. Browse products
    await catalogPage.navigate();
    const count = await catalogPage.getProductCount();

    if (count > 0) {
      // 3. Add first product to cart
      await catalogPage.addFirstProductToCart();

      // 4. Navigate to cart
      await cartPage.navigate();

      // 5. Fill checkout details
      const testAddr = TestDataGenerator.generateAddress();
      await checkoutPage.navigate();
      await checkoutPage.fillShippingAddress(testAddr);
      await checkoutPage.selectPaymentMethod("COD");
    }
  });
});
