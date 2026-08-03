/**
 * Fold a string into an unsigned 32-bit integer seed (FNV-1a style).
 * @param {string} input
 * @returns {number}
 */
export function hashSeed(input) {
    let hash = 2166136261 >>> 0;

    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 16777619) >>> 0;
    }

    return hash >>> 0;
}

/** Earliest local puzzle day (YYYY-MM-DD). */
export const MIN_DATE_KEY = '2026-08-03';

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Format year/month/day as YYYY-MM-DD.
 * @param {number} year
 * @param {number} month 1–12
 * @param {number} day
 * @returns {string}
 */
export function formatDateKey(year, month, day) {
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Convert a Date (or YYYY-MM-DD string) into a local calendar-day seed string.
 * @param {Date | string} [date]
 * @returns {string} YYYY-MM-DD in the local timezone
 */
export function toDateKey(date = new Date()) {
    if (typeof date === 'string') {
        return date;
    }

    return formatDateKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/**
 * True if year/month/day form a real local calendar day (rejects e.g. Feb 30).
 * @param {number} year
 * @param {number} month 1–12
 * @param {number} day
 * @returns {boolean}
 */
export function isRealCalendarDay(year, month, day) {
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
        return false;
    }

    const candidate = new Date(year, month - 1, day);
    return (
        candidate.getFullYear() === year &&
        candidate.getMonth() === month - 1 &&
        candidate.getDate() === day
    );
}

/**
 * Parse YYYY-MM-DD into a local calendar Date, or null if invalid.
 * Uses midday local time to reduce DST edge cases.
 * @param {string} key
 * @returns {Date | null}
 */
export function parseDateKey(key) {
    if (typeof key !== 'string') {
        return null;
    }

    const match = DATE_KEY_PATTERN.exec(key);
    if (!match) {
        return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (!isRealCalendarDay(year, month, day)) {
        return null;
    }

    return new Date(year, month - 1, day, 12, 0, 0, 0);
}

/**
 * Playable archive range: real calendar day from launch through local today.
 * @param {string} key YYYY-MM-DD
 * @returns {boolean}
 */
export function isValidDateKey(key) {
    if (parseDateKey(key) === null) {
        return false;
    }

    const todayKey = toDateKey();
    return key >= MIN_DATE_KEY && key <= todayKey;
}

/**
 * @param {{ year: number, month: number, day: number }} date
 * @returns {boolean}
 */
export function validateDate({ year, month, day }) {
    return isValidDateKey(formatDateKey(year, month, day));
}

/**
 * Mulberry32: tiny deterministic PRNG from a 32-bit seed.
 * @param {number} seed
 * @returns {() => number} next float in [0, 1)
 */
export function mulberry32(seed) {
    let state = seed >>> 0;

    return function next() {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Build a seeded RNG from a calendar day and difficulty.
 * @param {Date | string} [date]
 * @param {string} difficulty
 * @returns {() => number}
 */
export function createSeededRng(date = new Date(), difficulty) {
    const dateKey = toDateKey(date);
    const seedInput = `${dateKey}:${difficulty}`;
    return mulberry32(hashSeed(seedInput));
}
