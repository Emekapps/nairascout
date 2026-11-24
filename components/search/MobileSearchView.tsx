'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  Loader2,
  MapPin,
  Package,
  Search,
  Store,
  Tag,
  User,
  X,
} from 'lucide-react';
import type {
  GlobalSearchCategoryHit,
  GlobalSearchPersonHit,
  GlobalSearchProductHit,
  GlobalSearchResponse,
} from '@/lib/nairascout-store';
import { formatWholeNaira } from '@/lib/commission-engine';
import { UserAvatar } from '@/components/shared/UserAvatar';

interface MobileSearchViewProps {
  open: boolean;
  searchQuery: string;
  selectedLocation: string;
  onSearchChange: (q: string) => void;
  onSearchSubmit: () => void;
  onOpenLocationPicker: () => void;
  onSelectProduct: (product: GlobalSearchProductHit) => void;
  onSelectCategory: (category: GlobalSearchCategoryHit) => void;
  onSelectPerson: (person: GlobalSearchPersonHit) => void;
  onClose: () => void;
}

export function MobileSearchView({
  open,
  searchQuery,
  selectedLocation,
  onSearchChange,
  onSearchSubmit,
  onOpenLocationPicker,
  onSelectProduct,
  onSelectCategory,
  onSelectPerson,
  onClose,
}: MobileSearchViewProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<GlobalSearchResponse | null>(null);

  const trimmedQuery = searchQuery.trim();

  useEffect(() => {
    if (!open) return;
    const focusTimer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 60);
    return () => window.clearTimeout(focusTimer);
  }, [open]);

  useEffect(() => {
    if (!open || trimmedQuery.length < 3) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmedQuery)}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          setSearching(false);
          return;
        }
        const data: GlobalSearchResponse = await res.json();
        setSearchResults(data);
        setSearching(false);
      } catch (err) {
        if ((err as { name?: string })?.name !== 'AbortError') {
          setSearching(false);
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, trimmedQuery]);

  const handleInputChange = (val: string) => {
    onSearchChange(val);
    if (val.trim().length < 3) {
      setSearching(false);
      setSearchResults(null);
    } else {
      setSearching(true);
    }
  };

  const handleClear = () => {
    onSearchChange('');
    setSearching(false);
    setSearchResults(null);
    inputRef.current?.focus();
  };

  const hasAnyResults =
    Boolean(searchResults) &&
    (searchResults!.products.length > 0 ||
      searchResults!.categories.length > 0 ||
      searchResults!.people.length > 0);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="mobile-search-view"
          role="dialog"
          aria-modal="true"
          aria-label="Search NairaScout"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          className="md:hidden fixed inset-0 z-50 bg-background text-foreground flex flex-col"
        >
          {/* Sticky Search Header */}
          <div className="h-16 px-3 border-b border-border bg-background/95 backdrop-blur-md flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close search"
              className="inline-flex items-center justify-center w-10 h-10 rounded-xl text-foreground hover:bg-muted shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            </button>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSearchSubmit();
                onClose();
              }}
              className="relative flex-1 min-w-0"
            >
              <Search
                className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                ref={inputRef}
                type="search"
                value={searchQuery}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder="Search products, categories, or scouts..."
                aria-label="Search products, categories, or scouts"
                className="w-full h-10 pl-9 pr-8 text-sm bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClear}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </form>

            <button
              type="button"
              onClick={onOpenLocationPicker}
              aria-label={`Select location (${
                selectedLocation === 'All' ? 'All Locations' : selectedLocation
              })`}
              className={`relative inline-flex items-center justify-center w-10 h-10 rounded-xl border shrink-0 transition-colors cursor-pointer ${
                selectedLocation !== 'All'
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-foreground hover:bg-muted'
              }`}
            >
              <MapPin className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          {/* Active Location Indicator Bar */}
          <div className="px-4 py-2.5 border-b border-border bg-muted/40 flex items-center justify-between gap-2 text-xs shrink-0">
            <span className="text-muted-foreground">
              Location filter:{' '}
              <span className="font-semibold text-foreground">
                {selectedLocation === 'All' ? 'All Locations' : selectedLocation}
              </span>
            </span>
            <button
              type="button"
              onClick={onOpenLocationPicker}
              className="font-semibold text-foreground hover:underline cursor-pointer"
            >
              Change State
            </button>
          </div>

          {/* Results Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {trimmedQuery.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <Search className="w-7 h-7 text-muted-foreground mx-auto" aria-hidden="true" />
                <p className="font-sans text-sm font-semibold text-foreground">
                  Search NairaScout
                </p>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  Type 3 or more characters to see instant suggestions across Products, Categories,
                  and Scouts &amp; Sellers.
                </p>
              </div>
            ) : trimmedQuery.length < 3 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                Type at least 3 characters to search...
              </p>
            ) : searching && !searchResults ? (
              <div className="py-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Searching NairaScout...
              </div>
            ) : !hasAnyResults ? (
              <div className="py-10 text-center space-y-3">
                <p className="text-sm font-medium text-foreground">
                  No matches for &ldquo;{trimmedQuery}&rdquo;
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onSearchSubmit();
                    onClose();
                  }}
                  className="px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground border border-primary-border rounded-xl cursor-pointer"
                >
                  Filter Feed for &ldquo;{trimmedQuery}&rdquo;
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {searchResults!.products.length > 0 && (
                  <section className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Products
                      </h3>
                      {searching && (
                        <Loader2
                          className="w-3.5 h-3.5 animate-spin text-muted-foreground"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                    <div className="bg-card border border-border rounded-2xl divide-y divide-border overflow-hidden">
                      {searchResults!.products.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            onSelectProduct(p);
                            onClose();
                          }}
                          className="w-full px-3.5 py-3 flex items-center gap-3 text-left hover:bg-muted/60 transition-colors cursor-pointer"
                        >
                          <div className="w-11 h-11 rounded-lg bg-muted border border-border overflow-hidden shrink-0 flex items-center justify-center">
                            {p.imageUrl ? (
                              <img
                                src={p.imageUrl}
                                alt={p.title}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Package
                                className="w-4 h-4 text-muted-foreground"
                                aria-hidden="true"
                              />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-sans text-sm font-semibold text-foreground truncate">
                              {p.title}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {p.sellerName} · {p.category}
                            </p>
                          </div>
                          <span className="font-numeric text-xs font-bold text-foreground tabular-nums shrink-0">
                            {formatWholeNaira(p.priceKobo)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {searchResults!.categories.length > 0 && (
                  <section className="space-y-2">
                    <h3 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Categories
                    </h3>
                    <div className="bg-card border border-border rounded-2xl divide-y divide-border overflow-hidden">
                      {searchResults!.categories.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            onSelectCategory(cat);
                            onClose();
                          }}
                          className="w-full px-3.5 py-3 flex items-center justify-between gap-2 text-left hover:bg-muted/60 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                              <Tag
                                className="w-4 h-4 text-secondary-foreground"
                                aria-hidden="true"
                              />
                            </span>
                            <span className="font-sans text-sm font-semibold text-foreground truncate">
                              {cat.name}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">Filter feed</span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {searchResults!.people.length > 0 && (
                  <section className="space-y-2">
                    <h3 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Scouts &amp; Sellers
                    </h3>
                    <div className="bg-card border border-border rounded-2xl divide-y divide-border overflow-hidden">
                      {searchResults!.people.map((person) => (
                        <button
                          key={person.userId}
                          type="button"
                          onClick={() => {
                            onSelectPerson(person);
                            onClose();
                          }}
                          className="w-full px-3.5 py-3 flex items-center justify-between gap-3 text-left hover:bg-muted/60 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <UserAvatar
                              avatarUrl={person.avatarUrl || person.sellerLogoUrl}
                              displayName={person.displayName}
                              username={person.username}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="font-sans text-sm font-semibold text-foreground truncate">
                                  {person.displayName}
                                </span>
                                {person.isSeller && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-accent text-accent-foreground text-[10px] font-semibold shrink-0">
                                    <Store className="w-2.5 h-2.5" aria-hidden="true" />
                                    Seller
                                  </span>
                                )}
                              </div>
                              <p className="font-sans text-xs text-muted-foreground truncate">
                                @{person.username}
                                {person.locationState ? ` · ${person.locationState}` : ''}
                              </p>
                            </div>
                          </div>
                          <User
                            className="w-4 h-4 text-muted-foreground shrink-0"
                            aria-hidden="true"
                          />
                        </button>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
