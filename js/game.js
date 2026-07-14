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
    return { rectangles: [],
        pendingSelection: null
    };
}

export function createGameGrid(puzzle, gameState) {
    const gameGrid = document.getElementById('game-grid');

    gameGrid.innerHTML = '';

    //set the grid size
    gameGrid.style.setProperty('--grid-size', puzzle.rows);

    //create the grid cells
    for (let row = 0; row < puzzle.rows; row++) {
        for (let col = 0; col < puzzle.cols; col++) {
            const cell = createGridCell(row, col);

            declareGridCellCorners(cell, puzzle);

            const clue = puzzle.clues.find((c) => c.row === row && c.col === col);
            if (clue) {
                cell.textContent = clue.value;
                cell.classList.add('clue');
            }
            gameGrid.appendChild(cell);
        }
    }
    addGridEventListener(gameGrid, gameState, puzzle.clues);
    paintCellStates(gameState);
}

function addGridEventListener(gameGrid, gameState, clues) {
    gameGrid.addEventListener('click', (event) => {
        const cell = event.target.closest('.grid-cell');
        if (!cell) return;
        handleCellClick(cell, gameState, clues);
    });
}

/**
 * Syncs .selected / .rectangle / .validated classes from gameState.
 * @param {GameState} gameState
 */
function paintCellStates(gameState) {
    const cells = document.querySelectorAll('#game-grid .grid-cell');
    const covered = new Set();
    const validatedCells = new Set();

    for (const rect of gameState.rectangles) {
        for (let r = rect.row; r < rect.row + rect.height; r++) {
            for (let c = rect.col; c < rect.col + rect.width; c++) {
                const key = `${r},${c}`;
                covered.add(key);
                if (rect.validated) {
                    validatedCells.add(key);
                }
            }
        }
    }

    const pending = gameState.pendingSelection;

    cells.forEach((cell) => {
        const row = Number(cell.dataset.row);
        const col = Number(cell.dataset.col);
        const key = `${row},${col}`;

        cell.classList.toggle('rectangle', covered.has(key));
        cell.classList.toggle('validated', validatedCells.has(key));
        cell.classList.toggle(
            'selected',
            pending !== null && pending.row === row && pending.col === col
        );
    });
}

/**
 * @param {HTMLElement} cell
 * @param {GameState} gameState
 * @param {Clue[]} clues
 */
function handleCellClick(cell, gameState, clues) {
    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);
    const pending = gameState.pendingSelection;

    // Re-click pending corner → cancel selection
    if (pending && pending.row === row && pending.col === col) {
        gameState.pendingSelection = null;
        paintCellStates(gameState);
        return;
    }

    // First corner
    if (!pending) {
        const rectangleClicked = findRectangleAt({ row, col }, gameState.rectangles);

        if (rectangleClicked) {
            gameState.rectangles = gameState.rectangles.filter((rect) => rect !== rectangleClicked);
        } else {
            gameState.pendingSelection = { row, col };
        }
    } else {
        // Second corner
        const candidate = buildRectangle(pending, { row, col });
        const overlapping = gameState.rectangles.filter((rect) =>
            rectanglesOverlap(candidate, rect)
        );

        // Reject if the new region touches any validated (locked) rectangle
        if (overlapping.some((rect) => rect.validated)) {
            return;
        }

        // Remove overlapping invalid rectangles, then place the candidate
        gameState.rectangles = gameState.rectangles.filter(
            (rect) => !overlapping.includes(rect)
        );

        candidate.validated = validateRectangle(candidate, clues);
        gameState.rectangles.push(candidate);
        gameState.pendingSelection = null;
    }

    paintCellStates(gameState);
}

/**
 * Normalize two corners into a rectangle.
 * @param {{ row: number, col: number }} a
 * @param {{ row: number, col: number }} b
 * @returns {Rectangle}
 */
function buildRectangle(a, b) {
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
function findRectangleAt(cell, rectangles) {
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
function rectanglesOverlap(a, b) {
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
function validateRectangle(rectangle, clues) {
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
function cellIsInsideRectangle(cell, rectangle) {
    return (
        cell.row >= rectangle.row &&
        cell.row < rectangle.row + rectangle.height &&
        cell.col >= rectangle.col &&
        cell.col < rectangle.col + rectangle.width
    );
}

function createGridCell(row, col) {
    const cell = document.createElement('div');
    cell.classList.add('grid-cell');
    cell.dataset.row = row;
    cell.dataset.col = col;
    return cell;
}

function declareGridCellCorners(cell, puzzle) {
    const row = parseInt(cell.dataset.row);
    const col = parseInt(cell.dataset.col);

    const isTopRow = row === 0;
    const isBottomRow = row === puzzle.rows - 1;
    const isLeftCol = col === 0;
    const isRightCol = col === puzzle.cols - 1;

    if (isTopRow && isLeftCol) cell.classList.add('grid-cell--corner-tl');
    if (isTopRow && isRightCol) cell.classList.add('grid-cell--corner-tr');
    if (isBottomRow && isLeftCol) cell.classList.add('grid-cell--corner-bl');
    if (isBottomRow && isRightCol) cell.classList.add('grid-cell--corner-br');
}

/** Hand-crafted dev puzzle until Phase 3 generator is ready. */
export const SAMPLE_PUZZLE = createPuzzle(5, 5, [
    { row: 0, col: 0, value: 4 },
    { row: 0, col: 3, value: 2 },
    { row: 2, col: 1, value: 6 },
    { row: 3, col: 3, value: 4 },
    { row: 4, col: 0, value: 3 },
]);
