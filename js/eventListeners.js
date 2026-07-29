import { handleDrawerClick } from './drawer.js';
import { handleLightDarkClick, handleDifficultySelectChange } from './ui.js';
import { handleTimerClick, handleTimerVisibilityChange } from './timer.js';

export function addDrawerEventListener() {
    const drawerButton = document.getElementById('drawer-button');
    drawerButton.addEventListener('click', () => {
        handleDrawerClick(drawerButton);
    });
}

export function addLightDarkEventListener() {
    const lightDarkButton = document.getElementById('light-dark-button');
    lightDarkButton.addEventListener('click', () => {
        handleLightDarkClick(lightDarkButton);
    });
}

export function addTimerEventListener() {
    const pauseButton = document.getElementById('pause-button');
    pauseButton.addEventListener('click', () => {
        handleTimerClick();
    });
    
    document.addEventListener('visibilitychange', () => {
        handleTimerVisibilityChange();
    });
}

export function addDifficultySelectEventListener(gameState) {
    const difficultySelect = document.getElementById('difficulty-select');
    difficultySelect.addEventListener('change', () => {
        handleDifficultySelectChange(difficultySelect, gameState);
    });
}