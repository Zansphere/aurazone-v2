import { BaseScreen } from "./base.screen.js";

export class AdminLoginScreen extends BaseScreen {
  // Locators matching Flutter Semantics & Android UiSelectors
  readonly emailField = BaseScreen.accessibilityId("input_email");
  readonly passwordField = BaseScreen.accessibilityId("input_password");
  readonly loginButton = BaseScreen.accessibilityId("btn_login");
  readonly errorMessage = BaseScreen.accessibilityId("text_error_message");

  // Fallback text locators if Semantics are omitted
  readonly emailFallback = BaseScreen.androidText("Email");
  readonly passwordFallback = BaseScreen.androidText("Password");
  readonly loginBtnFallback = BaseScreen.androidText("Sign In");
}
