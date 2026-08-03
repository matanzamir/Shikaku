import { handleDrawerClick } from './drawer.js';
import {
    handleLightDarkClick,
    handleDifficultyChange,
    toggleDifficultyMenu,
    closeDifficultyMenu,
    handleGameInactiveOverlayClick,
    handleGameWonOverlayClick,
} from './ui.js';
import { handleTimerClick, handleTimerVisibilityChange } from './timer.js';
import { handleInstructionsButtonClick, handleSlideLeftButtonClick, handleSlideRightButtonClick } from './drawer.js';

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
    const difficultyButton = document.getElementById('difficulty-button');
    const difficultyMenu = document.getElementById('difficulty-menu');

    difficultyButton.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleDifficultyMenu();
    });

    difficultyMenu.addEventListener('click', (event) => {
        const option = event.target.closest('.difficulty-option');
        if (!option) return;
        handleDifficultyChange(option.dataset.difficulty, gameState);
    });

    document.addEventListener('click', (event) => {
        if (event.target.closest('.difficulty-pill')) return;
        closeDifficultyMenu();
    });
}

export async function addInstructionsButtonEventListener() {
    const maxImageIndex = await getMaxImageIndex();
    const instructionsButton = document.getElementById('instructions-button');
    instructionsButton.addEventListener('click', () => {
        handleInstructionsButtonClick(maxImageIndex);
    });

    const slideLeftButton = document.getElementById('slide-left');
    slideLeftButton.addEventListener('click', () => {
        handleSlideLeftButtonClick(maxImageIndex);
    });
    const slideRightButton = document.getElementById('slide-right');
    slideRightButton.addEventListener('click', () => {
        handleSlideRightButtonClick(maxImageIndex);
    });
}

function getMaxImageIndex() {
    return new Promise((resolve) => {
        let index = 0;

        function probeNext() {
            const img = new Image();
            img.onload = () => {
                index++;
                probeNext();
            };
            img.onerror = () => {
                resolve(index);
            };
            img.src = `assets/instruction-images/${index + 1}.png`;
        }

        probeNext();
    });
}

export function addGameInactiveOverlayEventListener() {
    const gameInactiveOverlay = document.getElementById('game-inactive-overlay');
    gameInactiveOverlay.addEventListener('click', () => {
        handleGameInactiveOverlayClick();
    });
}

export function addGameWonOverlayEventListener(gameState) {
    const gameWonOverlay = document.getElementById('game-won-overlay');
    gameWonOverlay.addEventListener('click', () => {
        handleGameWonOverlayClick(gameState);
    });
}