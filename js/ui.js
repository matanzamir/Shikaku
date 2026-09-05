import { CellClass } from './cellClasses.js';
import { SelectionMode } from './selectionModes.js';
import {
    buildRectangle,
    createPuzzle,
    findRectangleAt,
    rectanglesOverlap,
    validateRectangle,
    validatePuzzle,
    cellIsInsideRectangle,
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
    getPlayDateKey,
    setSelectionMode,
    getSelectionMode,
    clearSavedElapsedMs,
} from './storage.js';
import { Difficulty } from './difficulties.js';
import { Message } from './messages.js';
import { generatePuzzle } from './puzzleGenerator.js';
import { syncUrlForDate } from './formValidation.js';

/**
 * @typedef {import('./game.js').Puzzle} Puzzle
 * @typedef {import('./game.js').GameState} GameState
 * @typedef {import('./game.js').Clue} Clue
 * @typedef {import('./game.js').Rectangle} Rectangle
 * @typedef {{ row: number, col: number }} CellPos
 * @typedef {{
 *   origin: CellPos,
 *   current: CellPos,
 *   pointerId: number,
 *   didDrag: boolean,
 * }} ActiveDrag
 */


/** @type {AbortController | null} */
let gridListenersAbort = null;

/** @type {ActiveDrag | null} */
let activeDrag = null;

/** @type {Clue[] | null} */
let activePuzzleClues = null;

/** After a completed drag commit, ignore the synthetic click that follows. */
let suppressClickAfterDrag = false;

/** Whether the drag rubber-band is currently shown (for first-frame jump skip). */
let dragPreviewVisible = false;

/**
 * When true, paintCellStates leaves #drag-preview alone so place/remove
 * can hold a solid cover while cell classes swap underneath.
 * @type {boolean}
 */
let dragPreviewLocked = false;

/** @type {ReturnType<typeof setTimeout> | null} */
let rectOverlayAnimTimer = null;

/** Ease used for place/remove rectangle-level motion. */
const RECT_OVERLAY_EASE = '0.22s cubic-bezier(0.22, 1, 0.36, 1)';

/**
 * @param {Puzzle} puzzle
 * @param {GameState} gameState
 */
