/**
 * @typedef {{ row: number, col: number, value: number }} Clue
 * @typedef {{ rows: number, cols: number, clues: Clue[] }} Puzzle
 * @typedef {{ row: number, col: number, width: number, height: number }} Rectangle
 * @typedef {{ rectangles: Rectangle[] }} GameState
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
    return { rectangles: [] };
}

export function createGameGrid(puzzle) {
    const gameGrid = document.getElementById('game-grid');

    gameGrid.innerHTML = '';

    //set the grid size
    gameGrid.style.setProperty('--grid-size', puzzle.rows);

    //create the grid cells
    for (let row = 0; row < puzzle.rows; row++) {
        for (let col = 0; col < puzzle.cols; col++) {
            const cell = document.createElement('div');
            cell.classList.add('grid-cell');
            cell.dataset.row = row;
            cell.dataset.col = col;
            // if this (row,col) has a clue → add clue class + text
            const clue = puzzle.clues.find((c) => c.row === row && c.col === col);
            if (clue) {
                cell.classList.add('clue');
                cell.textContent = clue.value;
            }
            gameGrid.appendChild(cell);
        }
    }
}

/** Hand-crafted dev puzzle until Phase 3 generator is ready. */
export const SAMPLE_PUZZLE = createPuzzle(5, 5, [
    { row: 0, col: 0, value: 4 },
    { row: 0, col: 3, value: 2 },
    { row: 2, col: 1, value: 6 },
    { row: 3, col: 3, value: 4 },
    { row: 4, col: 0, value: 3 },
]);
