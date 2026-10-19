import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "@/lib/api";

export interface AppliedCoupon {
  code: string;
  description?: string | null;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number;
  maxDiscount?: number | null;
  minOrderValue?: number | null;
  discount: number;
  endDate?: string | null;
  isProductSpecific?: boolean;
  applicableProductIds?: string[] | null;
  appliedAt: number;
}

interface CouponStore {
  appliedCoupon: AppliedCoupon | null;
  couponError: string | null;
  sorrowMessage: string | null;
  isLoading: boolean;
  applyCoupon: (
    code: string,
    subtotal: number,
    items?: Array<{ productId: string; variantId?: string; price: number; quantity: number }>,
    guestEmail?: string
  ) => Promise<AppliedCoupon>;
  removeCoupon: () => void;
  clearSorrowMessage: () => void;
  checkValidity: (subtotal?: number, items?: any[]) => boolean;
  calculateDiscount: (
    subtotal: number,
    items?: Array<{ productId: string; variantId?: string; price: number; quantity: number }>
  ) => number;
}

export const useCouponStore = create<CouponStore>()(
  persist(
    (set, get) => ({
      appliedCoupon: null,
      couponError: null,
      sorrowMessage: null,
      isLoading: false,

      applyCoupon: async (code, subtotal, items, guestEmail) => {
        set({ isLoading: true, couponError: null, sorrowMessage: null });
        try {
          const res = await api.post<any>("/orders/coupons/validate", {
            code: code.trim().toUpperCase(),
            subtotal,
            items: items && items.length > 0 ? items : undefined,
            guestEmail: guestEmail || undefined,
          });

          if (!res.success || !res.data) {
            throw new Error(res.message || "Invalid coupon code");
          }

          const couponData: AppliedCoupon = {
            code: res.data.code,
            description: res.data.description,
            discountType: res.data.discountType,
            discountValue: res.data.discountValue,
            maxDiscount: res.data.maxDiscount,
            minOrderValue: res.data.minOrderValue,
            discount: res.data.discount,
            endDate: res.data.endDate,
            isProductSpecific: res.data.isProductSpecific,
            applicableProductIds: res.data.applicableProductIds,
            appliedAt: Date.now(),
          };

          set({ appliedCoupon: couponData, isLoading: false, couponError: null });
          return couponData;
        } catch (err: any) {
          const errorMsg = err.message || "Failed to validate coupon";
          set({ couponError: errorMsg, isLoading: false });
          throw new Error(errorMsg);
        }
      },

      removeCoupon: () => {
        set({ appliedCoupon: null, couponError: null });
      },

      clearSorrowMessage: () => {
        set({ sorrowMessage: null });
      },

      checkValidity: (subtotal?: number, items?: any[]) => {
        const { appliedCoupon } = get();
        if (!appliedCoupon) return false;

        const now = Date.now();
        if (appliedCoupon.endDate) {
          const expiryTime = new Date(appliedCoupon.endDate).getTime();
          if (now > expiryTime) {
            const code = appliedCoupon.code;
            set({
              appliedCoupon: null,
              sorrowMessage: `We're sorry! The promo coupon "${code}" has expired before you completed your checkout.`,
            });
            return false;
          }
        }

        // If items are provided for a product-specific coupon, verify at least one eligible product remains
        if (appliedCoupon.isProductSpecific && items && items.length > 0 && appliedCoupon.applicableProductIds) {
          const assignedSet = new Set(appliedCoupon.applicableProductIds);
          const hasEligible = items.some((it) => assignedSet.has(it.productId));
          if (!hasEligible) {
            const code = appliedCoupon.code;
            set({
              appliedCoupon: null,
              sorrowMessage: `Coupon "${code}" was removed because eligible items are no longer in your cart.`,
            });
            return false;
          }
        }

        return true;
      },

      calculateDiscount: (subtotal, items) => {
        const { appliedCoupon } = get();
        if (!appliedCoupon) return 0;

        let eligibleAmount = subtotal;

        // If product-specific, only calculate discount on the matching products
        if (appliedCoupon.isProductSpecific && items && items.length > 0 && appliedCoupon.applicableProductIds) {
          const assignedSet = new Set(appliedCoupon.applicableProductIds);
          const eligibleItems = items.filter((it) => assignedSet.has(it.productId));
          eligibleAmount = eligibleItems.reduce((acc, it) => acc + (it.price * it.quantity), 0);
        }

        if (appliedCoupon.minOrderValue && eligibleAmount < appliedCoupon.minOrderValue) {
          return 0;
        }

        let disc = 0;
        if (appliedCoupon.discountType === "PERCENTAGE") {
          disc = eligibleAmount * (appliedCoupon.discountValue / 100);
          if (appliedCoupon.maxDiscount) {
            disc = Math.min(disc, appliedCoupon.maxDiscount);
          }
        } else {
          disc = appliedCoupon.discountValue;
        }

        return Math.min(Math.round(disc), Math.round(eligibleAmount));
      },
    }),
    {
      name: "aurazone_applied_coupon",
      partialize: (state) => ({ appliedCoupon: state.appliedCoupon }),
    }
  )
);
