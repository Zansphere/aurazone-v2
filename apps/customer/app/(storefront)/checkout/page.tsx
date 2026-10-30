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
  const [addressErrors, setAddressErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});

  const validateField = (field: string, value: string): string => {
    const trimmed = (value || "").trim();
    switch (field) {
      case "name":
        if (!trimmed) return "Full Name is required";
        if (trimmed.length < 2) return "Name must be at least 2 characters";
        if (trimmed.length > 70) return "Name cannot exceed 70 characters";
        if (!/^[a-zA-Z\s.'-]+$/.test(trimmed)) return "Name should only contain letters and spaces";
        return "";
      case "phone":
        if (!trimmed) return "Phone number is required";
        const cleanedPhone = trimmed.replace(/\s+/g, "");
        if (!/^(?:\+91[\-\s]?)?[6-9]\d{9}$|^\+?[1-9]\d{9,14}$/.test(cleanedPhone)) {
          return "Please enter a valid 10-digit mobile number (e.g. 9876543210)";
        }
        return "";
      case "addressLine1":
        if (!trimmed) return "Address Line 1 is required";
        if (trimmed.length < 5) return "Address must be at least 5 characters";
        if (trimmed.length > 120) return "Address cannot exceed 120 characters";
        return "";
      case "addressLine2":
        if (trimmed.length > 120) return "Address Line 2 cannot exceed 120 characters";
        return "";
      case "city":
        if (!trimmed) return "City is required";
        if (trimmed.length < 2) return "City must be at least 2 characters";
        if (trimmed.length > 50) return "City cannot exceed 50 characters";
        if (!/^[a-zA-Z\s.-]+$/.test(trimmed)) return "City should only contain letters and spaces";
        return "";
      case "state":
        if (!trimmed) return "State is required";
        if (trimmed.length < 2) return "State must be at least 2 characters";
        if (trimmed.length > 50) return "State cannot exceed 50 characters";
        return "";
      case "postalCode":
        if (!trimmed) return "PIN code is required";
        if (!/^\d{6}$/.test(trimmed)) return "Please enter a valid 6-digit PIN code (e.g. 400001)";
        return "";
      case "guestEmail":
        if (!trimmed) return "Email address is required";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "Please enter a valid email address";
        if (trimmed.length > 100) return "Email cannot exceed 100 characters";
        return "";
      default:
        return "";
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    let cleanVal = value;
    if (field === "phone") {
      cleanVal = value.replace(/[^\d+]/g, "").slice(0, 13);
    } else if (field === "postalCode") {
      cleanVal = value.replace(/\D/g, "").slice(0, 6);
    }
    setAddressForm(prev => ({ ...prev, [field]: cleanVal }));
    if (touchedFields[field]) {
      const err = validateField(field, cleanVal);
      setAddressErrors(prev => ({ ...prev, [field]: err }));
    }
  };

  const handleFieldBlur = (field: string) => {
    setTouchedFields(prev => ({ ...prev, [field]: true }));
    const val = field === "guestEmail" ? guestEmail : (addressForm as any)[field];
    const err = validateField(field, val);
    setAddressErrors(prev => ({ ...prev, [field]: err }));
  };

  const validateAllAddressFields = (): boolean => {
    const errors: Record<string, string> = {};
    const fieldsToValidate = ["name", "phone", "addressLine1", "city", "state", "postalCode"];
    if (isGuest) fieldsToValidate.push("guestEmail");

    for (const f of fieldsToValidate) {
      const val = f === "guestEmail" ? guestEmail : (addressForm as any)[f];
      const err = validateField(f, val);
      if (err) errors[f] = err;
    }
    setAddressErrors(errors);
    const allTouched = fieldsToValidate.reduce((acc, f) => ({ ...acc, [f]: true }), {});
    setTouchedFields(prev => ({ ...prev, ...allTouched }));
    return Object.keys(errors).length === 0;
  };

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

  const hasUnavailableItems = Boolean(
    cart?.hasUnavailableItems ||
    items.some((it: any) => it.isAvailable === false || it.unavailableReason || !it.variant?.product?.name)
  );

  const isGuest = !isAuthenticated;
  const showAddressForm = isGuest || isAddingNew || addresses.length === 0;
  
  const isAddressValid = Boolean(
    addressForm.name.trim().length >= 2 &&
    /^(?:\+91[\-\s]?)?[6-9]\d{9}$|^\+?[1-9]\d{9,14}$/.test(addressForm.phone.replace(/\s+/g, '')) &&
    addressForm.addressLine1.trim().length >= 5 &&
    addressForm.city.trim().length >= 2 &&
    addressForm.state.trim().length >= 2 &&
    /^\d{6}$/.test(addressForm.postalCode.trim()) &&
    (!isGuest || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim())) &&
    !Object.values(addressErrors).some(Boolean)
  );

  const canPlaceOrder = !hasUnavailableItems && (
    showAddressForm ? isAddressValid : !!selectedAddressId
  );

  const handlePlaceOrder = () => {
    if (hasUnavailableItems) {
      alert("Some items in your cart are no longer available. Please update your cart before placing an order.");
      return;
    }
    if (showAddressForm) {
      const isValid = validateAllAddressFields();
      if (!isValid) return;
    } else if (!selectedAddressId) {
      alert("Please select a delivery address.");
      return;
    }

    const data: any = { 
      paymentMethod,
      notes: orderNotes.trim() ? `[Delivery: ${deliveryOption.toUpperCase()}] ${orderNotes.trim()}` : `[Delivery: ${deliveryOption.toUpperCase()}]`
    };
    if (appliedCoupon) data.couponCode = appliedCoupon.code;
    
    if (showAddressForm) {
      data.address = {
        name: addressForm.name.trim(),
        phone: addressForm.phone.trim(),
        addressLine1: addressForm.addressLine1.trim(),
        addressLine2: addressForm.addressLine2.trim() || undefined,
        city: addressForm.city.trim(),
        state: addressForm.state.trim(),
        postalCode: addressForm.postalCode.trim(),
        country: "IN",
      };
      if (isGuest) data.guestEmail = guestEmail.trim().toLowerCase();
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

        {hasUnavailableItems && (
          <div className="mb-6 rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 shadow-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xl shrink-0">⚠️</span>
              <div>
                <p className="font-bold text-sm text-rose-950">Items No Longer Available</p>
                <p className="text-xs text-rose-800 mt-0.5">
                  Some items in your cart are no longer available or out of stock. Please return to your cart and update your items before placing an order.
                </p>
              </div>
            </div>
            <Link
              href="/cart"
              className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 transition-colors shadow-sm"
            >
              Update Cart
            </Link>
          </div>
        )}

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
                  <input
                    type="email"
                    value={guestEmail}
                    maxLength={100}
                    onChange={e => {
                      setGuestEmail(e.target.value);
                      if (touchedFields.guestEmail) {
                        setAddressErrors(prev => ({ ...prev, guestEmail: validateField("guestEmail", e.target.value) }));
                      }
                    }}
                    onBlur={() => handleFieldBlur("guestEmail")}
                    required
                    className={`w-full rounded-lg border p-2.5 text-sm ${addressErrors.guestEmail ? "border-rose-400 focus:ring-rose-200" : "border-[var(--color-border)]"}`}
                    placeholder="For order updates"
                  />
                  {addressErrors.guestEmail && (
                    <p className="text-xs text-rose-600 mt-1 font-medium">{addressErrors.guestEmail}</p>
                  )}
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
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      placeholder="Full Name"
                      maxLength={70}
                      value={addressForm.name}
                      onChange={e => handleFieldChange("name", e.target.value)}
                      onBlur={() => handleFieldBlur("name")}
                      className={`w-full rounded-lg border p-2.5 text-sm ${addressErrors.name ? "border-rose-400 ring-1 ring-rose-200" : "border-[var(--color-border)]"}`}
                      required
                    />
                    {addressErrors.name && <p className="text-xs text-rose-600 mt-1 font-medium">{addressErrors.name}</p>}
                  </div>

                  <div className="sm:col-span-2">
                    <input
                      type="tel"
                      placeholder="Phone Number (10 digits)"
                      maxLength={13}
                      value={addressForm.phone}
                      onChange={e => handleFieldChange("phone", e.target.value)}
                      onBlur={() => handleFieldBlur("phone")}
                      className={`w-full rounded-lg border p-2.5 text-sm ${addressErrors.phone ? "border-rose-400 ring-1 ring-rose-200" : "border-[var(--color-border)]"}`}
                      required
                    />
                    {addressErrors.phone && <p className="text-xs text-rose-600 mt-1 font-medium">{addressErrors.phone}</p>}
                  </div>

                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      placeholder="Address Line 1"
                      maxLength={120}
                      value={addressForm.addressLine1}
                      onChange={e => handleFieldChange("addressLine1", e.target.value)}
                      onBlur={() => handleFieldBlur("addressLine1")}
                      className={`w-full rounded-lg border p-2.5 text-sm ${addressErrors.addressLine1 ? "border-rose-400 ring-1 ring-rose-200" : "border-[var(--color-border)]"}`}
                      required
                    />
                    {addressErrors.addressLine1 && <p className="text-xs text-rose-600 mt-1 font-medium">{addressErrors.addressLine1}</p>}
                  </div>

                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      placeholder="Address Line 2 (Optional)"
                      maxLength={120}
                      value={addressForm.addressLine2}
                      onChange={e => handleFieldChange("addressLine2", e.target.value)}
                      onBlur={() => handleFieldBlur("addressLine2")}
                      className={`w-full rounded-lg border p-2.5 text-sm ${addressErrors.addressLine2 ? "border-rose-400 ring-1 ring-rose-200" : "border-[var(--color-border)]"}`}
                    />
                    {addressErrors.addressLine2 && <p className="text-xs text-rose-600 mt-1 font-medium">{addressErrors.addressLine2}</p>}
                  </div>

                  <div className="col-span-1">
                    <input
                      type="text"
                      placeholder="City"
                      maxLength={50}
                      value={addressForm.city}
                      onChange={e => handleFieldChange("city", e.target.value)}
                      onBlur={() => handleFieldBlur("city")}
                      className={`w-full rounded-lg border p-2.5 text-sm ${addressErrors.city ? "border-rose-400 ring-1 ring-rose-200" : "border-[var(--color-border)]"}`}
                      required
                    />
                    {addressErrors.city && <p className="text-xs text-rose-600 mt-1 font-medium">{addressErrors.city}</p>}
                  </div>

                  <div className="col-span-1">
                    <input
                      type="text"
                      placeholder="State"
                      maxLength={50}
                      value={addressForm.state}
                      onChange={e => handleFieldChange("state", e.target.value)}
                      onBlur={() => handleFieldBlur("state")}
                      className={`w-full rounded-lg border p-2.5 text-sm ${addressErrors.state ? "border-rose-400 ring-1 ring-rose-200" : "border-[var(--color-border)]"}`}
                      required
                    />
                    {addressErrors.state && <p className="text-xs text-rose-600 mt-1 font-medium">{addressErrors.state}</p>}
                  </div>

                  <div className="col-span-1">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="PIN Code (6 digits)"
                      maxLength={6}
                      value={addressForm.postalCode}
                      onChange={e => handleFieldChange("postalCode", e.target.value)}
                      onBlur={() => handleFieldBlur("postalCode")}
                      className={`w-full rounded-lg border p-2.5 text-sm ${addressErrors.postalCode ? "border-rose-400 ring-1 ring-rose-200" : "border-[var(--color-border)]"}`}
                      required
                    />
                    {addressErrors.postalCode && <p className="text-xs text-rose-600 mt-1 font-medium">{addressErrors.postalCode}</p>}
                  </div>

                  <div className="col-span-1">
                    <input type="text" value="India" readOnly className="w-full rounded-lg border border-[var(--color-border)] p-2.5 text-sm bg-gray-50 text-[var(--color-text-secondary)]" />
                  </div>
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
                {items.map((item: any) => {
                  const isItemUnavailable = item.isAvailable === false || Boolean(item.unavailableReason) || !item.variant?.product?.name;
                  return (
                    <div key={item.id} className={`flex gap-3 p-2 rounded-lg ${isItemUnavailable ? "bg-rose-50/70 border border-rose-200" : ""}`}>
                      <div className="h-12 w-12 shrink-0 rounded-md bg-[var(--color-bg-muted)] overflow-hidden">
                        {item.variant?.images?.[0]?.url && (
                          <img src={item.variant.images[0].url} alt={item.variant.product?.name ?? "Product"} className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-xs font-medium text-[var(--color-text-primary)] truncate">{item.variant?.product?.name ?? "Product"}</p>
                          {isItemUnavailable && (
                            <span className="text-[10px] font-bold text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded shrink-0">Unavailable</span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--color-text-secondary)]">Qty: {item.quantity}</p>
                        {item.unavailableReason && (
                          <p className="text-[10px] text-rose-600 mt-0.5 font-medium">{item.unavailableReason}</p>
                        )}
                      </div>
                      <div className="text-xs font-medium">₹{(Number(item.unitPrice) * item.quantity).toLocaleString()}</div>
                    </div>
                  );
                })}
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
                className="w-full mt-6 flex items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] py-4 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              >
                <Lock size={14} />
                {isProcessing
                  ? "Processing..."
                  : hasUnavailableItems
                  ? "Update Cart to Continue"
                  : `Place Order · ₹${total.toLocaleString()}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}