import { type Page, type Locator } from "@playwright/test";
import { BasePage } from "../base.page.js";

export class CartPage extends BasePage {
  readonly cartItems: Locator;
  readonly subtotalText: Locator;
  readonly couponInput: Locator;
  readonly applyCouponBtn: Locator;
  readonly couponMessage: Locator;
  readonly checkoutBtn: Locator;

  constructor(page: Page) {
    super(page, "/cart");
    this.cartItems = page.locator("[data-testid='cart-item'], .cart-item-row");
    this.subtotalText = page.locator("[data-testid='subtotal'], .cart-subtotal");
    this.couponInput = page.locator("input[placeholder*='Coupon'], input[name='couponCode']");
    this.applyCouponBtn = page.locator("button:has-text('Apply'), [data-testid='apply-coupon']");
    this.couponMessage = page.locator("[data-testid='coupon-alert'], .coupon-feedback");
    this.checkoutBtn = page.locator("a[href*='/checkout'], button:has-text('Checkout'), [data-testid='checkout-button']");
  }

  public async applyCoupon(code: string): Promise<void> {
    await this.couponInput.fill(code);
    await this.applyCouponBtn.click();
  }

  public async proceedToCheckout(): Promise<void> {
    await this.checkoutBtn.click();
    await this.page.waitForURL("**/checkout");
  }
}
