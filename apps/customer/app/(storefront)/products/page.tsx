"use client";

import { Suspense, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { ProductCard } from "@/components/product/ProductCard";
import {
  Search,
  SlidersHorizontal,
  X,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  Filter,
  ArrowUpDown,
  RotateCcw,
} from "lucide-react";

function ProductsContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // URL state
  const initialSearch = searchParams.get("search") || searchParams.get("q") || "";
  const initialCategory = searchParams.get("categoryId") || "";
  const initialStore = searchParams.get("storeId") || "";
  const initialBrand = searchParams.get("brand") || "";
  const initialMinPrice = searchParams.get("minPrice") || "";
  const initialMaxPrice = searchParams.get("maxPrice") || "";
  const initialInStock = searchParams.get("inStock") === "true";
  const initialSortBy = searchParams.get("sortBy") || "newest";
  const initialPage = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

  // Local filter states
  const [search, setSearch] = useState(initialSearch);
  const [storeId, setStoreId] = useState(initialStore);
  const [categoryId, setCategoryId] = useState(initialCategory);
  const [brand, setBrand] = useState(initialBrand);
  const [minPrice, setMinPrice] = useState(initialMinPrice);
  const [maxPrice, setMaxPrice] = useState(initialMaxPrice);
  const [inStock, setInStock] = useState(initialInStock);
  const [sortBy, setSortBy] = useState(initialSortBy);
  const [page, setPage] = useState(initialPage);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showFilters, setShowFilters] = useState(false);

  const pageSize = 16;
  const skip = (page - 1) * pageSize;

  // Build query string for API
  const queryParts = [
    search ? `q=${encodeURIComponent(search)}` : "",
    `sortBy=${sortBy}`,
    `skip=${skip}`,
    `take=${pageSize}`,
    storeId ? `storeId=${storeId}` : "",
    categoryId ? `categoryId=${categoryId}` : "",
    brand ? `brand=${encodeURIComponent(brand)}` : "",
    minPrice ? `minPrice=${minPrice}` : "",
    maxPrice ? `maxPrice=${maxPrice}` : "",
    inStock ? `inStock=true` : "",
  ].filter(Boolean);

  const queryStr = queryParts.join("&");

  // Query search endpoint which returns products + facets
  const { data: searchResponse, isLoading } = useQuery({
    queryKey: ["products-search", queryStr],
    queryFn: () => api.get<any>(`/products/search?${queryStr}`),
  });

  // Supporting stores & categories for filter dropdowns
  const { data: storesData } = useQuery({
    queryKey: ["stores"],
    queryFn: () => api.get<any[]>("/stores"),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<any[]>("/categories"),
  });

  const searchData = searchResponse?.data;
  const products = Array.isArray(searchData?.products) ? searchData.products : [];
  const total = searchData?.total ?? 0;
  const facets = searchData?.facets ?? {};
  const brands = (facets.brands as Array<{ name: string; count: number }>) ?? [];
  const stores = storesData?.data ?? [];
  const categories = categoriesData?.data ?? [];

  const totalPages = Math.ceil(total / pageSize);

  // Sync state to URL without full refresh
  const syncToUrl = (newPage = page) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (storeId) params.set("storeId", storeId);
    if (categoryId) params.set("categoryId", categoryId);
    if (brand) params.set("brand", brand);
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);
    if (inStock) params.set("inStock", "true");
    if (sortBy !== "newest") params.set("sortBy", sortBy);
    if (newPage > 1) params.set("page", newPage.toString());

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    syncToUrl(1);
  };

  const handleClearFilters = () => {
    setSearch("");
    setStoreId("");
    setCategoryId("");
    setBrand("");
    setMinPrice("");
    setMaxPrice("");
    setInStock(false);
    setSortBy("newest");
    setPage(1);
    router.replace(pathname, { scroll: false });
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
    syncToUrl(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const activeFilterCount = [
    storeId,
    categoryId,
    brand,
    minPrice,
    maxPrice,
    inStock ? "inStock" : "",
  ].filter(Boolean).length;

  return (
    <div className="section-container py-6">
      {/* Header & Results Count */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            {search ? `Search results for "${search}"` : "All Products"}
          </h1>
          {!isLoading && (
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Showing {total > 0 ? skip + 1 : 0}–{Math.min(skip + pageSize, total)} of {total} product
              {total !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {/* View Switcher & Sort for Desktop */}
        <div className="flex items-center gap-3">
          {/* Grid / List Switcher */}
          <div className="flex items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-1">
            <button
              onClick={() => setViewMode("grid")}
              title="Grid View"
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === "grid"
                  ? "bg-[var(--color-primary)] text-white shadow-sm"
                  : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              title="List View"
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === "list"
                  ? "bg-[var(--color-primary)] text-white shadow-sm"
                  : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              <List size={16} />
            </button>
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
            <ArrowUpDown size={14} className="text-[var(--color-text-tertiary)]" />
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
                syncToUrl(1);
              }}
              className="bg-transparent outline-none font-medium text-[var(--color-text-primary)] cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="relevance">Most Relevant</option>
              <option value="name_asc">Name: A to Z</option>
              <option value="name_desc">Name: Z to A</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
        </div>
      </div>

      {/* Control Bar: Search Input & Filter Toggle */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4 py-2.5 flex-1 min-w-[240px] max-w-lg shadow-sm focus-within:border-[var(--color-accent)] transition-colors">
          <Search size={16} className="text-[var(--color-text-tertiary)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, brand, tag, or description..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-text-tertiary)]"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setPage(1);
                syncToUrl(1);
              }}
              className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
            >
              <X size={14} />
            </button>
          )}
        </form>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
            showFilters || activeFilterCount > 0
              ? "border-[var(--color-accent)] bg-[var(--color-accent-light)] text-[var(--color-accent)]"
              : "border-[var(--color-border)] bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]"
          }`}
        >
          <SlidersHorizontal size={14} />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-accent)] text-[10px] text-white font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>

        {activeFilterCount > 0 && (
          <button
            onClick={handleClearFilters}
            className="flex items-center gap-1.5 text-xs text-[var(--color-accent)] hover:underline px-2 py-1 font-semibold"
          >
            <RotateCcw size={12} /> Clear all filters
          </button>
        )}
      </div>

      {/* Expanded Filters Drawer / Panel */}
      {showFilters && (
        <div className="mb-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border)]">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] flex items-center gap-1.5">
              <Filter size={13} /> Refine Products
            </span>
            {activeFilterCount > 0 && (
              <button
                onClick={handleClearFilters}
                className="text-xs text-[var(--color-danger)] hover:underline font-semibold"
              >
                Reset all
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* Category Filter */}
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5 block">
                Category
              </label>
              <select
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  setPage(1);
                  syncToUrl(1);
                }}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-2 text-sm outline-none text-[var(--color-text-primary)]"
              >
                <option value="">All Categories</option>
                {categories.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Brand Filter */}
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5 block">
                Brand
              </label>
              <select
                value={brand}
                onChange={(e) => {
                  setBrand(e.target.value);
                  setPage(1);
                  syncToUrl(1);
                }}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-2 text-sm outline-none text-[var(--color-text-primary)]"
              >
                <option value="">All Brands</option>
                {brands.map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.name} ({b.count})
                  </option>
                ))}
              </select>
            </div>

            {/* Store Filter */}
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5 block">
                Store
              </label>
              <select
                value={storeId}
                onChange={(e) => {
                  setStoreId(e.target.value);
                  setPage(1);
                  syncToUrl(1);
                }}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-2 text-sm outline-none text-[var(--color-text-primary)]"
              >
                <option value="">All Stores</option>
                {stores.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Price Range Filter */}
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5 block">
                Price Range (₹)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-2 text-sm outline-none"
                />
                <span className="text-[var(--color-text-tertiary)]">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-2 text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    setPage(1);
                    syncToUrl(1);
                  }}
                  className="rounded-xl bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>

          {/* In-Stock Toggle */}
          <div className="pt-2 flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={inStock}
                onChange={(e) => {
                  setInStock(e.target.checked);
                  setPage(1);
                  syncToUrl(1);
                }}
                className="h-4 w-4 rounded accent-[var(--color-primary)] cursor-pointer"
              />
              <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                In Stock Only ({facets.inStockCount ?? total})
              </span>
            </label>
          </div>
        </div>
      )}

      {/* Products Grid / List */}
      {isLoading ? (
        <div className={viewMode === "grid" ? "product-grid" : "space-y-4"}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className={viewMode === "grid" ? "aspect-[3/4] shimmer rounded-xl" : "h-40 shimmer rounded-2xl"} />
              <div className="h-3 w-3/4 shimmer rounded" />
              <div className="h-3 w-1/2 shimmer rounded" />
            </div>
          ))}
        </div>
      ) : products.length > 0 ? (
        <>
          <div className={viewMode === "grid" ? "product-grid" : "space-y-4"}>
            {products.map((product: any) => (
              <ProductCard key={product.id} product={product} viewMode={viewMode} />
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-[var(--color-border)]">
              <p className="text-xs text-[var(--color-text-secondary)]">
                Page <span className="font-bold text-[var(--color-text-primary)]">{page}</span> of{" "}
                <span className="font-bold text-[var(--color-text-primary)]">{totalPages}</span>
              </p>

              <div className="flex items-center gap-1.5">
                {/* Previous Button */}
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page <= 1}
                  className="flex items-center gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-2 text-xs font-semibold text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={14} /> Previous
                </button>

                {/* Page Number Buttons */}
                {Array.from({ length: totalPages }).map((_, idx) => {
                  const pNum = idx + 1;
                  // Show current, first, last, and within 1 of current
                  if (
                    pNum === 1 ||
                    pNum === totalPages ||
                    (pNum >= page - 1 && pNum <= page + 1)
                  ) {
                    return (
                      <button
                        key={pNum}
                        onClick={() => handlePageChange(pNum)}
                        className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-semibold transition-colors ${
                          page === pNum
                            ? "bg-[var(--color-primary)] text-white shadow-sm"
                            : "border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]"
                        }`}
                      >
                        {pNum}
                      </button>
                    );
                  }
                  if (pNum === page - 2 || pNum === page + 2) {
                    return (
                      <span key={pNum} className="px-1 text-xs text-[var(--color-text-tertiary)]">
                        ...
                      </span>
                    );
                  }
                  return null;
                })}

                {/* Next Button */}
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= totalPages}
                  className="flex items-center gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-2 text-xs font-semibold text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="py-20 text-center rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-surface)]/50">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-bg-muted)] mx-auto mb-4 text-2xl">
            🔍
          </div>
          <p className="text-lg font-bold text-[var(--color-text-primary)]">No products found</p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)] max-w-sm mx-auto">
            We couldn't find any products matching your active filters or search query.
          </p>
          <button
            onClick={handleClearFilters}
            className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary)] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-colors"
          >
            <RotateCcw size={12} /> Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="section-container py-6">
          <div className="h-8 w-48 shimmer rounded mb-6" />
          <div className="product-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <div className="aspect-[3/4] shimmer rounded-xl" />
                <div className="h-3 w-3/4 shimmer rounded" />
                <div className="h-3 w-1/2 shimmer rounded" />
              </div>
            ))}
          </div>
        </div>
      }
    >
      <ProductsContent />
    </Suspense>
  );
}