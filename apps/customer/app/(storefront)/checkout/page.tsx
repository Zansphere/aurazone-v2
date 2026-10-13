"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { MapPin, Plus, CreditCard, Lock, ChevronRight, Tag } from "lucide-react";
import Link from "next/link";
import Script from "next/script";

import { useAuthStore } from "@/stores/auth.store";
import { useCartStore } from "@/stores/cart.store";

export default function CheckoutPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuthStore();

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.push("/login?redirect=/checkout");
    }
  }, [isAuthLoading, isAuthenticated, router]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("COD");
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [guestEmail, setGuestEmail] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponError, setCouponError] = useState("");
  const [isPaymentGatewayOpen, setIsPaymentGatewayOpen] = useState(false);

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
  
  let discount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.discountType === "PERCENTAGE") {
      discount = subtotal * (appliedCoupon.discountValue / 100);
      if (appliedCoupon.maxDiscount) discount = Math.min(discount, appliedCoupon.maxDiscount);
    } else {
      discount = appliedCoupon.discountValue;
    }
    discount = Math.min(discount, subtotal);
  }
  
  const discountedSubtotal = subtotal - discount;
  const deliveryFee = discountedSubtotal >= 499 ? 0 : 49;
  const total = discountedSubtotal + deliveryFee;

  const isGuest = !isAuthenticated;
  const showAddressForm = isGuest || isAddingNew || addresses.length === 0;
  
  const canPlaceOrder = showAddressForm
    ? (addressForm.name && addressForm.phone && addressForm.addressLine1 && addressForm.city && addressForm.postalCode && (!isGuest || guestEmail))
    : !!selectedAddressId;

  const handlePlaceOrder = () => {
    const data: any = { paymentMethod };
    if (appliedCoupon) data.couponCode = appliedCoupon.code;
    
    if (showAddressForm) {
      data.address = addressForm;
      if (isGuest) data.guestEmail = guestEmail;
    } else {
      data.addressId = selectedAddressId;
    }
    placeOrderMutation.mutate(data);
  };

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    try {
      setCouponError("");
      const res = await api.post<any>("/orders/coupons/validate", { 
        code: couponCode, 
        subtotal: subtotal 
      });
      setAppliedCoupon({ 
        code: res.data.code, 
        discountType: res.data.discountType, 
        discountValue: res.data.discountValue 
      });
    } catch (e: any) {
      setCouponError(e.message || "Invalid coupon");
    }
  };

  if (isCartLoading || isAuthLoading || !isAuthenticated) {
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
                  placeholder="Enter code" 
                  className="w-full rounded-lg border border-[var(--color-border)] p-2 text-sm uppercase"
                />
                <button 
                  onClick={() => setAppliedCoupon({ code: couponCode, discountType: "PERCENTAGE", discountValue: 0 })}
                  className="rounded-lg bg-[var(--color-bg-muted)] px-4 py-2 text-sm font-medium hover:bg-[var(--color-border)] transition-colors"
                >
                  Apply
                </button>
              </div>
              {appliedCoupon && (
                <p className="mt-2 text-xs text-green-600 font-medium">Coupon attached. Discount calculated on checkout.</p>
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
                {appliedCoupon && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span className="font-medium">Calculated on checkout</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-secondary)]">Delivery</span>
                  <span className="font-medium text-emerald-600">{deliveryFee === 0 ? "Free" : `₹${deliveryFee}`}</span>
                </div>
                <div className="pt-3 mt-3 border-t border-[var(--color-border)] flex justify-between text-base font-bold">
                  <span>Total</span>
                  <span>{"\u20B9"}{total.toLocaleString()}</span>
                </div>
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