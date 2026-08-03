import { startTimer } from './timer.js';
import { 
    addDrawerEventListener, 
    addLightDarkEventListener, 
    addTimerEventListener, 
    addDifficultySelectEventListener,
    addInstructionsButtonEventListener,
    addGameInactiveOverlayEventListener } from './eventListeners.js';
import { updateBodyTheme, createGameGrid, paintCellStates, setDifficultySelectOptions } from './ui.js';
import { getTheme, getActiveRectangles, showStoredScore } from './storage.js';

export function init(puzzle, gameState) {
    const theme = getTheme();
    updateBodyTheme(theme, document.getElementById('light-dark-button'));

    setDifficultySelectOptions();

    // ToDo: create puzzle and removing it from variables list
    
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
}
