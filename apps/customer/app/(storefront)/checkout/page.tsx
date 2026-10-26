"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { MapPin, Plus, CreditCard, Lock, ChevronRight, Tag, Truck, Check, X, Sparkles, Mail } from "lucide-react";
import Link from "next/link";
import Script from "next/script";

import { useAuthStore } from "@/stores/auth.store";
import { useCartStore } from "@/stores/cart.store";
import { useCouponStore } from "@/stores/coupon.store";

export default function CheckoutPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuthStore();

  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("COD");
  const [deliveryOption, setDeliveryOption] = useState<"standard" | "express">("standard");
  const [orderNotes, setOrderNotes] = useState("");
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [guestEmail, setGuestEmail] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [localCouponError, setLocalCouponError] = useState("");
  const [isPaymentGatewayOpen, setIsPaymentGatewayOpen] = useState(false);

  const {
    appliedCoupon,
    applyCoupon,
    removeCoupon,
    sorrowMessage,
    clearSorrowMessage,
    checkValidity,
    calculateDiscount,
    isLoading: isCouponLoading,
  } = useCouponStore();

  const [addressForm, setAddressForm] = useState({
    name: "", phone: "", addressLine1: "", addressLine2: "",
    city: "", state: "", postalCode: "", country: "India"
  });

  const { cart, isLoading: isCartLoading, fetchCart } = useCartStore();

  useEffect(() => {
    if (!cart) {
      fetchCart();
    }
  }, [cart, fetchCart]);

  const { data: addressData } = useQuery({
    queryKey: ["addresses"],
    queryFn: () => api.get<any[]>("/users/addresses"),
    enabled: isAuthenticated
  });

  const verifyPaymentMutation = useMutation({
    mutationFn: (data: any) => api.post("/payments/verify", data),
    onSuccess: (res: any, variables: any) => {
      setIsPaymentGatewayOpen(false);
      useCartStore.setState({ cart: null });
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      fetchCart();
      router.push(`/order-confirmation/${variables.trackingToken}`);
    },
    onError: (err: any) => {
      setIsPaymentGatewayOpen(false);
      alert("Payment verification failed: " + err.message);
    }
  });

  const createPaymentMutation = useMutation({
    mutationFn: (data: { orderId: string }) => api.post<any>("/payments/create", data),
    onSuccess: (res, variables) => {
      setIsPaymentGatewayOpen(true);
      let paymentCompleted = false;

      const options = {
        key: res.data.keyId,
        amount: res.data.amount,
        currency: res.data.currency,
        name: "AuraZone",
        description: `Order ${res.data.orderNumber}`,
        order_id: res.data.razorpayOrderId,
        handler: function (response: any) {
          paymentCompleted = true;
          verifyPaymentMutation.mutate({
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
            trackingToken: (variables as any).trackingToken
          });
        },
        prefill: {
          name: showAddressForm ? addressForm.name : addresses.find((a: any) => a.id === selectedAddressId)?.name,
          email: isGuest ? guestEmail : undefined,
          contact: showAddressForm ? addressForm.phone : addresses.find((a: any) => a.id === selectedAddressId)?.phone
        },
        theme: {
          color: "#0f172a" // Tailwind slate-900
        },
        modal: {
          ondismiss: function () {
            setIsPaymentGatewayOpen(false);
            if (!paymentCompleted) {
              api.post(`/orders/${variables.orderId}/fail-payment`)
                .then(() => fetchCart())
                .catch(console.error);
            }
          }
        }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', function (response: any) {
        setIsPaymentGatewayOpen(false);
        api.post(`/orders/${variables.orderId}/fail-payment`)
          .then(() => fetchCart())
          .catch(console.error);
        alert("Payment failed. Please try again.");
      });
      rzp.open();
    },
    onError: (err: any) => {
      setIsPaymentGatewayOpen(false);
      alert("Failed to initialize payment gateway: " + err.message);
    }
  });

  const placeOrderMutation = useMutation({
    mutationFn: (data: any) =>
      api.post<{ id: string; trackingToken: string }>("/orders", data),
    onSuccess: (res) => {
      const order = res.data;
      if (!order || !order.id) return;
      
      if (paymentMethod === "RAZORPAY") {
        createPaymentMutation.mutate({ orderId: order.id, trackingToken: order.trackingToken } as any);
      } else {
        useCartStore.setState({ cart: null });
        queryClient.invalidateQueries({ queryKey: ["cart"] });
        fetchCart();
        router.push(`/order-confirmation/${order.trackingToken}`);
      }
    },
    onError: () => {
      setIsPaymentGatewayOpen(false);
    }
  });

  const addresses = addressData?.data ?? [];
  const items = cart?.items ?? [];
  const subtotal = cart?.subtotal ?? 0;

  const checkoutItemInputs = items.map((it: any) => ({
    productId: it.variant?.product?.id || it.productId,
    variantId: it.variantId,
    price: Number(it.unitPrice),
    quantity: it.quantity,
  }));

  useEffect(() => {
    if (items.length > 0) {
      checkValidity(subtotal, checkoutItemInputs);
    }
  }, [subtotal, items.length, checkValidity]);
  
  const discount = calculateDiscount(subtotal, checkoutItemInputs);
  const discountedSubtotal = Math.max(0, subtotal - discount);
  const deliveryFee = deliveryOption === "express" ? 99 : (discountedSubtotal >= 499 ? 0 : 49);
  const total = discountedSubtotal + deliveryFee;
  // Standard 18% GST included in product prices: Base = Subtotal / 1.18, GST = Subtotal * 18 / 118
  const estimatedTax = Math.round((discountedSubtotal * 18) / 118); // 18% inclusive GST

  const isGuest = !isAuthenticated;
  const showAddressForm = isGuest || isAddingNew || addresses.length === 0;
  
  const canPlaceOrder = showAddressForm
    ? (addressForm.name && addressForm.phone && addressForm.addressLine1 && addressForm.city && addressForm.postalCode && (!isGuest || guestEmail))
    : !!selectedAddressId;

  const handlePlaceOrder = () => {
    const data: any = { 
      paymentMethod,
      notes: orderNotes.trim() ? `[Delivery: ${deliveryOption.toUpperCase()}] ${orderNotes.trim()}` : `[Delivery: ${deliveryOption.toUpperCase()}]`
    };
    if (appliedCoupon) data.couponCode = appliedCoupon.code;
    
    if (showAddressForm) {
      data.address = addressForm;
      if (isGuest) data.guestEmail = guestEmail;
    } else {
      data.addressId = selectedAddressId;
    }
    placeOrderMutation.mutate(data);
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setLocalCouponError("");
    try {
      await applyCoupon(
        couponCode,
        subtotal,
        checkoutItemInputs,
        isGuest ? guestEmail : undefined
      );
      setCouponCode("");
    } catch (e: any) {
      setLocalCouponError(e.message || "Invalid coupon");
    }
  };

  if (isCartLoading || isAuthLoading) {
    return (
      <div className="section-container py-16 text-center flex justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="section-container py-16 text-center">
        <p className="text-lg font-semibold text-[var(--color-text-primary)]">Your cart is empty</p>
        <Link href="/products" className="mt-4 inline-flex rounded-xl bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white">
          Continue Shopping
        </Link>
      </div>
    );
  }

  const isProcessing = placeOrderMutation.isPending || createPaymentMutation.isPending || verifyPaymentMutation.isPending || isPaymentGatewayOpen;

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />
      <div className="section-container py-8 max-w-5xl mx-auto">
        {/* Expiry Sorrow Message Alert */}
        {sorrowMessage && (
          <div className="mb-6 rounded-xl border border-rose-300 bg-rose-50/90 p-4 text-sm text-rose-900 shadow-sm flex items-start justify-between gap-3 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-start gap-3">
              <span className="text-2xl select-none">💔</span>
              <div>
                <p className="font-bold text-rose-950 text-sm">Coupon Expired</p>
                <p className="text-xs text-rose-800 mt-0.5 leading-relaxed">{sorrowMessage}</p>
              </div>
            </div>
            <button
              onClick={clearSorrowMessage}
              className="text-rose-500 hover:text-rose-900 p-1 rounded-md hover:bg-rose-100 transition-colors"
              title="Dismiss message"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Email Verification Required Guidance Alert */}
        {isAuthenticated && user && !user.isEmailVerified && (
          <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start gap-3">
              <Mail className="text-amber-600 shrink-0 mt-0.5" size={18} />
              <div>
                <p className="font-bold text-amber-900 dark:text-amber-200">
                  Verify your email to activate full account protection
                </p>
                <p className="text-amber-800 dark:text-amber-300 mt-0.5">
                  A verification link was sent to <strong>{user.email}</strong>. Please check your inbox and verify your email to ensure seamless order confirmations and account security.
                </p>
              </div>
            </div>
            <Link
              href={`/verify?sent=true&email=${encodeURIComponent(user.email)}`}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors shadow-sm"
            >
              Verify Email Instructions
            </Link>
          </div>
        )}

        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-6">Checkout</h1>

        {placeOrderMutation.isError && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 mb-6">
            {(placeOrderMutation.error as Error).message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {isGuest && (
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
                <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                  You are checking out as a guest. <Link href="/login" className="text-[var(--color-accent)] hover:underline font-semibold">Login</Link> for a faster checkout experience.
                </p>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[var(--color-text-secondary)]">Email Address</label>
                  <input type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} required
                    className="w-full rounded-lg border border-[var(--color-border)] p-2.5 text-sm" placeholder="For order updates" />
                </div>
              </div>
            )}

            {/* Delivery Address */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                  <MapPin size={16} /> Delivery Address
                </h2>
                {!isGuest && addresses.length > 0 && (
                  <button onClick={() => setIsAddingNew(!isAddingNew)} className="text-xs text-[var(--color-accent)] font-semibold">
                    {isAddingNew ? "Cancel" : "+ Add New"}
                  </button>
                )}
              </div>
              
              {showAddressForm ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input type="text" placeholder="Full Name" value={addressForm.name} onChange={e => setAddressForm({...addressForm, name: e.target.value})} className="sm:col-span-2 rounded-lg border border-[var(--color-border)] p-2.5 text-sm" required />
                  <input type="tel" placeholder="Phone Number" value={addressForm.phone} onChange={e => setAddressForm({...addressForm, phone: e.target.value})} className="sm:col-span-2 rounded-lg border border-[var(--color-border)] p-2.5 text-sm" required />
                  <input type="text" placeholder="Address Line 1" value={addressForm.addressLine1} onChange={e => setAddressForm({...addressForm, addressLine1: e.target.value})} className="sm:col-span-2 rounded-lg border border-[var(--color-border)] p-2.5 text-sm" required />
                  <input type="text" placeholder="Address Line 2 (Optional)" value={addressForm.addressLine2} onChange={e => setAddressForm({...addressForm, addressLine2: e.target.value})} className="sm:col-span-2 rounded-lg border border-[var(--color-border)] p-2.5 text-sm" />
                  <input type="text" placeholder="City" value={addressForm.city} onChange={e => setAddressForm({...addressForm, city: e.target.value})} className="col-span-1 rounded-lg border border-[var(--color-border)] p-2.5 text-sm" required />
                  <input type="text" placeholder="State" value={addressForm.state} onChange={e => setAddressForm({...addressForm, state: e.target.value})} className="col-span-1 rounded-lg border border-[var(--color-border)] p-2.5 text-sm" required />
                  <input type="text" placeholder="Postal Code" value={addressForm.postalCode} onChange={e => setAddressForm({...addressForm, postalCode: e.target.value})} className="col-span-1 rounded-lg border border-[var(--color-border)] p-2.5 text-sm" required />
                  <input type="text" value="India" readOnly className="col-span-1 rounded-lg border border-[var(--color-border)] p-2.5 text-sm bg-gray-50" />
                </div>
              ) : (
                <div className="space-y-2">
                  {addresses.map((addr: any) => (
                    <button key={addr.id} onClick={() => setSelectedAddressId(addr.id)}
                      className={`w-full text-left rounded-lg border p-3 text-sm transition-colors ${
                        selectedAddressId === addr.id
                          ? "border-[var(--color-accent)] bg-[var(--color-accent-light)]"
                          : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]"
                      }`}>
                      <p className="font-medium text-[var(--color-text-primary)]">{addr.name}</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        {addr.addressLine1}, {addr.city}, {addr.state} {addr.postalCode}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Delivery Speed / Shipping Options */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2 mb-4">
                <Truck size={16} /> Delivery Speed & Timeframe
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDeliveryOption("standard")}
                  className={`text-left rounded-xl border p-4 transition-all ${
                    deliveryOption === "standard"
                      ? "border-[var(--color-accent)] bg-[var(--color-accent-light)] ring-2 ring-[var(--color-accent)]/20"
                      : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-bold text-[var(--color-text-primary)]">Standard Delivery</span>
                    <span className="text-xs font-semibold text-emerald-600">
                      {discountedSubtotal >= 499 ? "FREE" : "₹49"}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-1">Est. 3–5 business days</p>
                  <p className="text-[11px] text-[var(--color-text-tertiary)] mt-2">Reliable surface delivery</p>
                </button>

                <button
                  type="button"
                  onClick={() => setDeliveryOption("express")}
                  className={`text-left rounded-xl border p-4 transition-all ${
                    deliveryOption === "express"
                      ? "border-[var(--color-accent)] bg-[var(--color-accent-light)] ring-2 ring-[var(--color-accent)]/20"
                      : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-bold text-[var(--color-text-primary)]">Express Delivery</span>
                    <span className="text-xs font-semibold text-[var(--color-accent)]">₹99</span>
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-1">Est. 1–2 business days</p>
                  <p className="text-[11px] text-[var(--color-text-tertiary)] mt-2">Priority air courier dispatch</p>
                </button>
              </div>
            </div>

            {/* Delivery Instructions / Order Notes */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2 mb-2">
                Delivery Instructions (Optional)
              </h2>
              <p className="text-xs text-[var(--color-text-tertiary)] mb-3">
                Provide landmark, gate code, or specific drop-off instructions.
              </p>
              <textarea
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="E.g. Ring the bell twice, leave with security at tower B..."
                rows={2}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-base)] p-3 text-sm outline-none resize-none focus:border-[var(--color-accent)]"
              />
            </div>

            {/* Payment Method */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2 mb-4">
                <CreditCard size={16} /> Payment Method
              </h2>
              <div className="space-y-2">
                {[
                  { value: "COD", label: "Cash on Delivery", desc: "Pay when you receive your order" },
                  { value: "RAZORPAY", label: "Online Payment", desc: "UPI, Cards, Net Banking" },
                ].map(({ value, label, desc }) => (
                  <button key={value} onClick={() => setPaymentMethod(value)}
                    className={`w-full text-left rounded-lg border p-3 transition-colors ${
                      paymentMethod === value
                        ? "border-[var(--color-accent)] bg-[var(--color-accent-light)]"
                        : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]"
                    }`}>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">{label}</p>
                    <p className="text-xs text-[var(--color-text-tertiary)]">{desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1 space-y-6">
            {/* Coupon Code */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
                <Tag size={16} /> Apply Coupon
              </h2>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={couponCode} 
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="Enter promo code" 
                  className="w-full rounded-lg border border-[var(--color-border)] p-2 text-sm uppercase outline-none focus:border-[var(--color-accent)]"
                />
                <button 
                  type="button"
                  disabled={isCouponLoading || !couponCode.trim()}
                  onClick={handleApplyCoupon}
                  className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-50"
                >
                  {isCouponLoading ? "..." : "Apply"}
                </button>
              </div>

              {localCouponError && (
                <p className="mt-2 text-xs text-red-500 font-medium">{localCouponError}</p>
              )}

              {appliedCoupon && (
                <div className="mt-3 flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-800 animate-in fade-in">
                  <div className="flex items-center gap-1.5 font-medium">
                    <Check size={14} className="text-emerald-600 shrink-0" />
                    <div>
                      <span>Code <strong>{appliedCoupon.code}</strong> applied</span>
                      <p className="text-[10px] text-emerald-600 font-semibold">
                        You saved ₹{discount.toLocaleString()} on this order!
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCoupon()}
                    className="text-[11px] text-rose-600 hover:text-rose-800 font-bold ml-2 shrink-0 underline"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            {/* Order Summary */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5 sticky top-24">
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Order Summary</h2>
              
              <div className="space-y-4 mb-4 max-h-[30vh] overflow-y-auto pr-2">
                {items.map((item: any) => (
                  <div key={item.id} className="flex gap-3">
                    <div className="h-12 w-12 shrink-0 rounded-md bg-[var(--color-bg-muted)] overflow-hidden">
                      {item.variant.images?.[0]?.url && (
                        <img src={item.variant.images[0].url} alt={item.variant.product.name} className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[var(--color-text-primary)] truncate">{item.variant.product.name}</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">Qty: {item.quantity}</p>
                    </div>
                    <div className="text-xs font-medium">₹{(item.unitPrice * item.quantity).toLocaleString()}</div>
                  </div>
                ))}
              </div>

              <div className="space-y-2 text-sm border-t border-[var(--color-border)] pt-4">
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-secondary)]">Subtotal</span>
                  <span className="font-medium">{"\u20B9"}{subtotal.toLocaleString()}</span>
                </div>
                {appliedCoupon && discount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span className="flex items-center gap-1">
                      Discount ({appliedCoupon.code})
                    </span>
                    <span className="font-bold">-₹{discount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-secondary)]">Delivery ({deliveryOption === "express" ? "Express" : "Standard"})</span>
                  <span className="font-medium text-emerald-600">{deliveryFee === 0 ? "Free" : `₹${deliveryFee}`}</span>
                </div>
                <div className="flex justify-between text-xs text-[var(--color-text-tertiary)] pt-1">
                  <span>Included 18% GST (CGST 9% + SGST 9%)</span>
                  <span>₹{estimatedTax.toLocaleString()}</span>
                </div>
                <div className="pt-3 mt-3 border-t border-[var(--color-border)] flex justify-between text-base font-bold">
                  <span>Total</span>
                  <span>{"\u20B9"}{total.toLocaleString()}</span>
                </div>
              </div>

              <div className="mt-3 p-2.5 rounded-lg bg-emerald-50 border border-emerald-100 text-[11px] text-emerald-800 flex items-center gap-2">
                <Truck size={14} className="shrink-0 text-emerald-600" />
                <span>
                  Estimated delivery: <strong>{deliveryOption === "express" ? "Tomorrow / Day after (1–2 days)" : "Within 3–5 days"}</strong>
                </span>
              </div>

              <button
                onClick={handlePlaceOrder}
                disabled={!canPlaceOrder || isProcessing}
                className="w-full mt-6 flex items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] py-4 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Lock size={14} />
                {isProcessing ? "Processing..." : `Place Order · ₹${total.toLocaleString()}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}