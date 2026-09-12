import { createSeededRng, toDateKey } from './rngCreator.js';
import { hasUniqueSolution } from './puzzleValidator.js';
import { isBoring } from './boredomCheck.js';
import { shufflePartition } from './partitionShuffle.js';

/**
 * @typedef {import('./game.js').Rectangle} Rectangle
 * @typedef {import('./game.js').Clue} Clue
 * @typedef {import('./difficulties.js').Difficulty} Difficulty
 */

/**
 * Ceiling on candidate boards per puzzle. The interest checks reject the large
 * majority of candidates, so a seed that never satisfies all of them would
 * otherwise spin forever and hang the page on load.
 */
const MAX_GENERATION_ATTEMPTS = 500;

/** @type {Map<string, Clue[]>} */
const puzzleCache = new Map();

/**
 * @param {Difficulty[keyof Difficulty]} difficulty
 * @param {Date | string} date
 * @returns {string}
 */
function cacheKey(difficulty, date) {
    return `${toDateKey(date)}:${difficulty.name}`;
}

/**
 * Generate a puzzle of the given size.
 * @param {Difficulty[keyof Difficulty]} difficulty
 * @param {Date | string} date
 * @returns {Clue[]} clues
 */
export function generatePuzzle(difficulty, date) {
    const key = cacheKey(difficulty, date);
    const cached = puzzleCache.get(key);
    if (cached) {
        return cached;
    }

    const clues = generateBoard(difficulty, date).clues;
    puzzleCache.set(key, clues);
    return clues;
}

/**
 * Generate a puzzle and hand back the solution it was cut from.
 *
 * partitionRecursion cuts the board guillotine-style, which leaves its cuts
 * plainly visible in the finished puzzle, so shufflePartition rebuilds small
 * regions of that partition until the board interlocks instead.
 *
 * @param {Difficulty[keyof Difficulty]} difficulty
 * @param {Date} date
 * @returns {{clues: Clue[], rectangles: Rectangle[], attempts: number}}
 */
export function generateBoard(difficulty, date) {
    const rand = createSeededRng(date, difficulty.name);
    const size = { width: difficulty.size, height: difficulty.size };
    /** Solvable but dull board, kept in case no candidate is ever both. */
    let playable = null;
    let lastResort = null;

    for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
        const partition = partitionRecursion(
            { width: difficulty.size, height: difficulty.size, maxArea: difficulty.maxRectangleSize },
            rand,
            { row: 0, col: 0 }
        );
        const rectangles = shufflePartition(partition, {
            size: difficulty.size,
            maxArea: difficulty.maxRectangleSize,
            rand,
            repartition: partitionRecursion,
        });
        const clues = cluePlacement(rectangles, rand);
        lastResort = { clues, rectangles, attempts: attempt };

        const interesting = !isBoring(rectangles, difficulty.size);
        // Once a fallback exists, a dull board is not worth the uniqueness check.
        if (!interesting && playable !== null) {
            continue;
        }
        if (!hasUniqueSolution(clues, size)) {
            continue;
        }
        if (interesting) {
            return { clues, rectangles, attempts: attempt };
        }
        playable = { clues, rectangles, attempts: attempt };
    }

    return playable ?? lastResort;
}

const MAX_SPLIT_ATTEMPTS = 10;
/** No 1×1 (or other area-1) rectangles in generated partitions. */
const MIN_RECTANGLE_AREA = 2;
/** Regions this small are never cut again, which keeps 2s and 3s uncommon. */
const ALWAYS_KEEP_AREA = 6;

/**
 * Odds of leaving a region whole. Certain at ALWAYS_KEEP_AREA and falling to
 * zero at maxArea, so pieces gather around the middle of the allowed range. A
 * flat probability instead piled them up at both extremes: regions kept being
 * cut down to 2s and 3s, while whatever stopped early stayed near maxArea.
 * @param {number} area
 * @param {number} maxArea
 * @returns {number}
 */
