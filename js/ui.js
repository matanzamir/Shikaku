import { CellClass } from './cellClasses.js';
import {
    buildRectangle,
    findRectangleAt,
    rectanglesOverlap,
    validateRectangle,
    validatePuzzle,
} from './game.js';
import { resumeTimer, stopTimer } from './timer.js';
import { 
    setTheme, 
    setActiveRectangles, 
    clearActiveRectangles, 
    clearTimerOffset, 
    getDifficulty, 
    setDifficulty,
    getActiveRectangles } from './storage.js';
import { Difficulty } from './difficulties.js';
import { Message } from './messages.js';

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

    addGridEventListener(gameGrid, gameState, puzzle);

    const resetBoardButton = document.getElementById('reset-board-button');
    addResetBoardEventListener(resetBoardButton, gameState);
    
}

/**
 * @param {HTMLElement} gameGrid
 * @param {GameState} gameState
 * @param {{ rows: number, cols: number, clues: Clue[] }} Puzzle
 */
function addGridEventListener(gameGrid, gameState, puzzle) {
    gameGrid.addEventListener('click', (event) => {
        const cell = event.target.closest('.grid-cell');
        if (!cell) return;
        handleCellClick(cell, gameState, puzzle);
    });
}

/**
 * @param {HTMLElement} resetBoardButton
 * @param {GameState} gameState
 */
function addResetBoardEventListener(resetBoardButton, gameState) {
    resetBoardButton.addEventListener('click', () => {
        resetBoard(gameState);
    });
}

/**
 * @param {GameState} gameState
 */
function resetBoard(gameState) {
    gameState.rectangles = [];
    gameState.pendingSelection = null;
    clearActiveRectangles();
    hideWinOverlay();
    paintCellStates(gameState);
}

/**
 * Syncs .selected / .rectangle / .validated classes from gameState.
 * @param {GameState} gameState
 */
export function paintCellStates(gameState) {
    const cells = document.querySelectorAll('#game-grid .grid-cell');
    // Map of "row,col" -> per-cell visual info derived from the rectangle
    // that covers it (a cell is covered by at most one rectangle, since
    // overlapping rectangles are never kept in gameState.rectangles).
    const cellInfo = new Map();

    for (const rect of gameState.rectangles) {
        for (let r = rect.row; r < rect.row + rect.height; r++) {
            for (let c = rect.col; c < rect.col + rect.width; c++) {
                const key = `${r},${c}`;
                cellInfo.set(key, {
                    validated: Boolean(rect.validated),
                    edgeTop: r === rect.row,
                    edgeBottom: r === rect.row + rect.height - 1,
                    edgeLeft: c === rect.col,
                    edgeRight: c === rect.col + rect.width - 1,
                });
            }
        }
    }

    const pending = gameState.pendingSelection;

    cells.forEach((cell) => {
        const row = Number(cell.dataset.row);
        const col = Number(cell.dataset.col);
        const key = `${row},${col}`;
        const info = cellInfo.get(key);

        cell.classList.toggle(CellClass.RECTANGLE, Boolean(info));
        cell.classList.toggle(CellClass.VALIDATED, Boolean(info?.validated));
        cell.classList.toggle(CellClass.EDGE_TOP, Boolean(info?.edgeTop));
        cell.classList.toggle(CellClass.EDGE_BOTTOM, Boolean(info?.edgeBottom));
        cell.classList.toggle(CellClass.EDGE_LEFT, Boolean(info?.edgeLeft));
        cell.classList.toggle(CellClass.EDGE_RIGHT, Boolean(info?.edgeRight));
        cell.classList.toggle(
            CellClass.SELECTED,
            pending !== null && pending.row === row && pending.col === col
        );
    });
}

/**
 * @param {HTMLElement} cell
 * @param {GameState} gameState
 * @param {{ rows: number, cols: number, clues: Clue[] }} Puzzle
 */
function handleCellClick(cell, gameState, puzzle) {
    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);
    const clues = puzzle.clues;
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
            flashInvalidSelection(pending);
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
    setActiveRectangles(gameState.rectangles);
    paintCellStates(gameState);
    if (validatePuzzle(gameState.rectangles, puzzle.rows * puzzle.cols)) {
        stopTimer();
        clearActiveRectangles();
        clearTimerOffset();
        showWinOverlay();
    }
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

