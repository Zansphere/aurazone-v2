import { type Page, type Locator } from "@playwright/test";
import { BasePage } from "../base.page.js";

export class HomePage extends BasePage {
  readonly searchInput: Locator;
  readonly cartIcon: Locator;
  readonly cartBadge: Locator;
  readonly loginButton: Locator;

  constructor(page: Page) {
    super(page, "/");
    this.searchInput = page.locator("input[type='search'], input[placeholder*='Search']");
    this.cartIcon = page.locator("a[href*='/cart'], button[aria-label*='Cart']");
    this.cartBadge = page.locator("[data-testid='cart-count'], .cart-badge");
    this.loginButton = page.locator("a[href*='/login'], button:has-text('Sign In')");
  }

  public async search(term: string): Promise<void> {
    await this.searchInput.fill(term);
    await this.searchInput.press("Enter");
  }

  public async openCart(): Promise<void> {
    await this.cartIcon.click();
    await this.page.waitForURL("**/cart");
  }
}

