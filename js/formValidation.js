import { toDateKey } from './rngCreator.js';
import { Difficulty } from './difficulties.js';
import { getDifficulty, getPlayDateKey, setDifficulty } from './storage.js';

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
 * Legacy `?difficulty=` links: persist once, then strip from the URL.
 * @param {URLSearchParams} urlParams
 */
function migrateDifficultyFromQuery(urlParams) {
    const raw = urlParams.get('difficulty');
    if (raw !== null && isKnownDifficulty(raw)) {
        setDifficulty(raw);
    }
}

function stripDifficultyFromUrl() {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('difficulty')) {
        return;
    }
    url.searchParams.delete('difficulty');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
}

/**
 * @param {string} date YYYY-MM-DD
 * @returns {string}
 */
function difficultyForDate(date) {
    if (date === toDateKey()) {
        return Difficulty.EASY.name;
    }
    return getDifficulty().name;
}

/**
 * @param {string} date YYYY-MM-DD
 * @returns {string}
 */
export function playUrlForDate(date) {
    const url = new URL(window.location.href);
    url.searchParams.delete('difficulty');
    if (date === toDateKey()) {
        url.searchParams.delete('date');
    } else {
        url.searchParams.set('date', date);
    }
    return url.pathname + url.search + url.hash;
}

/**
 * @param {string} date YYYY-MM-DD
 * @param {'push' | 'replace'} [method='replace']
 */
export function syncUrlForDate(date, method = 'replace') {
    const target = playUrlForDate(date);
    if (method === 'push') {
        history.pushState(null, '', target);
    } else {
        history.replaceState(null, '', target);
    }
}

/**
 * Rewrite the URL for the active play date — no navigation, so the board survives.
 * Today uses the bare index URL; archive days use `?date=`. Difficulty is never in the URL.
 * @param {string} date YYYY-MM-DD
 */
export function redirectToQuery(date) {
    syncUrlForDate(date, 'replace');
}

/**
 * Previous play date + difficulty from storage (what the player was on before a bad URL edit).
 * @returns {{ date: string, difficulty: string }}
 */
function getPreviousQuery() {
    const previousDate = getPlayDateKey();
    const date = isValidDateKey(previousDate) ? previousDate : toDateKey();
    return { date, difficulty: difficultyForDate(date) };
}

/**
 * True only for F5 / reload-button / same-URL Enter — not for editing `?date=`.
 * @returns {boolean}
 */
function isPageReload() {
    const nav = performance.getEntriesByType('navigation')[0];
    if (nav) {
        return nav.type === 'reload';
    }

    return performance.navigation?.type === 1;
}

/**
 * Parse URL query.
 * Date comes from `?date=` (missing → today); difficulty comes from localStorage
 * on archive days and is always Easy when loading today.
 * Invalid date values restore the previous date from storage.
 * Changing `?date=` (a new navigation) loads that archive puzzle.
 * Reloading while `date` is not today snaps to today on Easy.
 *
 * The reload snap deliberately leaves the query alone and reports it as
 * `snappedFrom`: unsaved progress may still have to be confirmed first, and the
 * address bar must not move until that is answered.
 * @returns {{
 *   date: string,
 *   difficulty: string,
 *   wasInvalid: boolean,
 *   snappedFrom: { date: string, difficulty: string } | null,
 * }}
 */
export function resolveQuery() {
    const urlParams = new URLSearchParams(window.location.search);
    migrateDifficultyFromQuery(urlParams);
    stripDifficultyFromUrl();

    const wasInvalid = hasInvalidQueryValues(urlParams);

    if (wasInvalid) {
        const { date, difficulty } = getPreviousQuery();
        redirectToQuery(date);
        return { date, difficulty, wasInvalid: true, snappedFrom: null };
    }

    const today = toDateKey();
    const date = parseQueryDate(urlParams);
    const difficulty = difficultyForDate(date);

    if (date !== today && isPageReload()) {
        return {
            date: today,
            difficulty: Difficulty.EASY.name,
            wasInvalid: false,
            snappedFrom: { date, difficulty: difficultyForDate(date) },
        };
    }

    redirectToQuery(date);

    return {
        date,
        difficulty,
        wasInvalid: false,
        snappedFrom: null,
    };
}
