import { type Page, type Locator } from "@playwright/test";
import { BasePage } from "../base.page.js";

export class CatalogPage extends BasePage {
  readonly productCards: Locator;
  readonly categoryFilter: Locator;
  readonly priceFilter: Locator;
  readonly sortSelect: Locator;

  constructor(page: Page) {
    super(page, "/products");
    this.productCards = page.locator("[data-testid='product-card'], a[href*='/product/']");
    this.categoryFilter = page.locator("[data-testid='category-filter'], select[name='category']");
    this.priceFilter = page.locator("[data-testid='price-filter']");
    this.sortSelect = page.locator("select[name='sort'], [data-testid='sort-select']");
  }

  public async getProductCount(): Promise<number> {
    await this.productCards.first().waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
    return this.productCards.count();
  }

  public async selectFirstProduct(): Promise<void> {
    await this.productCards.first().click();
    await this.page.waitForURL("**/product/**");
  }

  public async addFirstProductToCart(): Promise<void> {
    await this.selectFirstProduct();
    const addToCartBtn = this.page.locator("button:has-text('Add to Cart'), [data-testid='add-to-cart']");
    await addToCartBtn.click();
  }
}

