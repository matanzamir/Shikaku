import { CellClass } from './cellClasses.js';
import {
    buildRectangle,
    findRectangleAt,
    rectanglesOverlap,
    validateRectangle,
} from './game.js';

/**
 * @typedef {import('./game.js').Puzzle} Puzzle
 * @typedef {import('./game.js').GameState} GameState
 * @typedef {import('./game.js').Clue} Clue
 */

/**
 * @param {Puzzle} puzzle
 * @param {GameState} gameState
 */
export function createGameGrid(puzzle, gameState) {
    const gameGrid = document.getElementById('game-grid');

    gameGrid.innerHTML = '';

    gameGrid.style.setProperty('--grid-size', puzzle.rows);

    for (let row = 0; row < puzzle.rows; row++) {
        for (let col = 0; col < puzzle.cols; col++) {
            const cell = createGridCell(row, col);

            declareGridCellCorners(cell, puzzle);

            const clue = puzzle.clues.find((c) => c.row === row && c.col === col);
            if (clue) {
                cell.textContent = clue.value;
                cell.classList.add(CellClass.CLUE);
            }
            gameGrid.appendChild(cell);
        }
    }

    addGridEventListener(gameGrid, gameState, puzzle.clues);
    paintCellStates(gameState);
}

/**
 * @param {HTMLElement} gameGrid
 * @param {GameState} gameState
 * @param {Clue[]} clues
 */
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

        cell.classList.toggle(CellClass.RECTANGLE, covered.has(key));
        cell.classList.toggle(CellClass.VALIDATED, validatedCells.has(key));
        cell.classList.toggle(
            CellClass.SELECTED,
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
 * @param {number} row
 * @param {number} col
 * @returns {HTMLDivElement}
 */
function createGridCell(row, col) {
    const cell = document.createElement('div');
    cell.classList.add('grid-cell');
    cell.dataset.row = String(row);
    cell.dataset.col = String(col);
    return cell;
}

/**
 * @param {HTMLElement} cell
 * @param {Puzzle} puzzle
 */
function declareGridCellCorners(cell, puzzle) {
    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);

    const isTopRow = row === 0;
    const isBottomRow = row === puzzle.rows - 1;
    const isLeftCol = col === 0;
    const isRightCol = col === puzzle.cols - 1;

    if (isTopRow && isLeftCol) cell.classList.add('grid-cell--corner-tl');
    if (isTopRow && isRightCol) cell.classList.add('grid-cell--corner-tr');
    if (isBottomRow && isLeftCol) cell.classList.add('grid-cell--corner-bl');
    if (isBottomRow && isRightCol) cell.classList.add('grid-cell--corner-br');
}