function showWinOverlay() {
    document.getElementById('win-overlay').hidden = false;
  }
  function hideWinOverlay() {
    document.getElementById('win-overlay').hidden = true;
  }

export function handleLightDarkClick(lightDarkButton) {
    const current = document.documentElement.dataset.theme || document.body.dataset.theme;
    const theme = current === 'dark' ? 'light' : 'dark';
    updateBodyTheme(theme, lightDarkButton);
}

export function updateBodyTheme(theme, button) {
    document.documentElement.dataset.theme = theme;
    document.body.dataset.theme = theme;
    button.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
    setTheme(theme);
}

/**
 * Briefly flash the pending corner red to signal an invalid second pick.
 * @param {{ row: number, col: number }} pending
 */
function flashInvalidSelection(pending) {
    const cell = document.querySelector(
        `#game-grid .grid-cell[data-row="${pending.row}"][data-col="${pending.col}"]`
    );
    if (!cell) return;

    cell.classList.remove(CellClass.INVALID);
    void cell.offsetWidth;
    cell.classList.add(CellClass.INVALID);
    cell.addEventListener(
        'animationend',
        () => cell.classList.remove(CellClass.INVALID),
        { once: true }
    );
}

export async function handleDifficultyChange(difficultyName, gameState) {
    if (difficultyName === getDifficulty().name) {
        closeDifficultyMenu();
        return;
    }

    if (getActiveRectangles().length > 0) {
        const answer = await openAlertBox(Message.UNSAVED);
        if (!answer) {
            closeDifficultyMenu();
            return;
        }
    }

    resetBoard(gameState);
    setDifficulty(difficultyName);
    refreshDifficultyMenu();
    closeDifficultyMenu();
}

export function setDifficultySelectOptions() {
    setDifficulty(getDifficulty().name);
    refreshDifficultyMenu();
}

export function toggleDifficultyMenu() {
    const menu = document.getElementById('difficulty-menu');
    const button = document.getElementById('difficulty-button');
    const willOpen = menu.hidden;
    menu.hidden = !willOpen;
    button.setAttribute('aria-expanded', String(willOpen));
}

export function closeDifficultyMenu() {
    const menu = document.getElementById('difficulty-menu');
    const button = document.getElementById('difficulty-button');
    menu.hidden = true;
    button.setAttribute('aria-expanded', 'false');
}

function refreshDifficultyMenu() {
    const menu = document.getElementById('difficulty-menu');
    const current = getDifficulty().name;
    const currentShape = document.querySelector('#difficulty-button .difficulty-shape');
    if (currentShape) {
        currentShape.dataset.difficulty = current.toLowerCase();
    }

    menu.replaceChildren();
    for (const difficulty of Object.values(Difficulty)) {
        if (difficulty.name === current) continue;

        const item = document.createElement('li');
        item.setAttribute('role', 'option');

        const optionButton = document.createElement('button');
        optionButton.type = 'button';
        optionButton.className = 'difficulty-option';
        optionButton.dataset.difficulty = difficulty.name;
        optionButton.setAttribute('aria-label', difficulty.name);

        const shape = document.createElement('span');
        shape.className = 'difficulty-shape';
        shape.dataset.difficulty = difficulty.name.toLowerCase();
        shape.setAttribute('aria-hidden', 'true');

        optionButton.appendChild(shape);
        item.appendChild(optionButton);
        menu.appendChild(item);
    }
}

function openAlertBox(message) {
    const alertBox = document.getElementById('alert-box');
    document.getElementById('message').textContent = message;
    alertBox.hidden = false;

    return new Promise((resolve) => {
        const okBtn = document.getElementById('ok-btn');
        const cancelBtn = document.getElementById('cancel-btn');

        const cleanup = (result) => {
            alertBox.hidden = true;
            okBtn.removeEventListener('click', onOk);
            cancelBtn.removeEventListener('click', onCancel);
            resolve(result);
        };

        const onOk = () => cleanup(true);
        const onCancel = () => cleanup(false);

        okBtn.addEventListener('click', onOk);
        cancelBtn.addEventListener('click', onCancel);
    });
}

export function handleGameInactiveOverlayClick() {
    resumeTimer();
}