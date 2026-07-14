/**
 * @typedef {{ row: number, col: number, value: number }} Clue
 * @typedef {{ rows: number, cols: number, clues: Clue[] }} Puzzle
 * @typedef {{ row: number, col: number, width: number, height: number, validated?: boolean }} Rectangle
 * @typedef {{ rectangles: Rectangle[], pendingSelection: { row: number, col: number} | null }} GameState
 */

/**
 * @param {number} rows
 * @param {number} cols
 * @param {Clue[]} clues
 * @returns {Puzzle}
 */
export function createPuzzle(rows, cols, clues) {
    if (!Number.isInteger(rows) || rows < 1 || !Number.isInteger(cols) || cols < 1) {
        throw new Error('Puzzle dimensions must be positive integers.');
    }

    const seen = new Set();

    for (const clue of clues) {
        if (!Number.isInteger(clue.row) || !Number.isInteger(clue.col) || !Number.isInteger(clue.value)) {
            throw new Error('Clue row, col, and value must be integers.');
        }

        if (clue.row < 0 || clue.row >= rows || clue.col < 0 || clue.col >= cols) {
            throw new Error(`Clue at (${clue.row}, ${clue.col}) is outside grid bounds.`);
        }

        if (clue.value < 1) {
            throw new Error(`Clue at (${clue.row}, ${clue.col}) must have a positive value.`);
        }

        const key = `${clue.row},${clue.col}`;
        if (seen.has(key)) {
            throw new Error(`Duplicate clue at (${clue.row}, ${clue.col}).`);
        }

        seen.add(key);
    }

    return Object.freeze({
        rows,
        cols,
        clues: Object.freeze(clues.map((clue) => Object.freeze({ ...clue }))),
    });

    // function after phase 3.5: return { rows, cols, clues };
}

/**
 * @returns {GameState}
 */
export function createGameState() {
    return {
        rectangles: [],
        pendingSelection: null,
    };
}

/**
 * Normalize two corners into a rectangle.
 * @param {{ row: number, col: number }} a
 * @param {{ row: number, col: number }} b
 * @returns {Rectangle}
 */
export function buildRectangle(a, b) {
    const row = Math.min(a.row, b.row);
    const col = Math.min(a.col, b.col);
    const width = Math.abs(a.col - b.col) + 1;
    const height = Math.abs(a.row - b.row) + 1;
    return { row, col, width, height, validated: false };
}

/**
 * Find the placed rectangle that covers this cell, if any.
 * @param {{ row: number, col: number }} cell
 * @param {Rectangle[]} rectangles
 * @returns {Rectangle | null}
 */
export function findRectangleAt(cell, rectangles) {
    for (const rect of rectangles) {
        if (cellIsInsideRectangle(cell, rect)) {
            return rect;
        }
    }
    return null;
}

/**
 * @param {Rectangle} a
 * @param {Rectangle} b
 * @returns {boolean}
 */
export function rectanglesOverlap(a, b) {
    for (let r = a.row; r < a.row + a.height; r++) {
        for (let c = a.col; c < a.col + a.width; c++) {
            if (r >= b.row && r < b.row + b.height && c >= b.col && c < b.col + b.width) {
                return true;
            }
        }
    }
    return false;
}

/**
 * @param {Rectangle} rectangle
 * @param {Clue[]} clues
 * @returns {boolean}
 */
export function validateRectangle(rectangle, clues) {
    const cluesInside = [];
    for (const clue of clues) {
        if (cellIsInsideRectangle(clue, rectangle)) {
            cluesInside.push(clue);
        }
    }
    return (
        cluesInside.length === 1 &&
        cluesInside[0].value === rectangle.height * rectangle.width
    );
}

/**
 * @param {{ row: number, col: number }} cell
 * @param {Rectangle} rectangle
 * @returns {boolean}
 */
export function cellIsInsideRectangle(cell, rectangle) {
    return (
        cell.row >= rectangle.row &&
        cell.row < rectangle.row + rectangle.height &&
        cell.col >= rectangle.col &&
        cell.col < rectangle.col + rectangle.width
    );
}

/** Hand-crafted dev puzzle until Phase 3 generator is ready. */
export const SAMPLE_PUZZLE = createPuzzle(5, 5, [
    { row: 0, col: 0, value: 4 },
    { row: 0, col: 3, value: 2 },
    { row: 2, col: 1, value: 6 },
    { row: 3, col: 3, value: 4 },
    { row: 4, col: 0, value: 3 },
    { row: 1, col: 4, value: 4 },
    { row: 4, col: 4, value: 2 },
]);
