import { type Page, type Locator, expect } from "@playwright/test";

export abstract class BasePage {
  protected page: Page;
  protected basePath: string;

  constructor(page: Page, basePath: string = "/") {
    this.page = page;
    this.basePath = basePath;
  }

  public async navigate(query?: Record<string, string>): Promise<void> {
    let url = this.basePath;
    if (query && Object.keys(query).length > 0) {
      const q = new URLSearchParams(query).toString();
      url += `?${q}`;
    }
    await this.page.goto(url, { waitUntil: "domcontentloaded" });
  }

  public async getTitle(): Promise<string> {
    return this.page.title();
  }

  public async getCurrentUrl(): Promise<string> {
    return this.page.url();
  }

  public async waitForUrl(pattern: string | RegExp, timeout: number = 10000): Promise<void> {
    await this.page.waitForURL(pattern, { timeout });
  }

  public async takeScreenshot(name: string): Promise<Buffer> {
    return this.page.screenshot({
      path: `reports/screenshots/${name}_${Date.now()}.png`,
      fullPage: true,
    });
  }

  protected getByTestId(id: string): Locator {
    return this.page.locator(`[data-testid="${id}"]`);
  }
}
