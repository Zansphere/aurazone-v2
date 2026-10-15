"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useCartStore } from "@/stores/cart.store";
import { useAuthStore } from "@/stores/auth.store";
import { ProductCard } from "@/components/product/ProductCard";
import { ProductLightboxModal } from "@/components/product/ProductLightboxModal";
import { SizeChartModal } from "@/components/product/SizeChartModal";
import {
  Heart,
  ShoppingCart,
  Minus,
  Plus,
  ChevronRight,
  Check,
  Truck,
  RotateCcw,
  Shield,
  Star,
  Maximize2,
  Ruler,
  MapPin,
  Share2,
  Copy,
  Sparkles,
  PackageCheck,
  Award,
} from "lucide-react";
import Link from "next/link";

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const queryClient = useQueryClient();
  const { addToCart, isLoading: cartLoading } = useCartStore();
  const { isAuthenticated } = useAuthStore();

  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [addedToCart, setAddedToCart] = useState(false);
  const [addedBundle, setAddedBundle] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewBody, setReviewBody] = useState("");
  const [showReviewForm, setShowReviewForm] = useState(false);

  // Modals & Enhancements
  const [showLightbox, setShowLightbox] = useState(false);
  const [showSizeChart, setShowSizeChart] = useState(false);
  const [pincode, setPincode] = useState("");
  const [pincodeStatus, setPincodeStatus] = useState<{ checked: boolean; valid: boolean; message: string; date?: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    const savedPin = localStorage.getItem("aurazone_customer_pincode");
    if (savedPin) {
      setPincode(savedPin);
      validatePincode(savedPin);
    }
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["product", slug],
    queryFn: () => api.get<any>(`/products/${slug}`),
  });

  const { data: relatedData } = useQuery({
    queryKey: ["related-products", slug],
    queryFn: () => api.get<any[]>(`/products/${slug}/related`),
  });

  const { data: wishlistData } = useQuery({
    queryKey: ["wishlist"],
    queryFn: () => api.get<any[]>("/wishlist"),
    enabled: isAuthenticated,
  });

  const { data: reviewsData } = useQuery({
    queryKey: ["reviews", slug],
    queryFn: () => api.get<any[]>(`/products/${slug}/reviews`),
  });

  const addWishlistMutation = useMutation({
    mutationFn: (body: { productId: string; variantId?: string }) => api.post("/wishlist", body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wishlist"] }),
  });

  const removeWishlistMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/wishlist/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wishlist"] }),
  });

  const submitReviewMutation = useMutation({
    mutationFn: (body: { rating: number; body: string }) =>
      api.post(`/products/${slug}/reviews`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews", slug] });
      setReviewBody("");
      setShowReviewForm(false);
    },
  });

  const product = data?.data;
  const variant = product?.variants?.[selectedVariantIdx];
  const reviews: any[] = reviewsData?.data ?? [];
  const relatedProducts: any[] = relatedData?.data ?? [];
  const wishlistItems: any[] = wishlistData?.data ?? [];
  const wishlistItem = wishlistItems.find((w) => w.productId === product?.id);
  const isWishlisted = !!wishlistItem;

  const validatePincode = (pin: string) => {
    if (!/^\d{6}$/.test(pin)) {
      setPincodeStatus({ checked: true, valid: false, message: "Please enter a valid 6-digit Indian PIN code." });
      return;
    }
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + 3);
    const dateFormatted = deliveryDate.toLocaleDateString("en-IN", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });

    localStorage.setItem("aurazone_customer_pincode", pin);
    setPincodeStatus({
      checked: true,
      valid: true,
      message: `Delivery available by ${dateFormatted}`,
      date: dateFormatted,
    });
  };

  const handlePincodeCheck = (e: React.FormEvent) => {
    e.preventDefault();
    validatePincode(pincode);
  };

  const handleWishlistToggle = () => {
    if (!isAuthenticated) {
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    if (isWishlisted) removeWishlistMutation.mutate(wishlistItem.id);
    else addWishlistMutation.mutate({ productId: product.id, variantId: variant?.id });
  };

  const handleAddToCart = async () => {
    if (!variant) return;
    try {
      await addToCart(variant.id, quantity);
      setAddedToCart(true);
      setTimeout(() => setAddedToCart(false), 2000);
    } catch {
      /* Handled in store */
    }
  };

  const handleBuyNow = async () => {
    if (!variant) return;
    try {
      await addToCart(variant.id, quantity);
      router.push("/checkout");
    } catch {
      /* Handled in store */
    }
  };

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  if (isLoading) {
    return (
      <div className="section-container py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="aspect-square shimmer rounded-2xl" />
          <div className="space-y-4">
            <div className="h-4 w-32 shimmer rounded" />
            <div className="h-8 w-3/4 shimmer rounded" />
            <div className="h-6 w-24 shimmer rounded" />
            <div className="h-12 w-full shimmer rounded-xl mt-6" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="section-container py-16 text-center">
        <p className="text-lg font-semibold text-[var(--color-text-primary)]">Product not found</p>
      </div>
    );
  }

  const images = variant?.images ?? [];
  const price = Number(variant?.price ?? 0);
  const comparePrice = variant?.compareAtPrice ? Number(variant.compareAtPrice) : null;
  const discount = comparePrice ? Math.round(((comparePrice - price) / comparePrice) * 100) : 0;
  const stock = variant?.inventory?.quantity ?? 10;
  const attributes = variant?.attributes ?? [];
  const avgRating =
    reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  // Frequently bought together recommendation
  const bundleCompanion = relatedProducts[0];
  const bundleVariant = bundleCompanion?.variants?.[0];
  const bundlePrice = bundleVariant ? Number(bundleVariant.price) : 0;
  const bundleCombinedPrice = Math.round((price + bundlePrice) * 0.95); // 5% bundle discount

  const handleAddBundle = async () => {
    if (!variant || !bundleVariant) return;
    try {
      await addToCart(variant.id, 1);
      await addToCart(bundleVariant.id, 1);
      setAddedBundle(true);
      setTimeout(() => setAddedBundle(false), 2500);
    } catch {
      /* Handled */
    }
  };

  return (
    <div className="section-container py-6 md:py-10">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] mb-6 flex-wrap">
        <Link href="/" className="hover:text-[var(--color-text-primary)]">
          Home
        </Link>
        <ChevronRight size={12} />
        <Link href="/products" className="hover:text-[var(--color-text-primary)]">
          Products
        </Link>
        {product.category && (
          <>
            <ChevronRight size={12} />
            <Link
              href={`/products?categoryId=${product.category.id}`}
              className="hover:text-[var(--color-text-primary)]"
            >
              {product.category.name}
            </Link>
          </>
        )}
        <ChevronRight size={12} />
        <span className="text-[var(--color-text-primary)] font-medium truncate max-w-xs">
          {product.name}
        </span>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
        {/* Images & Lightbox Trigger */}
        <div className="space-y-3">
          <div
            onClick={() => setShowLightbox(true)}
            className="group relative aspect-square overflow-hidden rounded-2xl bg-[var(--color-bg-muted)] border border-[var(--color-border)] cursor-zoom-in"
          >
            {images.length > 0 ? (
              <img
                src={images[selectedImage]?.url}
                alt={product.name}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-5xl">📦</div>
            )}

            {/* Discount Badge */}
            {discount > 0 && (
              <span className="absolute left-3 top-3 rounded-full bg-[var(--color-accent-warm)] px-3 py-1 text-xs font-bold text-white shadow-sm">
                -{discount}%
              </span>
            )}

            {/* Zoom Icon Overlay Badge */}
            <div className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs text-white backdrop-blur-sm opacity-80 group-hover:opacity-100 transition-opacity">
              <Maximize2 size={13} /> Click to zoom
            </div>
          </div>

          {/* Thumbnails */}
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((img: any, idx: number) => (
                <button
                  key={img.id ?? idx}
                  onClick={() => setSelectedImage(idx)}
                  className={`h-16 w-16 shrink-0 rounded-xl overflow-hidden border-2 transition-all ${
                    selectedImage === idx
                      ? "border-[var(--color-accent)] shadow-sm scale-95"
                      : "border-transparent opacity-70 hover:opacity-100"
                  }`}
                >
                  <img
                    src={img.url}
                    alt={`${product.name} thumbnail ${idx + 1}`}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Details & Actions */}
        <div className="space-y-5">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-accent)]">
                {product.brand || product.store?.name}
              </span>
              {/* Social Share Buttons */}
              <div className="flex items-center gap-2">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `Check out ${product.name} on AuraZone: ` + (typeof window !== "undefined" ? window.location.href : "")
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Share on WhatsApp"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                >
                  <Share2 size={13} />
                </a>
                <button
                  onClick={handleCopyLink}
                  title="Copy Link"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-bg-muted)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  {copiedLink ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                </button>
                {copiedLink && (
                  <span className="text-[10px] font-semibold text-emerald-600 animate-in fade-in">
                    Link copied!
                  </span>
                )}
              </div>
            </div>

            <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)] leading-tight">
              {product.name}
            </h1>
          </div>

          {/* Ratings Summary */}
          {reviews.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    size={15}
                    className={
                      s <= Math.round(avgRating)
                        ? "fill-amber-400 text-amber-400"
                        : "text-gray-300"
                    }
                  />
                ))}
              </div>
              <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                {avgRating.toFixed(1)}
              </span>
              <span className="text-sm text-[var(--color-text-secondary)]">
                ({reviews.length} verified review{reviews.length !== 1 ? "s" : ""})
              </span>
            </div>
          )}

          {/* Price Section */}
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-extrabold text-[var(--color-text-primary)]">
              {"\u20B9"}
              {price.toLocaleString()}
            </span>
            {comparePrice && (
              <>
                <span className="text-lg text-[var(--color-text-tertiary)] line-through">
                  {"\u20B9"}
                  {comparePrice.toLocaleString()}
                </span>
                <span className="rounded-full bg-[var(--color-accent-warm)]/15 px-2.5 py-0.5 text-xs font-bold text-[var(--color-accent-warm)]">
                  {discount}% OFF
                </span>
              </>
            )}
            <span className="text-xs text-[var(--color-text-tertiary)]">(Inclusive of all taxes)</span>
          </div>

          {/* Variant Selector & Size Chart Modal */}
          {product.variants.length > 1 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                  Available Options
                </p>
                <button
                  onClick={() => setShowSizeChart(true)}
                  className="flex items-center gap-1 text-xs font-semibold text-[var(--color-accent)] hover:underline"
                >
                  <Ruler size={13} /> Size Chart
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v: any, idx: number) => {
                  const label =
                    v.attributes?.map((a: any) => a.value).join(" / ") ?? `Option ${idx + 1}`;
                  return (
                    <button
                      key={v.id}
                      onClick={() => {
                        setSelectedVariantIdx(idx);
                        setSelectedImage(0);
                        setQuantity(1);
                      }}
                      className={`rounded-xl border px-3.5 py-2 text-xs font-medium transition-all ${
                        selectedVariantIdx === idx
                          ? "border-[var(--color-accent)] bg-[var(--color-accent-light)] text-[var(--color-accent)] font-bold shadow-sm"
                          : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Variant Attributes details */}
          {attributes.length > 0 && (
            <div className="flex flex-wrap gap-x-6 gap-y-1.5 py-2 border-y border-[var(--color-border)]">
              {attributes.map((attr: any) => (
                <div key={attr.id ?? attr.key} className="text-xs">
                  <span className="text-[var(--color-text-tertiary)]">{attr.key}: </span>
                  <span className="font-semibold text-[var(--color-text-primary)]">{attr.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Stock Availability */}
          <div className="text-sm">
            {stock > 0 ? (
              <span className="text-emerald-600 font-semibold flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                In Stock & Ready to Ship ({stock} left)
              </span>
            ) : (
              <span className="text-red-500 font-semibold">✕ Out of Stock</span>
            )}
          </div>

          {/* Quantity + Add to Cart + Buy Now + Wishlist */}
          <div className="flex items-center gap-3 pt-2 flex-wrap sm:flex-nowrap">
            <div className="flex items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] overflow-hidden">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="flex h-11 w-11 items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)] transition-colors"
              >
                <Minus size={16} />
              </button>
              <span className="flex h-11 w-12 items-center justify-center text-sm font-bold text-[var(--color-text-primary)] border-x border-[var(--color-border)]">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(Math.min(stock, quantity + 1))}
                disabled={quantity >= stock}
                className="flex h-11 w-11 items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)] transition-colors disabled:opacity-40"
              >
                <Plus size={16} />
              </button>
            </div>

            <button
              onClick={handleAddToCart}
              disabled={stock === 0 || cartLoading}
              className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3 px-4 text-sm font-semibold transition-all ${
                addedToCart
                  ? "bg-emerald-500 text-white"
                  : "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] shadow-md"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {addedToCart ? (
                <>
                  <Check size={16} /> Added to Cart
                </>
              ) : (
                <>
                  <ShoppingCart size={16} /> {cartLoading ? "Adding..." : "Add to Cart"}
                </>
              )}
            </button>

            <button
              onClick={handleBuyNow}
              disabled={stock === 0 || cartLoading}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 px-4 text-sm font-semibold bg-[var(--color-accent)] text-white hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              Buy Now
            </button>

            <button
              onClick={handleWishlistToggle}
              title={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                isWishlisted
                  ? "border-red-300 bg-red-50 text-red-500"
                  : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-red-500 hover:border-red-300"
              }`}
            >
              <Heart size={18} className={isWishlisted ? "fill-current" : ""} />
            </button>
          </div>

          {/* Pincode Availability & Estimated Delivery Date */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-text-primary)]">
              <MapPin size={14} className="text-[var(--color-accent)]" /> Delivery Availability & Time
            </div>
            <form onSubmit={handlePincodeCheck} className="flex gap-2">
              <input
                type="text"
                placeholder="Enter 6-digit PIN code"
                maxLength={6}
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-3 py-2 text-xs outline-none focus:border-[var(--color-accent)]"
              />
              <button
                type="submit"
                className="rounded-xl bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-colors"
              >
                Check
              </button>
            </form>

            {pincodeStatus && (
              <div
                className={`text-xs p-2.5 rounded-xl flex items-center gap-2 ${
                  pincodeStatus.valid
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                    : "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
                }`}
              >
                {pincodeStatus.valid ? <PackageCheck size={14} /> : null}
                <span>{pincodeStatus.message}</span>
              </div>
            )}
          </div>

          {/* Trust Guarantees & Warranty Badges */}
          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[var(--color-border)]">
            <div className="text-center p-2 rounded-xl bg-[var(--color-bg-muted)]/40">
              <Truck size={18} className="mx-auto text-[var(--color-accent)] mb-1" />
              <p className="text-xs font-bold text-[var(--color-text-primary)]">Free Delivery</p>
              <p className="text-[10px] text-[var(--color-text-tertiary)]">Orders above ₹499</p>
            </div>
            <div className="text-center p-2 rounded-xl bg-[var(--color-bg-muted)]/40">
              <RotateCcw size={18} className="mx-auto text-[var(--color-accent)] mb-1" />
              <p className="text-xs font-bold text-[var(--color-text-primary)]">7-Day Returns</p>
              <p className="text-[10px] text-[var(--color-text-tertiary)]">Hassle-free exchange</p>
            </div>
            <div className="text-center p-2 rounded-xl bg-[var(--color-bg-muted)]/40">
              <Award size={18} className="mx-auto text-[var(--color-accent)] mb-1" />
              <p className="text-xs font-bold text-[var(--color-text-primary)]">1-Yr Warranty</p>
              <p className="text-[10px] text-[var(--color-text-tertiary)]">100% Genuine product</p>
            </div>
          </div>

          {/* Description */}
          {product.description && (
            <div className="pt-4 border-t border-[var(--color-border)]">
              <h3 className="text-sm font-bold text-[var(--color-text-primary)] mb-2">Description</h3>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-line">
                {product.description}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Frequently Bought Together Bundle Widget */}
      {bundleCompanion && bundleVariant && (
        <div className="mt-14 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={18} className="text-[var(--color-accent-warm)]" />
            <h3 className="text-base font-bold text-[var(--color-text-primary)]">
              Frequently Bought Together
            </h3>
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              Save 5% on bundle
            </span>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap">
              {/* Product 1 */}
              <div className="flex items-center gap-3">
                <div className="h-16 w-16 rounded-xl overflow-hidden bg-[var(--color-bg-muted)] shrink-0 border border-[var(--color-border)]">
                  {images[0]?.url ? (
                    <img src={images[0].url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    "📦"
                  )}
                </div>
                <div>
                  <p className="text-xs font-bold text-[var(--color-text-primary)] line-clamp-1 max-w-[180px]">
                    {product.name}
                  </p>
                  <p className="text-xs font-semibold text-[var(--color-accent)]">
                    ₹{price.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="text-xl font-bold text-[var(--color-text-tertiary)]">+</div>

              {/* Product 2 */}
              <div className="flex items-center gap-3">
                <div className="h-16 w-16 rounded-xl overflow-hidden bg-[var(--color-bg-muted)] shrink-0 border border-[var(--color-border)]">
                  {bundleVariant.images?.[0]?.url ? (
                    <img
                      src={bundleVariant.images[0].url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    "📦"
                  )}
                </div>
                <div>
                  <p className="text-xs font-bold text-[var(--color-text-primary)] line-clamp-1 max-w-[180px]">
                    {bundleCompanion.name}
                  </p>
                  <p className="text-xs font-semibold text-[var(--color-accent)]">
                    ₹{bundlePrice.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Bundle Action */}
            <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-[var(--color-border)] pt-4 md:pt-0 md:pl-6 w-full md:w-auto justify-between md:justify-end">
              <div>
                <p className="text-xs text-[var(--color-text-tertiary)]">Bundle Total</p>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-extrabold text-[var(--color-text-primary)]">
                    ₹{bundleCombinedPrice.toLocaleString()}
                  </span>
                  <span className="text-xs text-[var(--color-text-tertiary)] line-through">
                    ₹{(price + bundlePrice).toLocaleString()}
                  </span>
                </div>
              </div>

              <button
                onClick={handleAddBundle}
                disabled={cartLoading}
                className="flex items-center gap-1.5 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-all shadow-sm"
              >
                {addedBundle ? <Check size={14} /> : <ShoppingCart size={14} />}
                {addedBundle ? "Bundle Added!" : "Add Both to Cart"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Related Products Recommendation Carousel/Grid */}
      {relatedProducts.length > 0 && (
        <div className="mt-14 pt-10 border-t border-[var(--color-border)]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
                Related Products
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                Customers who viewed this also loved these
              </p>
            </div>
            <Link
              href={`/products?categoryId=${product.categoryId}`}
              className="text-xs font-bold text-[var(--color-accent)] hover:underline"
            >
              View More →
            </Link>
          </div>

          <div className="product-grid">
            {relatedProducts.slice(0, 4).map((rel) => (
              <ProductCard key={rel.id} product={rel} />
            ))}
          </div>
        </div>
      )}

      {/* Reviews Section */}
      <div className="mt-14 border-t border-[var(--color-border)] pt-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
            Customer Reviews
            {reviews.length > 0 && (
              <span className="ml-2 text-sm font-normal text-[var(--color-text-secondary)]">
                ({reviews.length})
              </span>
            )}
          </h2>
          {isAuthenticated && (
            <button
              onClick={() => setShowReviewForm(!showReviewForm)}
              className="text-sm font-semibold text-[var(--color-accent)] hover:underline"
            >
              {showReviewForm ? "Cancel" : "Write a Review"}
            </button>
          )}
        </div>

        {/* Review Form */}
        {showReviewForm && (
          <div className="mb-8 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5 space-y-4 shadow-sm animate-in fade-in">
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-secondary)] mb-2 block">
                Your Rating
              </label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button key={s} onClick={() => setReviewRating(s)}>
                    <Star
                      size={24}
                      className={
                        s <= reviewRating
                          ? "fill-amber-400 text-amber-400"
                          : "text-gray-300 hover:text-amber-300"
                      }
                    />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-secondary)] mb-2 block">
                Your Review
              </label>
              <textarea
                value={reviewBody}
                onChange={(e) => setReviewBody(e.target.value)}
                rows={4}
                placeholder="Share your experience with this product..."
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-muted)] p-3 text-sm outline-none resize-none focus:border-[var(--color-accent)]"
              />
            </div>
            <button
              onClick={() => submitReviewMutation.mutate({ rating: reviewRating, body: reviewBody })}
              disabled={!reviewBody.trim() || submitReviewMutation.isPending}
              className="btn-primary disabled:opacity-50"
            >
              {submitReviewMutation.isPending ? "Submitting..." : "Submit Review"}
            </button>
          </div>
        )}

        {/* Reviews List */}
        {reviews.length === 0 ? (
          <div className="py-12 text-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)]">
            <Star size={32} className="mx-auto text-[var(--color-text-tertiary)] mb-3" />
            <p className="text-sm font-medium text-[var(--color-text-primary)]">No reviews yet</p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">
              Be the first to share your experience with this item.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {review.user?.fullName ?? "Customer"}
                    </p>
                    <div className="flex gap-0.5 mt-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={12}
                          className={
                            s <= review.rating ? "fill-amber-400 text-amber-400" : "text-gray-300"
                          }
                        />
                      ))}
                    </div>
                  </div>
                  <span className="text-xs text-[var(--color-text-tertiary)]">
                    {new Date(review.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
                {review.body && (
                  <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mt-2">
                    {review.body}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      <ProductLightboxModal
        images={images}
        initialIndex={selectedImage}
        isOpen={showLightbox}
        onClose={() => setShowLightbox(false)}
        productName={product.name}
      />

      {/* Size Chart Modal */}
      <SizeChartModal
        isOpen={showSizeChart}
        onClose={() => setShowSizeChart(false)}
        productType={product.category?.name}
      />
    </div>
  );
}