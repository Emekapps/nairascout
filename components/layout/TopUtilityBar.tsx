'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Bell,
  Loader2,
  LogIn,
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
  PlatformNotification,
} from '@/lib/nairascout-store';
import { formatWholeNaira } from '@/lib/commission-engine';
import { UserAvatar } from '@/components/shared/UserAvatar';

interface TopUtilityBarProps {
  searchQuery: string;
  selectedLocation: string;
  onSearchChange: (q: string) => void;
  onSearchSubmit: () => void;
  onOpenLocationPicker: () => void;
  onOpenMobileSearch: () => void;
  onSelectSearchProduct?: (product: GlobalSearchProductHit) => void;
  onSelectSearchCategory?: (category: GlobalSearchCategoryHit) => void;
  onSelectSearchPerson?: (person: GlobalSearchPersonHit) => void;
  onSelectHome: () => void;
  onOpenGuide: () => void;
  notifications: PlatformNotification[];
  authenticated: boolean;
}

type FlatSearchItem =
  | { kind: 'product'; key: string; item: GlobalSearchProductHit }
  | { kind: 'category'; key: string; item: GlobalSearchCategoryHit }
  | { kind: 'person'; key: string; item: GlobalSearchPersonHit };

export function TopUtilityBar({
  searchQuery,
  selectedLocation,
  onSearchChange,
  onSearchSubmit,
  onOpenLocationPicker,
  onOpenMobileSearch,
  onSelectSearchProduct,
  onSelectSearchCategory,
  onSelectSearchPerson,
  onSelectHome,
  onOpenGuide,
  notifications,
  authenticated,
}: TopUtilityBarProps) {
  const [noticesOpen, setNoticesOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<GlobalSearchResponse | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const noticesContainerRef = useRef<HTMLDivElement | null>(null);

  const trimmedQuery = searchQuery.trim();

  // Click-outside dismissal for both search dropdown and notices popover
  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (searchContainerRef.current && !searchContainerRef.current.contains(target)) {
        setDropdownOpen(false);
      }
      if (noticesContainerRef.current && !noticesContainerRef.current.contains(target)) {
        setNoticesOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  // Debounced server search when >= 3 characters are typed
  useEffect(() => {
    if (trimmedQuery.length < 3) {
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
  }, [trimmedQuery]);

  const { flatItems, flatIndexByKey } = useMemo(() => {
    if (!searchResults || trimmedQuery.length < 3) {
      return { flatItems: [] as FlatSearchItem[], flatIndexByKey: new Map<string, number>() };
    }
    const list: FlatSearchItem[] = [];
    for (const p of searchResults.products) {
      list.push({ kind: 'product', key: `product-${p.id}`, item: p });
    }
    for (const c of searchResults.categories) {
      list.push({ kind: 'category', key: `category-${c.id}`, item: c });
    }
    for (const person of searchResults.people) {
      list.push({ kind: 'person', key: `person-${person.userId}`, item: person });
    }
    const indexMap = new Map<string, number>();
    list.forEach((entry, idx) => indexMap.set(entry.key, idx));
    return { flatItems: list, flatIndexByKey: indexMap };
  }, [searchResults, trimmedQuery.length]);

  const selectFlatItem = (entry: FlatSearchItem) => {
    setDropdownOpen(false);
    setActiveIndex(-1);
    if (entry.kind === 'product') {
      onSelectSearchProduct?.(entry.item);
    } else if (entry.kind === 'category') {
      onSelectSearchCategory?.(entry.item);
    } else {
      onSelectSearchPerson?.(entry.item);
    }
  };

  const handleInputChange = (val: string) => {
    onSearchChange(val);
    setDropdownOpen(true);
    setActiveIndex(-1);
    if (val.trim().length < 3) {
      setSearching(false);
      setSearchResults(null);
    } else {
      setSearching(true);
    }
  };

  const handleClearSearch = () => {
    onSearchChange('');
    setSearching(false);
    setSearchResults(null);
    setActiveIndex(-1);
    setDropdownOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setDropdownOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (!dropdownOpen || trimmedQuery.length < 3) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (flatItems.length > 0) {
        setActiveIndex((prev) => (prev + 1) % flatItems.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (flatItems.length > 0) {
        setActiveIndex((prev) => (prev <= 0 ? flatItems.length - 1 : prev - 1));
      }
    } else if (e.key === 'Enter' && activeIndex >= 0 && flatItems[activeIndex]) {
      e.preventDefault();
      selectFlatItem(flatItems[activeIndex]);
    }
  };

  const showDropdown = dropdownOpen && trimmedQuery.length > 0;
  const hasAnyResults =
    Boolean(searchResults) &&
    (searchResults!.products.length > 0 ||
      searchResults!.categories.length > 0 ||
      searchResults!.people.length > 0);

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 sm:gap-5">
        {/* Mobile Brand Wordmark */}
        <button
          type="button"
          onClick={onSelectHome}
          className="md:hidden shrink-0 cursor-pointer"
        >
          <span className="font-brand font-extrabold text-xl tracking-tight text-foreground">
            NairaScout
          </span>
        </button>

        {/* Global Smart Search + Location Trigger (Desktop) */}
        <div className="hidden md:flex flex-1 max-w-xl items-center gap-2">
          <div ref={searchContainerRef} className="flex-1 min-w-0 relative">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (activeIndex >= 0 && flatItems[activeIndex]) {
                  selectFlatItem(flatItems[activeIndex]);
                } else {
                  setDropdownOpen(false);
                  onSearchSubmit();
                }
              }}
              className="relative"
            >
              <Search
                className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={showDropdown}
                aria-controls="global-smart-search-listbox"
                value={searchQuery}
                onFocus={() => setDropdownOpen(true)}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search products, categories, or scouts..."
                aria-label="Search products, categories, or scouts"
                className="w-full h-10 pl-10 pr-8 text-sm bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </form>

          {showDropdown && (
            <div
              id="global-smart-search-listbox"
              role="listbox"
              aria-label="Smart search suggestions"
              className="absolute left-0 right-0 mt-2 z-50 bg-popover text-popover-foreground border border-border rounded-2xl shadow-xl overflow-hidden max-h-[75vh] overflow-y-auto"
            >
              {trimmedQuery.length < 3 ? (
                <p className="px-4 py-3 text-xs text-muted-foreground">
                  Type at least 3 characters to search...
                </p>
              ) : searching && !searchResults ? (
                <div className="px-4 py-4 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  Searching NairaScout...
                </div>
              ) : !hasAnyResults ? (
                <div className="px-4 py-4 space-y-1">
                  <p className="text-xs font-medium text-foreground">
                    No matches for &ldquo;{trimmedQuery}&rdquo;
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Press Enter to filter the Marketplace Feed directly.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {searchResults!.products.length > 0 && (
                    <div className="p-2">
                      <div className="px-2 py-1 flex items-center justify-between">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Products
                        </span>
                        {searching && (
                          <Loader2
                            className="w-3 h-3 animate-spin text-muted-foreground"
                            aria-hidden="true"
                          />
                        )}
                      </div>
                      <div className="space-y-0.5">
                        {searchResults!.products.map((p) => {
                          const idx = flatIndexByKey.get(`product-${p.id}`) ?? -1;
                          const isSelected = activeIndex === idx;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              role="option"
                              aria-selected={isSelected}
                              onMouseEnter={() => setActiveIndex(idx)}
                              onClick={() =>
                                selectFlatItem({ kind: 'product', key: `product-${p.id}`, item: p })
                              }
                              className={`w-full px-2.5 py-2 rounded-xl flex items-center gap-3 text-left transition-colors cursor-pointer ${
                                isSelected ? 'bg-muted' : 'hover:bg-muted/60'
                              }`}
                            >
                              <div className="w-10 h-10 rounded-lg bg-muted border border-border overflow-hidden shrink-0 flex items-center justify-center">
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
                                <p className="font-sans text-xs font-semibold text-foreground truncate">
                                  {p.title}
                                </p>
                                <p className="text-[11px] text-muted-foreground truncate">
                                  {p.sellerName} · {p.category}
                                </p>
                              </div>
                              <span className="font-numeric text-xs font-bold text-foreground tabular-nums shrink-0">
                                {formatWholeNaira(p.priceKobo)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {searchResults!.categories.length > 0 && (
                    <div className="p-2">
                      <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Categories
                      </p>
                      <div className="space-y-0.5">
                        {searchResults!.categories.map((cat) => {
                          const idx = flatIndexByKey.get(`category-${cat.id}`) ?? -1;
                          const isSelected = activeIndex === idx;
                          return (
                            <button
                              key={cat.id}
                              type="button"
                              role="option"
                              aria-selected={isSelected}
                              onMouseEnter={() => setActiveIndex(idx)}
                              onClick={() =>
                                selectFlatItem({
                                  kind: 'category',
                                  key: `category-${cat.id}`,
                                  item: cat,
                                })
                              }
                              className={`w-full px-2.5 py-2 rounded-xl flex items-center justify-between gap-2 text-left transition-colors cursor-pointer ${
                                isSelected ? 'bg-muted' : 'hover:bg-muted/60'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                                  <Tag
                                    className="w-3.5 h-3.5 text-secondary-foreground"
                                    aria-hidden="true"
                                  />
                                </span>
                                <span className="font-sans text-xs font-semibold text-foreground truncate">
                                  {cat.name}
                                </span>
                              </div>
                              <span className="text-[11px] text-muted-foreground shrink-0">
                                Filter feed
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {searchResults!.people.length > 0 && (
                    <div className="p-2">
                      <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Scouts &amp; Sellers
                      </p>
                      <div className="space-y-0.5">
                        {searchResults!.people.map((person) => {
                          const idx = flatIndexByKey.get(`person-${person.userId}`) ?? -1;
                          const isSelected = activeIndex === idx;
                          return (
                            <button
                              key={person.userId}
                              type="button"
                              role="option"
                              aria-selected={isSelected}
                              onMouseEnter={() => setActiveIndex(idx)}
                              onClick={() =>
                                selectFlatItem({
                                  kind: 'person',
                                  key: `person-${person.userId}`,
                                  item: person,
                                })
                              }
                              className={`w-full px-2.5 py-2 rounded-xl flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                                isSelected ? 'bg-muted' : 'hover:bg-muted/60'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <UserAvatar
                                  avatarUrl={person.avatarUrl || person.sellerLogoUrl}
                                  displayName={person.displayName}
                                  username={person.username}
                                  size="sm"
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="font-sans text-xs font-semibold text-foreground truncate">
                                      {person.displayName}
                                    </span>
                                    {person.isSeller && (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-accent text-accent-foreground text-[10px] font-semibold shrink-0">
                                        <Store className="w-2.5 h-2.5" aria-hidden="true" />
                                        Seller
                                      </span>
                                    )}
                                  </div>
                                  <p className="font-sans text-[11px] text-muted-foreground truncate">
                                    @{person.username}
                                    {person.locationState ? ` · ${person.locationState}` : ''}
                                  </p>
                                </div>
                              </div>
                              <User
                                className="w-3.5 h-3.5 text-muted-foreground shrink-0"
                                aria-hidden="true"
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          </div>

          <button
            type="button"
            onClick={onOpenLocationPicker}
            aria-label={`Select location (${
              selectedLocation === 'All' ? 'All Locations' : selectedLocation
            })`}
            className={`inline-flex items-center gap-1.5 h-10 px-3 rounded-xl border text-xs font-semibold shrink-0 transition-colors cursor-pointer ${
              selectedLocation !== 'All'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-foreground hover:bg-muted'
            }`}
          >
            <MapPin className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="hidden lg:inline max-w-[110px] truncate">
              {selectedLocation === 'All' ? 'All Locations' : selectedLocation}
            </span>
          </button>
        </div>

        {/* Right Utility Cluster: Mobile Search (left of Bell) + Notifications (+ Desktop Sign In when logged out) */}
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <button
            type="button"
            onClick={onOpenMobileSearch}
            aria-label="Open search"
            className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <Search className="w-4 h-4" aria-hidden="true" />
          </button>

          {/* Notifications Bell wired to PostgreSQL notifications */}
          <div ref={noticesContainerRef} className="relative">
            <button
              type="button"
              onClick={() => setNoticesOpen((prev) => !prev)}
              aria-label={`Notifications (${notifications.length})`}
              aria-expanded={noticesOpen}
              className="relative inline-flex items-center justify-center w-10 h-10 rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <Bell className="w-4 h-4" aria-hidden="true" />
              {notifications.length > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute top-2 right-2 w-2 h-2 rounded-full bg-success"
                />
              )}
            </button>

            {noticesOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-popover text-popover-foreground border border-border rounded-2xl shadow-lg p-3 z-50 space-y-2">
                <div className="flex items-center justify-between px-1 pb-2 border-b border-border">
                  <span className="font-sans text-xs font-bold text-foreground">
                    Notices ({notifications.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setNoticesOpen(false);
                      onOpenGuide();
                    }}
                    className="text-[11px] font-semibold text-foreground hover:underline cursor-pointer"
                  >
                    Open Trust &amp; Guide
                  </button>
                </div>
                {notifications.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    No active notifications.
                  </p>
                ) : (
                  <div className="max-h-64 overflow-y-auto divide-y divide-border">
                    {notifications.slice(0, 5).map((n) => (
                      <div key={n.id} className="py-2.5 px-1 space-y-0.5">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span className="font-sans uppercase font-semibold">{n.category}</span>
                          <span className="font-numeric tabular-nums">{n.createdAt.slice(0, 10)}</span>
                        </div>
                        <p className="text-xs font-semibold text-foreground">{n.title}</p>
                        <p className="text-[11px] text-muted-foreground line-clamp-2">{n.body}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {!authenticated && (
            <Link
              href="/auth/login"
              className="hidden md:inline-flex items-center gap-1.5 h-10 px-3.5 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-lg hover:bg-primary/90 transition-colors whitespace-nowrap"
            >
              <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
