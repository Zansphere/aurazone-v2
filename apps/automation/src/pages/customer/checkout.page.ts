import { type Page, type Locator } from "@playwright/test";
import { BasePage } from "../base.page.js";

export class CheckoutPage extends BasePage {
  readonly nameInput: Locator;
  readonly phoneInput: Locator;
  readonly addressLine1Input: Locator;
  readonly cityInput: Locator;
  readonly stateInput: Locator;
  readonly postalCodeInput: Locator;
  readonly paymentMethodCOD: Locator;
  readonly paymentMethodOnline: Locator;
  readonly placeOrderBtn: Locator;

  constructor(page: Page) {
    super(page, "/checkout");
    this.nameInput = page.locator("input[name='name'], input[placeholder*='Full Name']");
    this.phoneInput = page.locator("input[name='phone'], input[placeholder*='Phone']");
    this.addressLine1Input = page.locator("input[name='addressLine1'], input[placeholder*='Address']");
    this.cityInput = page.locator("input[name='city']");
    this.stateInput = page.locator("input[name='state']");
    this.postalCodeInput = page.locator("input[name='postalCode'], input[placeholder*='Postal']");
    this.paymentMethodCOD = page.locator("input[value='COD'], label:has-text('Cash on Delivery')");
    this.paymentMethodOnline = page.locator("input[value='RAZORPAY'], label:has-text('Online')");
    this.placeOrderBtn = page.locator("button:has-text('Place Order'), [data-testid='place-order']");
  }

  public async fillShippingAddress(addr: {
    name: string;
    phone: string;
    addressLine1: string;
    city: string;
    state: string;
    postalCode: string;
  }): Promise<void> {
    await this.nameInput.fill(addr.name);
    await this.phoneInput.fill(addr.phone);
    await this.addressLine1Input.fill(addr.addressLine1);
    await this.cityInput.fill(addr.city);
    await this.stateInput.fill(addr.state);
    await this.postalCodeInput.fill(addr.postalCode);
  }

  public async selectPaymentMethod(method: "COD" | "RAZORPAY"): Promise<void> {
    if (method === "COD") {
      await this.paymentMethodCOD.click();
    } else {
      await this.paymentMethodOnline.click();
    }
  }

  public async placeOrder(): Promise<void> {
    await this.placeOrderBtn.click();
    await this.page.waitForURL("**/order-confirmation**", { timeout: 15000 });
  }
}
