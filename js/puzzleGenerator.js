import { createSeededRng } from './rngCreator.js';
import { hasUniqueSolution } from './puzzleValidator.js';

/**
 * @typedef {import('./game.js').Rectangle} Rectangle
 * @typedef {import('./game.js').Clue} Clue
 * @typedef {import('./difficulties.js').Difficulty} Difficulty
 */

/**
 * Generate a puzzle of the given size.
 * @param {Difficulty[keyof Difficulty]} difficulty
 * @param {Date} date
 * @returns {Clue[]} clues
 */
export function generatePuzzle(difficulty, date) {
    const rand = createSeededRng(date, difficulty.name);
    let validated = false
    let clues = []
    while (!validated) {
        const rectangles = partitionRecursion({width: difficulty.size, height: difficulty.size, maxArea: difficulty.maxRectangleSize}, rand, {row: 0, col: 0})
        clues = cluePlacement(rectangles, rand)
        validated = hasUniqueSolution(clues, {width: difficulty.size, height: difficulty.size})
        // ToDo: add boredom check (clues) -> bool
    }
    return clues
}

const MAX_SPLIT_ATTEMPTS = 10;
/** No 1×1 (or other area-1) rectangles in generated partitions. */
const MIN_RECTANGLE_AREA = 2;

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
    const canSplitHorizontal = legalCuts(size.height, size.width).length > 0;
    const canSplitVertical = legalCuts(size.width, size.height).length > 0;
    const canSplit = canSplitHorizontal || canSplitVertical;
    const mustSplit = area > size.maxArea;

    // Soft stop: keep as-is when area is valid and we are not forced to split.
    if (!mustSplit && area >= MIN_RECTANGLE_AREA && (!canSplit || rand() < 0.35)) {
        return asLeaf(size, position);
    }

    // Small valid regions (2 or 3): never split into area-1 pieces.
    if (area <= 3 && area >= MIN_RECTANGLE_AREA) {
        return asLeaf(size, position);
    }

    for (let attempt = 0; attempt < MAX_SPLIT_ATTEMPTS; attempt++) {
        const splitHorizontal = canSplitHorizontal && (!canSplitVertical || rand() < 0.5);

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
