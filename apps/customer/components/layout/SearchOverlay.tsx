"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Clock, ArrowRight, Tag, Store, Sparkles, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import Link from "next/link";

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SearchOverlay({ isOpen, onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [trendingKeywords, setTrendingKeywords] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Load recent searches from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("aurazone_recent_searches");
        if (saved) setRecentSearches(JSON.parse(saved));
      } catch {
        // ignore
      }
    }
  }, [isOpen]);

  // Fetch trending keywords on open
  useEffect(() => {
    if (isOpen) {
      api.get<any>("/search/popular")
        .then((res) => {
          if (res?.data?.trendingKeywords) {
            setTrendingKeywords(res.data.trendingKeywords);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  // Auto focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 80);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      setQuery("");
      setSuggestions(null);
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Debounced live search
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.get<any>(`/search/suggestions?q=${encodeURIComponent(trimmed)}`);
        setSuggestions(res.data);
      } catch (err) {
        console.error("Autocomplete failed", err);
      } finally {
        setIsLoading(false);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [query]);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const saveRecentSearch = (term: string) => {
    if (!term.trim()) return;
    try {
      const updated = [term.trim(), ...recentSearches.filter((s) => s.toLowerCase() !== term.toLowerCase())].slice(0, 8);
      setRecentSearches(updated);
      localStorage.setItem("aurazone_recent_searches", JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const removeRecentSearch = (term: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = recentSearches.filter((s) => s !== term);
    setRecentSearches(updated);
    try {
      localStorage.setItem("aurazone_recent_searches", JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const clearAllRecent = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem("aurazone_recent_searches");
    } catch {
      // ignore
    }
  };

  const executeSearch = (searchTerm: string) => {
    if (!searchTerm.trim()) return;
    saveRecentSearch(searchTerm.trim());
    onClose();
    router.push(`/products?search=${encodeURIComponent(searchTerm.trim())}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      executeSearch(query.trim());
    }
  };

  if (!isOpen) return null;

  const hasSuggestions = suggestions && (
    (suggestions.products && suggestions.products.length > 0) ||
    (suggestions.categories && suggestions.categories.length > 0) ||
    (suggestions.brands && suggestions.brands.length > 0) ||
    (suggestions.suggestions && suggestions.suggestions.length > 0)
  );

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/60 backdrop-blur-sm animate-fadeIn">
      {/* Search Header Container */}
      <div className="w-full bg-[var(--color-bg-surface)] border-b border-[var(--color-border)] shadow-xl">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <form onSubmit={handleSubmit} className="relative flex items-center">
            <Search size={20} className="absolute left-4 text-[var(--color-text-tertiary)]" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products, brands, categories (e.g. White T-Shirt, Sneakers)..."
              className="w-full pl-12 pr-24 py-3.5 bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-2xl text-base text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/15 transition-all"
            />
            <div className="absolute right-3 flex items-center gap-1.5">
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="p-1 rounded-full text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  <X size={16} />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-[var(--color-bg-muted)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                ESC
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Results Dropdown Container */}
      <div className="flex-1 overflow-y-auto max-w-4xl w-full mx-auto p-4">
        <div className="bg-[var(--color-bg-surface)] rounded-2xl border border-[var(--color-border)] shadow-2xl p-6 min-h-[300px]">
          {isLoading && (
            <div className="flex items-center justify-center py-12 text-sm text-[var(--color-text-secondary)]">
              <div className="animate-spin h-5 w-5 border-2 border-[var(--color-accent)] border-t-transparent rounded-full mr-2.5"></div>
              Searching catalog...
            </div>
          )}

          {/* Initial State: Recent searches & Trending */}
          {!query.trim() && !isLoading && (
            <div className="space-y-6">
              {recentSearches.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] flex items-center gap-1.5">
                      <Clock size={13} /> Recent Searches
                    </h3>
                    <button
                      onClick={clearAllRecent}
                      className="text-xs text-[var(--color-accent)] hover:underline"
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((term) => (
                      <div
                        key={term}
                        onClick={() => executeSearch(term)}
                        className="group flex items-center gap-2 rounded-xl bg-[var(--color-bg-base)] border border-[var(--color-border)] px-3.5 py-2 text-xs font-medium text-[var(--color-text-primary)] hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-light)] cursor-pointer transition-colors"
                      >
                        <Clock size={12} className="text-[var(--color-text-tertiary)]" />
                        <span>{term}</span>
                        <button
                          type="button"
                          onClick={(e) => removeRecentSearch(term, e)}
                          className="opacity-40 group-hover:opacity-100 hover:text-red-500"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Trending suggestions */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] flex items-center gap-1.5 mb-3">
                  <TrendingUp size={13} /> Trending Searches
                </h3>
                <div className="flex flex-wrap gap-2">
                  {(trendingKeywords.length > 0 ? trendingKeywords : [
                    "White T-Shirt",
                    "Running Shoes",
                    "Denim Jeans",
                    "Face Serum",
                    "Wireless Earbuds",
                    "Smartwatch"
                  ]).map((term) => (
                    <button
                      key={term}
                      onClick={() => executeSearch(term)}
                      className="flex items-center gap-1.5 rounded-xl bg-[var(--color-bg-base)] border border-[var(--color-border)] px-3.5 py-2 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] transition-colors"
                    >
                      <Sparkles size={11} className="text-[var(--color-accent)]" />
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Autocomplete Results */}
          {query.trim().length >= 2 && !isLoading && hasSuggestions && (
            <div className="space-y-6">
              {/* Keyword completions */}
              {suggestions.suggestions?.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-2">
                    Suggestions
                  </h4>
                  <div className="divide-y divide-[var(--color-border)]/50 border border-[var(--color-border)] rounded-xl overflow-hidden bg-[var(--color-bg-base)]">
                    {suggestions.suggestions.slice(0, 4).map((s: string) => (
                      <button
                        key={s}
                        onClick={() => executeSearch(s)}
                        className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-left text-[var(--color-text-primary)] hover:bg-[var(--color-bg-muted)] transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <Search size={13} className="text-[var(--color-text-tertiary)]" />
                          {s}
                        </span>
                        <ArrowRight size={12} className="text-[var(--color-text-tertiary)]" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Matching Categories & Brands */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {suggestions.categories?.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-2 flex items-center gap-1">
                      <Tag size={12} /> Categories
                    </h4>
                    <div className="space-y-1">
                      {suggestions.categories.map((c: any) => (
                        <Link
                          key={c.id}
                          href={`/products?categoryId=${c.id}`}
                          onClick={onClose}
                          className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-muted)] transition-colors"
                        >
                          <span>{c.name}</span>
                          <span className="text-[10px] text-[var(--color-text-tertiary)] bg-[var(--color-bg-surface)] px-2 py-0.5 rounded-full border border-[var(--color-border)]">
                            {c.count} items
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {suggestions.brands?.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-2 flex items-center gap-1">
                      <Store size={12} /> Brands
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestions.brands.map((b: any) => (
                        <button
                          key={b.name}
                          onClick={() => executeSearch(b.name)}
                          className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-xs font-medium text-[var(--color-text-primary)] hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-light)] transition-colors"
                        >
                          {b.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Matching Products */}
              {suggestions.products?.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                      Top Products
                    </h4>
                    <button
                      onClick={() => executeSearch(query)}
                      className="text-xs font-semibold text-[var(--color-accent)] hover:underline flex items-center gap-1"
                    >
                      See all results <ArrowRight size={12} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {suggestions.products.map((prod: any) => (
                      <Link
                        key={prod.id}
                        href={`/product/${prod.slug}`}
                        onClick={() => {
                          saveRecentSearch(prod.name);
                          onClose();
                        }}
                        className="flex gap-3 rounded-xl border border-[var(--color-border)] p-3 hover:border-[var(--color-accent)] hover:bg-[var(--color-bg-muted)]/50 transition-all group"
                      >
                        <div className="h-16 w-16 rounded-lg bg-[var(--color-bg-muted)] overflow-hidden shrink-0">
                          {prod.primaryImage ? (
                            <img src={prod.primaryImage} alt={prod.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-xl">📦</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-accent)] truncate">
                            {prod.brand || prod.storeName}
                          </p>
                          <p className="text-xs font-semibold text-[var(--color-text-primary)] truncate group-hover:text-[var(--color-accent)] transition-colors">
                            {prod.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-bold text-[var(--color-text-primary)]">
                              ₹{Number(prod.price).toLocaleString()}
                            </span>
                            {prod.compareAtPrice && (
                              <span className="text-[10px] text-[var(--color-text-tertiary)] line-through">
                                ₹{Number(prod.compareAtPrice).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* No results */}
          {query.trim().length >= 2 && !isLoading && !hasSuggestions && (
            <div className="py-12 text-center">
              <Search size={36} className="mx-auto text-[var(--color-text-tertiary)] mb-3" />
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                No matching results found for "{query}"
              </p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                Try checking for typos or searching with broader keywords.
              </p>
              <button
                onClick={() => executeSearch(query)}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white"
              >
                Search all catalog anyway
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