function keepWholeChance(area, maxArea) {
    if (area <= ALWAYS_KEEP_AREA) {
        return 0.85 - (area / 100);
    }
    const spread = (area - ALWAYS_KEEP_AREA) / (maxArea - ALWAYS_KEEP_AREA);
    return 1 - Math.sqrt(Math.min(1, spread));
}

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
 * Legal cut positions on an axis so both pieces have area >= MIN_RECTANGLE_AREA.
 * For a horizontal split, axisLength is height and crossAxisLength is width (and vice versa).
 * @param {number} axisLength
 * @param {number} crossAxisLength
 * @returns {number[]} cut sizes for the "new" piece (1 .. axisLength-1, constrained)
 */
function legalCuts(axisLength, crossAxisLength) {
    const cuts = [];
    // Each side needs at least this many cells along the split axis.
    const minSide = Math.ceil(MIN_RECTANGLE_AREA / crossAxisLength);
    for (let cut = minSide; cut <= axisLength - minSide; cut++) {
        cuts.push(cut);
    }
    return cuts;
}

/**
 * Pick a random legal cut, or null if none exist.
 * @param {number} axisLength
 * @param {number} crossAxisLength
 * @param {() => number} rand
 * @returns {number | null}
 */
function pickLegalCut(axisLength, crossAxisLength, rand) {
    const cuts = legalCuts(axisLength, crossAxisLength);
    if (cuts.length === 0) {
        return null;
    }
    return cuts[Math.floor(rand() * cuts.length)];
}

/**
 * @param {{width: number, height: number, maxArea: number}} size
 * @param {() => number} rand
 * @param {{row: number, col: number}} position
 * @returns {Rectangle[]}
 */
export function partitionRecursion(size, rand, position) {
    const area = size.width * size.height;
    // Cut across the long axis, so an elongated region gets squarer instead of
    // shedding another parallel strip. Squares stay at even odds.
    const horizontalSplitChance = (size.height * size.height) / (size.height * size.height + size.width * size.width);
    const canSplitHorizontal = legalCuts(size.height, size.width).length > 0;
    const canSplitVertical = legalCuts(size.width, size.height).length > 0;
    const canSplit = canSplitHorizontal || canSplitVertical;
    const mustSplit = area > size.maxArea;

    // Soft stop: keep as-is when area is valid and we are not forced to split.
    if (!mustSplit && area >= MIN_RECTANGLE_AREA && (!canSplit || rand() < keepWholeChance(area, size.maxArea))) {
        return asLeaf(size, position);
    }

    // Small valid regions (2 or 3): never split into area-1 pieces.
    if (area <= 3 && area >= MIN_RECTANGLE_AREA) {
        return asLeaf(size, position);
    }

    for (let attempt = 0; attempt < MAX_SPLIT_ATTEMPTS; attempt++) {
        const splitHorizontal = canSplitHorizontal && (!canSplitVertical || rand() < horizontalSplitChance);

        if (splitHorizontal) {
            const cut = pickLegalCut(size.height, size.width, rand);
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

        const cut = pickLegalCut(size.width, size.height, rand);
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
    if (!mustSplit && area >= MIN_RECTANGLE_AREA) {
        return asLeaf(size, position);
    }

    // Forced split: any legal cut on an available axis.
    if (canSplitHorizontal) {
        const cut = pickLegalCut(size.height, size.width, rand);
        if (cut !== null) {
            const top = { width: size.width, height: size.height - cut, maxArea: size.maxArea };
            const bottom = { width: size.width, height: cut, maxArea: size.maxArea };
            const bottomPos = { row: position.row + (size.height - cut), col: position.col };
            return [
                ...partitionRecursion(bottom, rand, bottomPos),
                ...partitionRecursion(top, rand, position),
            ];
        }
    }

    if (canSplitVertical) {
        const cut = pickLegalCut(size.width, size.height, rand);
        if (cut !== null) {
            const left = { width: size.width - cut, height: size.height, maxArea: size.maxArea };
            const right = { width: cut, height: size.height, maxArea: size.maxArea };
            const rightPos = { row: position.row, col: position.col + (size.width - cut) };
            return [
                ...partitionRecursion(right, rand, rightPos),
                ...partitionRecursion(left, rand, position),
            ];
        }
    }

    // No legal min-area split (should be rare); keep only if area is valid.
    if (area >= MIN_RECTANGLE_AREA) {
        return asLeaf(size, position);
    }
    return [];
}

/**
 * @param {Rectangle[]} rectangles
 * @param {() => number} rand
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
