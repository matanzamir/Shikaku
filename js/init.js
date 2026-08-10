import { startTimer } from './timer.js';
import { 
    addDrawerEventListener, 
    addLightDarkEventListener, 
    addTimerEventListener, 
    addDifficultySelectEventListener,
    addInstructionsButtonEventListener,
    addGameInactiveOverlayEventListener,
    addGameWonOverlayEventListener,
    addSelectionModeSwitchEventListener,
} from './eventListeners.js';
import { updateBodyTheme, createGameGrid, paintCellStates, setDifficultySelectOptions } from './ui.js';
import { getTheme, 
        getActiveRectangles, 
        showStoredScore, 
        getSelectionMode } from './storage.js';

export function init(puzzle, gameState) {
    const selectionModeSwitch = document.getElementById('selection-mode-switch');
    const selectionMode = getSelectionMode();
    selectionModeSwitch.dataset.mode = selectionMode;
    // Enable thumb slide after first paint so boot mode apply does not animate
    requestAnimationFrame(() => {
        selectionModeSwitch.classList.add('selection-mode-ready');
    });

    const theme = getTheme();
    updateBodyTheme(theme, document.getElementById('light-dark-button'));

    setDifficultySelectOptions();
    
    createGameGrid(puzzle, gameState);

    gameState.rectangles = getActiveRectangles();
    paintCellStates(gameState);

    showStoredScore();

    startTimer();
    addEventListeners(gameState);
}

async function addEventListeners(gameState) {
    addDrawerEventListener();
    addLightDarkEventListener();
    addTimerEventListener();
    addDifficultySelectEventListener(gameState);
    await addInstructionsButtonEventListener();
    addGameInactiveOverlayEventListener();
    addGameWonOverlayEventListener(gameState);
    addSelectionModeSwitchEventListener(gameState);
}
