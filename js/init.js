import { startTimer } from './timer.js';
import { 
    addDrawerEventListener, 
    addLightDarkEventListener, 
    addTimerEventListener, 
    addDifficultySelectEventListener } from './eventListeners.js';
import { updateBodyTheme, createGameGrid, paintCellStates, setDifficultySelectOptions } from './ui.js';
import { getTheme, getActiveRectangles } from './storage.js';

export function init(puzzle, gameState) {
    const theme = getTheme();
    updateBodyTheme(theme, document.getElementById('light-dark-button'));

    setDifficultySelectOptions();

    // ToDo: create puzzle and removing it from variables list
    
    createGameGrid(puzzle, gameState);

    gameState.rectangles = getActiveRectangles();
    paintCellStates(gameState);

    startTimer();
    addEventListeners();
}

function addEventListeners() {
    addDrawerEventListener();
    addLightDarkEventListener();
    addTimerEventListener();
    addDifficultySelectEventListener();
}
