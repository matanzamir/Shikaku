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

/**
 * Convert a Date (or YYYY-MM-DD string) into a local calendar-day seed string.
 * @param {Date | string} [date]
 * @returns {string} YYYY-MM-DD in the local timezone
 */
export function toDateKey(date = new Date()) {
    if (typeof date === 'string') {
        return date;
    }

    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
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
