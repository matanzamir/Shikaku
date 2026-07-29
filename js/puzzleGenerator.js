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
 * @returns {Clue[]} clues
 */
export function generatePuzzle(difficulty) {
    const rand = createSeededRng(new Date(), difficulty.name);
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
