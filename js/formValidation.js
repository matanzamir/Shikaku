import { toDateKey } from './rngCreator.js';
import { Difficulty } from './difficulties.js';

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
 * @param {string | null} name
 * @returns {boolean}
 */
function isKnownDifficulty(name) {
    return Object.values(Difficulty).some((d) => d.name === name);
}

/**
 * True when a present query value cannot be used as-is.
 * Missing params are fine (defaults apply).
 * @param {URLSearchParams} urlParams
 * @returns {boolean}
 */
function hasInvalidQueryValues(urlParams) {
    const rawDate = urlParams.get('date');
    if (rawDate !== null && !isValidDateKey(toDateKey(rawDate))) {
        return true;
    }

    const rawDifficulty = urlParams.get('difficulty');
    if (rawDifficulty !== null && !isKnownDifficulty(rawDifficulty)) {
        return true;
    }

    return false;
}

/**
 * Read date from query params. Missing → today. Invalid / out of range → today.
 * @param {URLSearchParams} urlParams
 * @returns {string} YYYY-MM-DD
 */
export function parseQueryDate(urlParams) {
    const raw = urlParams.get('date');
    const dateKey = toDateKey(raw ?? new Date());
    return isValidDateKey(dateKey) ? dateKey : toDateKey();
}

/**
 * Read difficulty from query params. Missing or unknown → Easy.
 * @param {URLSearchParams} urlParams
 * @returns {string} Difficulty name (Easy / Medium / Hard)
 */
export function parseQueryDifficulty(urlParams) {
    const raw = urlParams.get('difficulty');
    return isKnownDifficulty(raw) ? raw : Difficulty.EASY.name;
}

/**
 * @param {string} date YYYY-MM-DD
 * @param {string} difficulty Difficulty name
 */
function redirectToQuery(date, difficulty) {
    const url = new URL(window.location.href);
    url.searchParams.set('date', date);
    url.searchParams.set('difficulty', difficulty);
    history.replaceState(null, '', url);
}

/**
 * Parse URL query, correcting invalid values to today's Easy puzzle.
 * On invalid insertion: updates the address bar and flags `wasInvalid` for an alert.
 * @returns {{ date: string, difficulty: string, wasInvalid: boolean }}
 */
export function resolveQuery() {
    const urlParams = new URLSearchParams(window.location.search);
    const wasInvalid = hasInvalidQueryValues(urlParams);

    if (wasInvalid) {
        const date = toDateKey();
        const difficulty = Difficulty.EASY.name;
        redirectToQuery(date, difficulty);
        return { date, difficulty, wasInvalid: true };
    }

    return {
        date: parseQueryDate(urlParams),
        difficulty: parseQueryDifficulty(urlParams),
        wasInvalid: false,
    };
}
