export abstract class BaseScreen {
  /**
   * Helper to format an accessibility ID for Flutter Semantics.
   * In Flutter Android: Semantics(label: "btn_login") maps to accessibility id ~btn_login.
   */
  public static accessibilityId(id: string): string {
    return `~${id}`;
  }

  /**
   * Helper to locate elements by Android UiSelector text.
   */
  public static androidText(text: string): string {
    return `android=new UiSelector().text("${text}")`;
  }

  /**
   * Helper to locate elements by Android UiSelector resource id.
   */
  public static resourceId(id: string): string {
    return `android=new UiSelector().resourceId("${id}")`;
  }
}
