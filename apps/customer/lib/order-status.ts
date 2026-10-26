import { Clock, Package, Truck, CheckCircle2, AlertCircle, XCircle } from "lucide-react";

export interface OrderStatusMeta {
  key: string;
  badgeLabel: string;
  stepLabel: string;
  description: string;
  badgeClass: string;
  stepIndex: number;
  icon: typeof Clock;
}

export const ORDER_LIFECYCLE_STEPS = [
  {
    key: "PENDING",
    label: "Order Placed",
    shortDesc: "Order details received",
    icon: Clock,
  },
  {
    key: "RECEIVED",
    label: "Order Received",
    shortDesc: "Confirmed & in preparation",
    icon: Package,
  },
  {
    key: "SHIPPED",
    label: "Shipped",
    shortDesc: "On the way with courier",
    icon: Truck,
  },
  {
    key: "DELIVERED",
    label: "Delivered",
    shortDesc: "Package delivered",
    icon: CheckCircle2,
  },
] as const;

export const ORDER_STATUS_CONFIG: Record<string, OrderStatusMeta> = {
  PENDING: {
    key: "PENDING",
    badgeLabel: "Order Placed",
    stepLabel: "Order Placed",
    description: "Your order has been placed and is awaiting confirmation/payment.",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
    stepIndex: 0,
    icon: Clock,
  },
  RECEIVED: {
    key: "RECEIVED",
    badgeLabel: "Order Received",
    stepLabel: "Order Received",
    description: "Your order is confirmed and is actively being prepared for dispatch.",
    badgeClass: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
    stepIndex: 1,
    icon: Package,
  },
  SHIPPED: {
    key: "SHIPPED",
    badgeLabel: "Shipped",
    stepLabel: "Shipped",
    description: "Your package has been dispatched and is in transit with our delivery partner.",
    badgeClass: "bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800",
    stepIndex: 2,
    icon: Truck,
  },
  DELIVERED: {
    key: "DELIVERED",
    badgeLabel: "Delivered",
    stepLabel: "Delivered",
    description: "Your package has been safely delivered to your address.",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
    stepIndex: 3,
    icon: CheckCircle2,
  },
  SUCCESS: {
    key: "SUCCESS",
    badgeLabel: "Delivered",
    stepLabel: "Delivered",
    description: "Order completed successfully.",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
    stepIndex: 3,
    icon: CheckCircle2,
  },
  CANCELLED: {
    key: "CANCELLED",
    badgeLabel: "Cancelled",
    stepLabel: "Cancelled",
    description: "This order has been cancelled.",
    badgeClass: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/60 dark:text-red-400 dark:border-red-800",
    stepIndex: -1,
    icon: XCircle,
  },
  FAILED: {
    key: "FAILED",
    badgeLabel: "Payment Failed",
    stepLabel: "Payment Failed",
    description: "Payment was not successful. Reserved inventory has been released.",
    badgeClass: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-800",
    stepIndex: -1,
    icon: AlertCircle,
  },
};

export function getOrderStatusMeta(status?: string): OrderStatusMeta {
  if (!status) return ORDER_STATUS_CONFIG.PENDING;
  const upper = status.toUpperCase();
  return (
    ORDER_STATUS_CONFIG[upper] ?? {
      key: upper,
      badgeLabel: upper,
      stepLabel: upper,
      description: `Order status: ${upper}`,
      badgeClass: "bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-300",
      stepIndex: 0,
      icon: Clock,
    }
  );
}