export function createGameGrid(puzzle, gameState) {
    const gameGrid = document.getElementById('game-grid');

    cancelRectOverlayAnim();
    hideDragPreviewOverlay();
    gameGrid.innerHTML = '';
    activePuzzleClues = puzzle.clues;

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
    clearActiveDrag();

    gameGrid.addEventListener(
        'click',
        (event) => {
            if (suppressClickAfterDrag) return;
            if (!selectionAllowsCorners()) return;
            // After pointer capture, click target is often #game-grid — resolve by point.
            const cell =
                event.target.closest?.('.grid-cell') ??
                cellFromPoint(event.clientX, event.clientY);
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

    gameGrid.addEventListener(
        'pointerdown',
        (event) => {
            handlePointerDown(event, gameState);
        },
        { signal }
    );

    gameGrid.addEventListener(
        'pointermove',
        (event) => {
            handlePointerMove(event, gameState);
        },
        { signal }
    );

    gameGrid.addEventListener(
        'pointerup',
        (event) => {
            handlePointerUp(event, gameState, puzzle);
        },
        { signal }
    );

    gameGrid.addEventListener(
        'pointercancel',
        (event) => {
            handlePointerCancel(event, gameState);
        },
        { signal }
    );
}

/**
 * @param {GameState} gameState
 */
function resetBoard(gameState) {
    const wasWon = !document.getElementById('game-won-overlay').hidden;

    gameState.rectangles = [];
    gameState.pendingSelection = null;
    clearActiveDrag();
    cancelRectOverlayAnim();
    hideDragPreviewOverlay();
    clearActiveRectangles();
    hideWinOverlay();
    document.getElementById('game-won-overlay').hidden = true;
    paintCellStates(gameState);

    if (wasWon) {
        startTimer();
        document.getElementById('game-inactive-overlay').hidden = false;
    }
}

/**
 * Syncs .selected / .rectangle / .validated classes from gameState.
 * Live drag uses a separate eased overlay (#drag-preview).
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
    const preview =
        activeDrag !== null && activeDrag.didDrag
            ? buildRectangle(activeDrag.origin, activeDrag.current)
            : null;

    let previewBlocked = false;
    let previewValid = false;
    if (preview) {
        previewBlocked =
            gameState.rectangles.some(
                (rect) => rect.validated && rectanglesOverlap(preview, rect)
            ) ||
            (activePuzzleClues !== null &&
                !activePuzzleClues.some((clue) => cellIsInsideRectangle(clue, preview)));
        previewValid =
            !previewBlocked &&
            activePuzzleClues !== null &&
            validateRectangle(preview, activePuzzleClues);
    }

    // Paint cells first so a solid fill exists under the band before drag hide.
    cells.forEach((cell) => {
        const row = Number(cell.dataset.row);
        const col = Number(cell.dataset.col);
        const key = `${row},${col}`;
        const visual = cellInfo.get(key);
        const isPendingCorner =
            pending !== null && pending.row === row && pending.col === col;

        cell.classList.toggle(CellClass.RECTANGLE, Boolean(visual));
        cell.classList.toggle(CellClass.VALIDATED, Boolean(visual?.validated));
        cell.classList.toggle(CellClass.EDGE_TOP, Boolean(visual?.edgeTop));
        cell.classList.toggle(CellClass.EDGE_BOTTOM, Boolean(visual?.edgeBottom));
        cell.classList.toggle(CellClass.EDGE_LEFT, Boolean(visual?.edgeLeft));
        cell.classList.toggle(CellClass.EDGE_RIGHT, Boolean(visual?.edgeRight));
        cell.classList.toggle(CellClass.PREVIEW_BLOCKED, false);
        cell.classList.toggle(CellClass.SELECTED, isPendingCorner);
    });

    // Place/remove anim owns the overlay; leave it covering cells mid-swap.
    if (!dragPreviewLocked) {
        syncDragPreviewOverlay(preview, previewBlocked, previewValid);
    }
}

/**
 * @typedef {{ left: number, top: number, width: number, height: number }} OverlayBounds
 */

/**
 * Absolute bounds of a rectangle relative to #game-block's padding box.
 * @param {{ row: number, col: number, width: number, height: number }} rect
 * @returns {OverlayBounds | null}
 */
function measureRectOverlayBounds(rect) {
    const block = document.getElementById('game-block');
    const topLeft = document.querySelector(
        `#game-grid .grid-cell[data-row="${rect.row}"][data-col="${rect.col}"]`
    );
    const bottomRight = document.querySelector(
        `#game-grid .grid-cell[data-row="${rect.row + rect.height - 1}"][data-col="${rect.col + rect.width - 1}"]`
    );
    if (!block || !topLeft || !bottomRight) return null;

    const blockRect = block.getBoundingClientRect();
    const blockStyle = getComputedStyle(block);
    const originX = blockRect.left + (parseFloat(blockStyle.borderLeftWidth) || 0);
    const originY = blockRect.top + (parseFloat(blockStyle.borderTopWidth) || 0);
    const a = topLeft.getBoundingClientRect();
    const b = bottomRight.getBoundingClientRect();

    return {
        left: a.left - originX,
        top: a.top - originY,
        width: b.right - a.left,
        height: b.bottom - a.top,
    };
}

/**
 * @param {OverlayBounds} bounds
 * @param {number} [scale=1]
 * @returns {string}
 */
function overlayTransform(bounds, scale = 1) {
    return `translate(${bounds.left}px, ${bounds.top}px) scale(${scale})`;
}

/**
 * Show the band over a rect without geometry ease (place/remove cover).
 * @param {{ row: number, col: number, width: number, height: number }} rect
 * @param {'valid' | 'outline' | 'blocked'} state
 * @param {{ text?: string, scale?: number }} [options]
 * @returns {boolean}
 */
function showRectOverlayInstant(rect, state, options = {}) {
    const overlay = document.getElementById('drag-preview');
    const bounds = measureRectOverlayBounds(rect);
    if (!overlay || !bounds) return false;

    const scale = options.scale ?? 1;
    overlay.style.transition = 'none';
    overlay.hidden = false;
    overlay.dataset.state = state;
    overlay.textContent = options.text ?? '';
    overlay.style.width = `${bounds.width}px`;
    overlay.style.height = `${bounds.height}px`;
    overlay.style.transform = overlayTransform(bounds, scale);
    overlay.classList.add('is-visible');
    void overlay.offsetWidth;
    overlay.style.transition = '';
    dragPreviewVisible = true;
    return true;
}

/**
 * Cancel any in-flight place/remove overlay animation.
 */
function cancelRectOverlayAnim() {
    if (rectOverlayAnimTimer !== null) {
        clearTimeout(rectOverlayAnimTimer);
        rectOverlayAnimTimer = null;
    }
    dragPreviewLocked = false;
}

/**
 * Corners / cold place: rectangle-level scale-in cover, then reveal cells.
 * Drag commits skip this — they hand off in paintCellStates already.
 * @param {import('./game.js').Rectangle} rect
 */
function animateRectanglePlace(rect) {
    cancelRectOverlayAnim();
    dragPreviewLocked = true;

    const bounds = measureRectOverlayBounds(rect);
    const overlay = document.getElementById('drag-preview');
    const state = rect.validated ? 'valid' : 'outline';

    if (!overlay || !bounds) {
        dragPreviewLocked = false;
        hideDragPreviewOverlay();
        return;
    }

    // Rectangle-level scale-in (not per-cell — that opens hairline gaps).
    showRectOverlayInstant(rect, state, { text: '', scale: 0.96 });

    requestAnimationFrame(() => {
        if (!dragPreviewLocked) return;
        overlay.style.transition = `transform ${RECT_OVERLAY_EASE}`;
        overlay.style.transform = overlayTransform(bounds, 1);
    });

    rectOverlayAnimTimer = setTimeout(() => {
        if (!dragPreviewLocked) return;
        dragPreviewLocked = false;
        rectOverlayAnimTimer = null;
        hideDragPreviewOverlay(overlay);
    }, 60);
}

/**
 * Cover the rect solid, clear cells under the band, then scale out.
 * @param {import('./game.js').Rectangle} rect
 * @param {GameState} gameState
 * @param {Puzzle} puzzle
 */
function removeRectangleAnimated(rect, gameState, puzzle) {
    cancelRectOverlayAnim();
    dragPreviewLocked = true;

    const bounds = measureRectOverlayBounds(rect);
    const overlay = document.getElementById('drag-preview');
    const state = rect.validated ? 'valid' : 'outline';
    const shown = showRectOverlayInstant(rect, state, { text: '', scale: 1 });

    gameState.rectangles = gameState.rectangles.filter((r) => r !== rect);
    commitBoardChange(gameState, puzzle);

    if (!shown || !overlay || !bounds) {
        dragPreviewLocked = false;
        hideDragPreviewOverlay();
        return;
    }

    requestAnimationFrame(() => {
        if (!dragPreviewLocked) return;
        // Stay fully opaque — only scale — so empty grid never fades through.
        overlay.style.transition = `transform ${RECT_OVERLAY_EASE}`;
        overlay.style.transform = overlayTransform(bounds, 0.94);
    });

    const finish = () => {
        if (!dragPreviewLocked) return;
        dragPreviewLocked = false;
        rectOverlayAnimTimer = null;
        hideDragPreviewOverlay(overlay);
    };

    rectOverlayAnimTimer = setTimeout(finish, 240);
}

/**
 * Positions the live-drag rubber-band over the candidate rectangle.
 * Geometry eases via CSS so resizing does not jump cell-by-cell.
 * @param {import('./game.js').Rectangle | null} preview
 * @param {boolean} blocked
 * @param {boolean} valid
 */
function syncDragPreviewOverlay(preview, blocked, valid) {
    const overlay = document.getElementById('drag-preview');
    if (!overlay) return;

    if (!preview) {
        hideDragPreviewOverlay(overlay);
        return;
    }

    const bounds = measureRectOverlayBounds(preview);
    if (!bounds) {
        hideDragPreviewOverlay(overlay);
        return;
    }

    const state = blocked ? 'blocked' : valid ? 'valid' : 'outline';
    const wasHidden = !dragPreviewVisible;

    if (wasHidden) {
        // Jump to starting size with no transition so the first frame does not ease from 0×0.
        overlay.style.transition = 'none';
    }

    overlay.hidden = false;
    overlay.dataset.state = state;
    overlay.textContent = String(preview.width * preview.height);
    overlay.style.width = `${bounds.width}px`;
    overlay.style.height = `${bounds.height}px`;
    overlay.style.transform = overlayTransform(bounds, 1);
    overlay.classList.add('is-visible');

    if (wasHidden) {
        void overlay.offsetWidth;
        overlay.style.transition = '';
    }

    dragPreviewVisible = true;
}

/**
 * @param {HTMLElement | null} [overlay]
 */
function hideDragPreviewOverlay(overlay = document.getElementById('drag-preview')) {
    dragPreviewVisible = false;
    if (!overlay) return;
    // Instant hide: a valid (filled) band must not fade dark over the board.
    overlay.style.transition = 'none';
    overlay.classList.remove('is-visible');
    overlay.hidden = true;
    overlay.removeAttribute('data-state');
    overlay.textContent = '';
    overlay.style.transform = '';
    void overlay.offsetWidth;
    overlay.style.transition = '';
}

/**
 * @param {HTMLElement} cell
 * @param {GameState} gameState
 * @param {{ rows: number, cols: number, clues: Clue[] }} Puzzle
 */
function handleCellClick(cell, gameState, puzzle) {
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
            removeRectangleAnimated(rectangleClicked, gameState, puzzle);
        } else {
            gameState.pendingSelection = { row, col };
            paintCellStates(gameState);
        }
        return;
    }

    // Second corner → shared placement
    placeRectangle(pending, { row, col }, gameState, puzzle);
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
 * Briefly flash cells red to signal an invalid pick / drag commit.
 * @param {{ row: number, col: number, width?: number, height?: number }} region
 */
function flashInvalidRegion(region) {
    const width = region.width ?? 1;
    const height = region.height ?? 1;

    for (let r = region.row; r < region.row + height; r++) {
        for (let c = region.col; c < region.col + width; c++) {
            const cell = document.querySelector(
                `#game-grid .grid-cell[data-row="${r}"][data-col="${c}"]`
            );
            if (!cell) continue;

            cell.classList.remove(CellClass.INVALID);
            void cell.offsetWidth;
            cell.classList.add(CellClass.INVALID);
            cell.addEventListener(
                'animationend',
                () => cell.classList.remove(CellClass.INVALID),
                { once: true }
            );
        }
    }
}

/**
 * @param {CellPos} pending
 */
function flashInvalidSelection(pending) {
    flashInvalidRegion(pending);
}

/**
 * Shared place path for corners second-click and drag-commit.
 * @param {CellPos} start
 * @param {CellPos} end
 * @param {GameState} gameState
 * @param {Puzzle} puzzle
 * @returns {boolean}
 */
function placeRectangle(start, end, gameState, puzzle) {
    const candidate = buildRectangle(start, end);
    const overlapping = gameState.rectangles.filter((rect) =>
        rectanglesOverlap(candidate, rect)
    );

    if (
        overlapping.some((rect) => rect.validated) ||
        !puzzle.clues.some((clue) => cellIsInsideRectangle(clue, candidate))
    ) {
        // Reject silently — preview state already signals conflict while dragging.
        paintCellStates(gameState);
        return false;
    }

    gameState.rectangles = gameState.rectangles.filter(
        (rect) => !overlapping.includes(rect)
    );

    candidate.validated = validateRectangle(candidate, puzzle.clues);
    gameState.rectangles.push(candidate);
    gameState.pendingSelection = null;

    // Drag band still up → paintCellStates paints cells then drops the cover
    // in the same turn (instant). Corners have no band → scale-in after paint.
    const fromDrag = dragPreviewVisible;
    commitBoardChange(gameState, puzzle);
    if (!fromDrag) {
        animateRectanglePlace(candidate);
    }
    return true;
}

/**
 * @param {GameState} gameState
 * @param {Puzzle} puzzle
 */
function commitBoardChange(gameState, puzzle) {
    setActiveRectangles(gameState.rectangles);
    paintCellStates(gameState);
    if (validatePuzzle(gameState.rectangles, puzzle.rows * puzzle.cols)) {
        pauseTimer();
        document.getElementById('game-inactive-overlay').hidden = true;
        clearActiveRectangles();
        showWinOverlay();
        document.getElementById('game-won-overlay').hidden = false;
        setScoreText(getElapsedMs() / 1000);
        clearSavedElapsedMs();
    }
}

/**
 * @returns {string}
 */
function currentSelectionMode() {
    const el = document.getElementById('selection-mode-switch');
    return el?.dataset.mode || getSelectionMode();
}

/**
 * @returns {boolean}
 */
function selectionAllowsCorners() {
    const mode = currentSelectionMode();
    return mode === SelectionMode.CORNERS || mode === SelectionMode.BOTH;
}

/**
 * @returns {boolean}
 */
function selectionAllowsDrag() {
    const mode = currentSelectionMode();
    return mode === SelectionMode.DRAG || mode === SelectionMode.BOTH;
}

/**
 * @param {number} clientX
 * @param {number} clientY
 * @returns {HTMLElement | null}
 */
function cellFromPoint(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    return el?.closest?.('.grid-cell') ?? null;
}

/**
 * @param {HTMLElement} cell
 * @returns {CellPos}
 */
function coordsFromCell(cell) {
    return {
        row: Number(cell.dataset.row),
        col: Number(cell.dataset.col),
    };
}

function clearActiveDrag() {
    activeDrag = null;
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
 * Rebuild the board for the new difficulty without a full reload.
 * `pushState` only changes the address bar — the grid must be regenerated here.
 * @param {string} difficultyName
 * @param {GameState} gameState
 */
function loadCorrectPuzzle(difficultyName, gameState) {
    const difficultyConfig = Difficulty[difficultyName.toUpperCase()] ?? Difficulty.EASY;
    const date = getPlayDateKey();

    syncUrlForDate(date, 'push');

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
    message === Message.INVALID_QUERY ? document.getElementById('cancel-btn').hidden = true : document.getElementById('cancel-btn').hidden = false;
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

export function handleSelectionModeSwitchClick(selectionModeSwitch, gameState) {
    const mode = selectionModeSwitch.dataset.mode;
    const newMode =
        mode === SelectionMode.CORNERS
            ? SelectionMode.BOTH
            : mode === SelectionMode.BOTH
              ? SelectionMode.DRAG
              : SelectionMode.CORNERS;
    selectionModeSwitch.dataset.mode = newMode;
    setSelectionMode(newMode);
    clearActiveDrag();
    if (gameState.pendingSelection && newMode === SelectionMode.DRAG) {
        flashInvalidSelection(gameState.pendingSelection);
        gameState.pendingSelection = null;
    }
    paintCellStates(gameState);
}

/**
 * A press counts as a drag only after the pointer enters another cell.
 * In-cell jitter must not place a 1×1.
 * @param {PointerEvent} event
 * @param {ActiveDrag} drag
 * @returns {boolean} true if this event left the origin cell
 */
function updateDragFromEvent(event, drag) {
    const cell = cellFromPoint(event.clientX, event.clientY);
    if (!cell) return drag.didDrag;

    const coords = coordsFromCell(cell);
    if (
        coords.row !== drag.origin.row ||
        coords.col !== drag.origin.col
    ) {
        drag.didDrag = true;
    }

    if (
        coords.row !== drag.current.row ||
        coords.col !== drag.current.col
    ) {
        drag.current = coords;
    }

    return drag.didDrag;
}

/**
 * @param {PointerEvent} event
 * @param {GameState} gameState
 */
export function handlePointerDown(event, gameState) {
    if (!selectionAllowsDrag()) return;
    if (event.button !== 0) return;
    // Only the first/capturing pointer owns the gesture (ignore secondary fingers).
    if (activeDrag) return;

    const cell =
        event.target.closest?.('.grid-cell') ??
        cellFromPoint(event.clientX, event.clientY);
    if (!cell) return;

    const coords = coordsFromCell(cell);
    activeDrag = {
        origin: coords,
        current: coords,
        pointerId: event.pointerId,
        didDrag: false,
    };

    event.currentTarget.setPointerCapture?.(event.pointerId);
    // No paint until the pointer actually moves — avoid 1×1 tap flash.
}

/**
 * @param {PointerEvent} event
 * @param {GameState} gameState
 */
export function handlePointerMove(event, gameState) {
    if (!activeDrag || event.pointerId !== activeDrag.pointerId) return;

    const wasDragging = activeDrag.didDrag;
    const prevRow = activeDrag.current.row;
    const prevCol = activeDrag.current.col;
    updateDragFromEvent(event, activeDrag);

    if (
        !activeDrag.didDrag ||
        (wasDragging &&
            activeDrag.current.row === prevRow &&
            activeDrag.current.col === prevCol)
    ) {
        return;
    }

    // Drag takes over: drop any pending corner so .selected margin/hit-testing
    // can't stall the gesture, and release won't be treated as a second click.
    if (!wasDragging && gameState.pendingSelection) {
        gameState.pendingSelection = null;
    }

    paintCellStates(gameState);
}

/**
 * @param {PointerEvent} event
 * @param {GameState} gameState
 * @param {Puzzle} puzzle
 */
export function handlePointerUp(event, gameState, puzzle) {
    if (!activeDrag || event.pointerId !== activeDrag.pointerId) return;

    updateDragFromEvent(event, activeDrag);

    const { origin, current, didDrag } = activeDrag;
    clearActiveDrag();

    if (event.currentTarget?.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
    }

    // In both / corners-capable modes, leave tap / delete / first-corner to click.
    if (!didDrag && selectionAllowsCorners()) {
        paintCellStates(gameState);
        return;
    }

    // Drag-only tap: remove existing rectangle, never place a 1×1.
    if (!didDrag) {
        const rectangleClicked = findRectangleAt(origin, gameState.rectangles);
        if (rectangleClicked) {
            removeRectangleAnimated(rectangleClicked, gameState, puzzle);
        } else {
            paintCellStates(gameState);
        }
        return;
    }

    // Drag that ended on the start cell (press-release or drag-back) is not a rectangle.
    if (origin.row === current.row && origin.col === current.col) {
        gameState.pendingSelection = null;
        suppressClickAfterDrag = true;
        paintCellStates(gameState);
        setTimeout(() => {
            suppressClickAfterDrag = false;
        }, 50);
        return;
    }

    // Real drag: commit through the shared placement path.
    // Swallow the synthetic click that follows a drag, then clear the flag.
    // Pending corner (if any) is already cleared when the drag started; clear
    // again for fast flicks that only resolve on pointerup.
    gameState.pendingSelection = null;
    suppressClickAfterDrag = true;
    placeRectangle(origin, current, gameState, puzzle);
    setTimeout(() => {
        suppressClickAfterDrag = false;
    }, 50);
}

/**
 * @param {PointerEvent} event
 * @param {GameState} gameState
 */
export function handlePointerCancel(event, gameState) {
    if (!activeDrag || event.pointerId !== activeDrag.pointerId) return;
    clearActiveDrag();
    if (event.currentTarget?.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
    }
    paintCellStates(gameState);
}

