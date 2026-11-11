import { test, expect } from "@playwright/test";
import { AppiumDriverManager } from "../../src/mobile/appium.driver.js";
import { AdminLoginScreen } from "../../src/mobile/admin-login.screen.js";

test.describe("Mobile Native: Flutter Admin App (Android)", () => {
  test("Appium configuration and Android capabilities are valid", { tag: ["@mobile", "@flutter"] }, async () => {
    const caps = AppiumDriverManager.getAndroidCapabilities();

    expect(caps.platformName).toBe("Android");
    expect(caps["appium:automationName"]).toBe("UiAutomator2");
    expect(caps["appium:noReset"]).toBe(false);
  });

  test("Flutter Semantics locators map correctly to accessibility IDs", { tag: ["@mobile"] }, async () => {
    const loginScreen = new AdminLoginScreen();

    // Verify Semantics mappings for Flutter UI widgets
    expect(loginScreen.emailField).toBe("~input_email");
    expect(loginScreen.passwordField).toBe("~input_password");
    expect(loginScreen.loginButton).toBe("~btn_login");
    expect(loginScreen.errorMessage).toBe("~text_error_message");
  });
});
