import { envConfig } from "../config/env.config.js";

export interface MobileCapabilities {
  platformName: string;
  "appium:automationName": string;
  "appium:deviceName": string;
  "appium:app"?: string;
  "appium:appPackage"?: string;
  "appium:appActivity"?: string;
  "appium:noReset": boolean;
  "appium:newCommandTimeout": number;
}

export class AppiumDriverManager {
  /**
   * Generates standard UiAutomator2 capabilities for the AuraZone Flutter Admin app.
   */
  public static getAndroidCapabilities(): MobileCapabilities {
    const config = envConfig.mobile;
    const caps: MobileCapabilities = {
      platformName: config.platformName,
      "appium:automationName": config.automationName,
      "appium:deviceName": config.deviceName,
      "appium:noReset": config.noReset,
      "appium:newCommandTimeout": config.newCommandTimeout,
    };

    if (config.appPath) {
      caps["appium:app"] = config.appPath;
    }
    if (config.appPackage) {
      caps["appium:appPackage"] = config.appPackage;
    }
    if (config.appActivity) {
      caps["appium:appActivity"] = config.appActivity;
    }

    return caps;
  }

  public static getAppiumUrl(): string {
    return `http://${envConfig.mobile.appiumHost}:${envConfig.mobile.appiumPort}`;
  }
}

