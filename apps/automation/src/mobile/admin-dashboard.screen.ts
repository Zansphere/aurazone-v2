import { BaseScreen } from "./base.screen.js";

export class AdminDashboardScreen extends BaseScreen {
  readonly ordersTab = BaseScreen.accessibilityId("tab_orders");
  readonly inventoryTab = BaseScreen.accessibilityId("tab_inventory");
  readonly analyticsTab = BaseScreen.accessibilityId("tab_analytics");
  readonly profileButton = BaseScreen.accessibilityId("btn_profile");
  readonly logoutButton = BaseScreen.accessibilityId("btn_logout");

  readonly orderCards = BaseScreen.accessibilityId("card_order_item");
  readonly lowStockBadge = BaseScreen.accessibilityId("badge_low_stock");
}

