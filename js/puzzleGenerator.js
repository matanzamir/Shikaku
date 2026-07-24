import { Difficulty } from './difficulties';

/**
 * @typedef {import('./game.js').Rectangle} Rectangle
 * @typedef {import('./game.js').Clue} Clue
 */

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
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
 * @param {Difficulty} [difficulty]
 * @returns {() => number}
 */
export function createSeededRng(date = new Date(), difficulty) {
    const dateKey = toDateKey(date);
    const seedInput = `${dateKey}:${difficulty}`;
    return mulberry32(hashSeed(seedInput));
}

/**
 * Generate a puzzle of the given size.
 * @param {difficulty: Difficulty} [difficulty]
 * @returns {Clue[]} clues
 */

export function generatePuzzle(difficulty) {
    const rand = createSeededRng(new Date(), difficulty.difficulty);
    const validated = false
    const clues = []
    while (!validated) {
        const rectangles = partitionRecursion({width: difficulty.size, height: difficulty.size, maxArea: difficulty.maxRectangleSize}, rand, {row: 0, col: 0})
        clues = cluePlacement(rectangles, rand)
        // validated = validity check (clues) -> bool || boredom check (clues) -> bool
    }
    return clues
}

const MAX_SPLIT_ATTEMPTS = 10;

/**
 * @param {{width: number, height: number, maxArea: number}} size
 * @param {{row: number, col: number}} position
 * @returns {Rectangle[]}
 */
function asLeaf(size, position) {
    return [{
        row: position.row,
        col: position.col,
        width: size.width,
        height: size.height,
    }];
}

/**
 * Pick a cut in 1 .. axisLength-1 (both sides at least 1 cell).
 * @param {number} axisLength
 * @param {() => number} rand
 * @returns {number | null}
 */
function pickLegalCut(axisLength, rand) {
    if (axisLength <= 1) {
        return null;
    }
    return 1 + Math.floor(rand() * (axisLength - 1));
}

/**
 * @param {{width: number, height: number, maxArea: number}} size
 * @param {() => number} rand
 * @param {{row: number, col: number}} position
 * @returns {Rectangle[]}
 */
export function partitionRecursion(size, rand, position) {
    const area = size.width * size.height;
    const canSplitHorizontal = size.height > 1;
    const canSplitVertical = size.width > 1;
    const canSplit = canSplitHorizontal || canSplitVertical;
    const mustSplit = area > size.maxArea;

    if (!canSplit) {
        return asLeaf(size, position);
    }

    // Soft stop: region is small enough that we may keep it as-is.
    if (!mustSplit && rand() < 0.5) {
        return asLeaf(size, position);
    }

    for (let attempt = 0; attempt < MAX_SPLIT_ATTEMPTS; attempt++) {
        const splitHorizontal = canSplitHorizontal && (!canSplitVertical || rand() < 0.5);

        if (splitHorizontal) {
            const cut = pickLegalCut(size.height, rand);
            if (cut === null) {
                continue;
            }

            // newSize = bottom piece; current = top piece (keeps original position)
            const top = { width: size.width, height: size.height - cut, maxArea: size.maxArea };
            const bottom = { width: size.width, height: cut, maxArea: size.maxArea };
            const bottomPos = { row: position.row + (size.height - cut), col: position.col };

            return [
                ...partitionRecursion(bottom, rand, bottomPos),
                ...partitionRecursion(top, rand, position),
            ];
        }

        const cut = pickLegalCut(size.width, rand);
        if (cut === null) {
            continue;
        }

        // newSize = right piece; current = left piece (keeps original position)
        const left = { width: size.width - cut, height: size.height, maxArea: size.maxArea };
        const right = { width: cut, height: size.height, maxArea: size.maxArea };
        const rightPos = { row: position.row, col: position.col + (size.width - cut) };

        return [
            ...partitionRecursion(right, rand, rightPos),
            ...partitionRecursion(left, rand, position),
        ];
    }

    // Gave up on constrained attempts: keep as leaf unless we must split.
    if (!mustSplit) {
        return asLeaf(size, position);
    }

    // Forced split: any legal cut on an available axis.
    if (canSplitHorizontal) {
        const cut = pickLegalCut(size.height, rand);
        const top = { width: size.width, height: size.height - cut, maxArea: size.maxArea };
        const bottom = { width: size.width, height: cut, maxArea: size.maxArea };
        const bottomPos = { row: position.row + (size.height - cut), col: position.col };
        return [
            ...partitionRecursion(bottom, rand, bottomPos),
            ...partitionRecursion(top, rand, position),
        ];
    }

    const cut = pickLegalCut(size.width, rand);
    const left = { width: size.width - cut, height: size.height, maxArea: size.maxArea };
    const right = { width: cut, height: size.height, maxArea: size.maxArea };
    const rightPos = { row: position.row, col: position.col + (size.width - cut) };
    return [
        ...partitionRecursion(right, rand, rightPos),
        ...partitionRecursion(left, rand, position),
    ];
}

/**
 * @param {Rectangle[]} rectangles 
 * @param {*} rand 
 * @returns {Clue[]} Clues
 */

export function cluePlacement(rectangles, rand) {
    const clues = []
    for (const rectangle of rectangles) {
        const randRow = Math.floor(rand() * rectangle.height) + rectangle.row;
        const randCol = Math.floor(rand() * rectangle.width) + rectangle.col;
        clues.push({row: randRow, col: randCol, value: rectangle.height * rectangle.width})
    }
    return clues;
}
