import { CellClass } from './cellClasses.js';
import {
    buildRectangle,
    createPuzzle,
    findRectangleAt,
    rectanglesOverlap,
    validateRectangle,
    validatePuzzle,
} from './game.js';
import { resumeTimer, getElapsedMs, startTimer, pauseTimer } from './timer.js';
import { 
    setTheme, 
    setActiveRectangles, 
    clearActiveRectangles, 
    getDifficulty, 
    setDifficulty,
    getActiveRectangles,
    setScoreText,
    showStoredScore,
    getPlayDateKey } from './storage.js';
import { Difficulty } from './difficulties.js';
import { Message } from './messages.js';
import { generatePuzzle } from './puzzleGenerator.js';

/**
 * @typedef {import('./game.js').Puzzle} Puzzle
 * @typedef {import('./game.js').GameState} GameState
 * @typedef {import('./game.js').Clue} Clue
 */

/** @type {AbortController | null} */
let gridListenersAbort = null;

/**
 * @param {Puzzle} puzzle
 * @param {GameState} gameState
 */
export function createGameGrid(puzzle, gameState) {
    const gameGrid = document.getElementById('game-grid');

    gameGrid.innerHTML = '';

    /* On :root so density tokens (--cell-size, chrome compress, etc.) recompute with the board. */
    document.documentElement.style.setProperty('--grid-size', String(puzzle.rows));

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

    bindGridListeners(gameGrid, gameState, puzzle);
}

/**
 * (Re)bind grid + reset handlers so puzzle reloads do not stack listeners.
 * @param {HTMLElement} gameGrid
 * @param {GameState} gameState
 * @param {Puzzle} puzzle
 */
function bindGridListeners(gameGrid, gameState, puzzle) {
    gridListenersAbort?.abort();
    gridListenersAbort = new AbortController();
    const { signal } = gridListenersAbort;

    gameGrid.addEventListener(
        'click',
        (event) => {
            const cell = event.target.closest('.grid-cell');
            if (!cell) return;
            handleCellClick(cell, gameState, puzzle);
        },
        { signal }
    );

    document.getElementById('reset-board-button').addEventListener(
        'click',
        () => {
            resetBoard(gameState);
        },
        { signal }
    );
}

/**
 * @param {GameState} gameState
 */
function resetBoard(gameState) {
    gameState.rectangles = [];
    gameState.pendingSelection = null;
    clearActiveRectangles();
    hideWinOverlay();
    document.getElementById('game-won-overlay').hidden = true;
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
        pauseTimer();
        document.getElementById('game-inactive-overlay').hidden = true;
        clearActiveRectangles();
        showWinOverlay();
        document.getElementById('game-won-overlay').hidden = false;
        setScoreText(getElapsedMs() / 1000);
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
        pauseTimer();
        const answer = await openAlertBox(Message.UNSAVED);
        if (!answer) {
            closeDifficultyMenu();
            return;
        }
    }

    pauseTimer();
    startTimer();
    resetBoard(gameState);
    setDifficulty(difficultyName);
    loadCorrectPuzzle(difficultyName, gameState);
    showStoredScore();
    refreshDifficultyMenu();
    closeDifficultyMenu();
}

/**
 * Update the URL and rebuild the board for the new difficulty without a full reload.
 * `pushState` only changes the address bar — the grid must be regenerated here.
 * @param {string} difficultyName
 * @param {GameState} gameState
 */
function loadCorrectPuzzle(difficultyName, gameState) {
    const difficultyConfig = Difficulty[difficultyName.toUpperCase()] ?? Difficulty.EASY;
    const date = getPlayDateKey();

    const url = new URL(window.location.href);
    url.searchParams.set('difficulty', difficultyConfig.name);
    url.searchParams.set('date', date);
    window.history.pushState({}, '', url);

    const clues = generatePuzzle(difficultyConfig, date);
    const puzzle = createPuzzle(difficultyConfig.size, difficultyConfig.size, clues);
    createGameGrid(puzzle, gameState);
    paintCellStates(gameState);
    document.getElementById('game-inactive-overlay').hidden = false;
}

export function setDifficultySelectOptions() {
    setDifficulty(getDifficulty().name);
    refreshDifficultyMenu();
}

export function toggleDifficultyMenu() {
    const menu = document.getElementById('difficulty-menu');
    const willOpen = menu.hidden;
    menu.hidden = !willOpen;
}

export function closeDifficultyMenu() {
    const menu = document.getElementById('difficulty-menu');
    menu.hidden = true;
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

        const optionButton = document.createElement('button');
        optionButton.type = 'button';
        optionButton.className = 'difficulty-option';
        optionButton.dataset.difficulty = difficulty.name;

        const shape = document.createElement('span');
        shape.className = 'difficulty-shape';
        shape.dataset.difficulty = difficulty.name.toLowerCase();

        optionButton.appendChild(shape);
        item.appendChild(optionButton);
        menu.appendChild(item);
    }
}

export function openAlertBox(message) {
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

export function handleGameWonOverlayClick(gameState) {
    resetBoard(gameState);
    startTimer();
    document.getElementById('game-won-overlay').hidden = true;
    document.getElementById('game-inactive-overlay').hidden = true;
}