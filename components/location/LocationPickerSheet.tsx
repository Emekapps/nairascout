'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion, useDragControls, type PanInfo } from 'motion/react';
import { Check, Clock, MapPin, Search, X } from 'lucide-react';
import { NIGERIAN_STATES_SEED } from '@/lib/constants/nigeria-and-categories';

export const RECENT_STATES_STORAGE_KEY = 'nairascout_recent_states_v1';
const MAX_RECENT_STATES = 3;

function readRecentStates(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_STATES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .slice(0, MAX_RECENT_STATES);
  } catch {
    return [];
  }
}

function writeRecentStates(states: string[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      RECENT_STATES_STORAGE_KEY,
      JSON.stringify(states.slice(0, MAX_RECENT_STATES))
    );
  } catch {
    // Ignore storage quota errors
  }
}

interface LocationPickerSheetProps {
  open: boolean;
  selectedLocation: string;
  states?: string[];
  onSelectLocation: (location: string) => void;
  onClose: () => void;
}

export function LocationPickerSheet({
  open,
  selectedLocation,
  states,
  onSelectLocation,
  onClose,
}: LocationPickerSheetProps) {
  const dragControls = useDragControls();
  const [query, setQuery] = useState('');
  const [recentStates, setRecentStates] = useState<string[]>(() => readRecentStates());

  const allStates = useMemo(() => {
    const fallback = NIGERIAN_STATES_SEED.map((s) => s.name);
    const merged = Array.from(new Set([...(states && states.length > 0 ? states : fallback)]));
    return merged.sort((a, b) => a.localeCompare(b));
  }, [states]);

  const trimmed = query.trim().toLowerCase();

  const filteredRecent = useMemo(() => {
    const validSet = new Set(allStates);
    const valid = recentStates.filter((s) => validSet.has(s));
    if (!trimmed) return valid;
    return valid.filter((s) => s.toLowerCase().includes(trimmed));
  }, [recentStates, allStates, trimmed]);

  const filteredStates = useMemo(() => {
    if (!trimmed) return allStates;
    return allStates.filter((s) => s.toLowerCase().includes(trimmed));
  }, [allStates, trimmed]);

  const showAllLocationsOption = !trimmed || 'all locations'.includes(trimmed);

  const handleChoose = (nextLoc: string) => {
    if (nextLoc !== 'All') {
      const updated = [nextLoc, ...recentStates.filter((s) => s !== nextLoc)].slice(
        0,
        MAX_RECENT_STATES
      );
      setRecentStates(updated);
      writeRecentStates(updated);
    }
    setQuery('');
    onSelectLocation(nextLoc);
    onClose();
  };

  const handleClose = () => {
    setQuery('');
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="location-picker-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Select Location"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs flex items-end md:items-center justify-center md:p-4"
          onClick={handleClose}
        >
          <motion.div
            key="location-picker-panel"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info: PanInfo) => {
              if (info.offset.y > 90 || info.velocity.y > 450) {
                handleClose();
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-t-3xl md:rounded-2xl bg-card text-card-foreground border-t md:border border-border p-5 pb-7 flex flex-col max-h-[85vh] shadow-xl"
          >
            {/* Top Drag Handle */}
            <div
              onPointerDown={(e) => dragControls.start(e)}
              className="touch-none pt-1 pb-3 -mt-2 flex justify-center cursor-grab active:cursor-grabbing shrink-0"
            >
              <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-foreground" aria-hidden="true" />
                <h2 className="font-sans text-base font-bold text-foreground">
                  Select Location
                </h2>
              </div>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close location picker"
                className="p-2 -mr-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Smart State Search Input */}
            <div className="relative mt-3.5 shrink-0">
              <Search
                className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search 36 Nigerian states & FCT - Abuja..."
                aria-label="Search Nigerian states"
                className="w-full h-10 pl-10 pr-8 text-sm bg-background border border-input rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear state search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Scrollable Body: Recent States + All States */}
            <div className="mt-4 overflow-y-auto flex-1 space-y-5 pr-0.5">
              {filteredRecent.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-sans font-semibold uppercase tracking-wider text-muted-foreground px-1">
                    <Clock className="w-3 h-3" aria-hidden="true" />
                    <span>Recent States</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {filteredRecent.map((stateName) => {
                      const active = selectedLocation === stateName;
                      return (
                        <button
                          key={`recent-${stateName}`}
                          type="button"
                          onClick={() => handleChoose(stateName)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                            active
                              ? 'bg-primary text-primary-foreground border-primary-border'
                              : 'bg-secondary text-secondary-foreground border-border hover:bg-muted'
                          }`}
                        >
                          <MapPin className="w-3 h-3 shrink-0" aria-hidden="true" />
                          <span>{stateName}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <p className="text-[11px] font-sans font-semibold uppercase tracking-wider text-muted-foreground px-1 pb-1">
                  All Nigerian States &amp; FCT
                </p>

                {showAllLocationsOption && (
                  <button
                    type="button"
                    onClick={() => handleChoose('All')}
                    className={`w-full px-3 py-2.5 rounded-xl flex items-center justify-between text-left text-sm transition-colors cursor-pointer ${
                      selectedLocation === 'All'
                        ? 'bg-accent text-accent-foreground font-semibold'
                        : 'text-foreground hover:bg-muted/70'
                    }`}
                  >
                    <span>All Locations</span>
                    {selectedLocation === 'All' && (
                      <Check className="w-4 h-4 text-success shrink-0" aria-hidden="true" />
                    )}
                  </button>
                )}

                {filteredStates.length === 0 && !showAllLocationsOption ? (
                  <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                    No Nigerian state matching &ldquo;{query.trim()}&rdquo;.
                  </p>
                ) : (
                  filteredStates.map((stateName) => {
                    const active = selectedLocation === stateName;
                    return (
                      <button
                        key={stateName}
                        type="button"
                        onClick={() => handleChoose(stateName)}
                        className={`w-full px-3 py-2.5 rounded-xl flex items-center justify-between text-left text-sm transition-colors cursor-pointer ${
                          active
                            ? 'bg-accent text-accent-foreground font-semibold'
                            : 'text-foreground hover:bg-muted/70'
                        }`}
                      >
                        <span>{stateName}</span>
                        {active && (
                          <Check className="w-4 h-4 text-success shrink-0" aria-hidden="true" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
