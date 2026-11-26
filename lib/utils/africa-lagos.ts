// NS-SCT-054 & NS-SCT-090: Authoritative Africa/Lagos (UTC+1) time & period boundary utilities

export const LAGOS_TIMEZONE = 'Africa/Lagos';
const LAGOS_OFFSET_MS = 60 * 60 * 1000; // Nigeria WAT is fixed UTC+1 (no DST)

export type StatsPeriodPreset =
  | 'today'
  | 'last_7_days'
  | 'last_30_days'
  | 'this_month'
  | 'previous_month'
  | 'custom';

/**
 * Returns YYYY-MM-DD in Africa/Lagos (UTC+1).
 */
export function toLagosDateKey(dateInput: Date | string | number): string {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  const shifted = new Date(d.getTime() + LAGOS_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats an instant into a user-friendly Africa/Lagos date string.
 */
export function formatLagosDate(dateInput: Date | string | number): string {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-NG', {
    timeZone: LAGOS_TIMEZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

/**
 * Formats an instant into an Africa/Lagos date + time string (e.g. "26 Nov 2026, 14:30 WAT").
 */
export function formatLagosDateTime(dateInput: Date | string | number): string {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '—';
  return `${new Intl.DateTimeFormat('en-NG', {
    timeZone: LAGOS_TIMEZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)} WAT`;
}

/**
 * Parses YYYY-MM-DD as start of day (00:00:00.000) in Africa/Lagos, returning UTC Date.
 */
export function lagosDayStartUtc(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  const utcMidnight = Date.UTC(y || 1970, (m || 1) - 1, d || 1, 0, 0, 0, 0);
  return new Date(utcMidnight - LAGOS_OFFSET_MS);
}

/**
 * Parses YYYY-MM-DD as end of day (23:59:59.999) in Africa/Lagos, returning UTC Date.
 */
export function lagosDayEndUtc(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  const utcEnd = Date.UTC(y || 1970, (m || 1) - 1, d || 1, 23, 59, 59, 999);
  return new Date(utcEnd - LAGOS_OFFSET_MS);
}

/**
 * Computes inclusive UTC Date bounds matching Africa/Lagos calendar presets.
 */
export function resolveLagosPeriodBounds(
  period: StatsPeriodPreset,
  customFrom?: string | null,
  customTo?: string | null,
  now = new Date()
): { start: Date; end: Date; startKey: string; endKey: string } {
  const todayKey = toLagosDateKey(now);
  const [y, m, d] = todayKey.split('-').map(Number);

  if (period === 'today') {
    return {
      start: lagosDayStartUtc(todayKey),
      end: lagosDayEndUtc(todayKey),
      startKey: todayKey,
      endKey: todayKey,
    };
  }

  if (period === 'last_7_days') {
    const startShift = new Date(Date.UTC(y, m - 1, d - 6));
    const startKey = startShift.toISOString().slice(0, 10);
    return {
      start: lagosDayStartUtc(startKey),
      end: lagosDayEndUtc(todayKey),
      startKey,
      endKey: todayKey,
    };
  }

  if (period === 'last_30_days') {
    const startShift = new Date(Date.UTC(y, m - 1, d - 29));
    const startKey = startShift.toISOString().slice(0, 10);
    return {
      start: lagosDayStartUtc(startKey),
      end: lagosDayEndUtc(todayKey),
      startKey,
      endKey: todayKey,
    };
  }

  if (period === 'this_month') {
    const startKey = `${y}-${String(m).padStart(2, '0')}-01`;
    return {
      start: lagosDayStartUtc(startKey),
      end: lagosDayEndUtc(todayKey),
      startKey,
      endKey: todayKey,
    };
  }

  if (period === 'previous_month') {
    const prevMonthFirst = new Date(Date.UTC(y, m - 2, 1));
    const prevMonthLast = new Date(Date.UTC(y, m - 1, 0));
    const startKey = prevMonthFirst.toISOString().slice(0, 10);
    const endKey = prevMonthLast.toISOString().slice(0, 10);
    return {
      start: lagosDayStartUtc(startKey),
      end: lagosDayEndUtc(endKey),
      startKey,
      endKey,
    };
  }

  // custom
  const validPattern = /^\d{4}-\d{2}-\d{2}$/;
  const startKey =
    customFrom && validPattern.test(customFrom) ? customFrom : todayKey;
  const endKey =
    customTo && validPattern.test(customTo) ? customTo : startKey;
  const orderedStart = startKey <= endKey ? startKey : endKey;
  const orderedEnd = startKey <= endKey ? endKey : startKey;

  return {
    start: lagosDayStartUtc(orderedStart),
    end: lagosDayEndUtc(orderedEnd),
    startKey: orderedStart,
    endKey: orderedEnd,
  };
}
