import { handleDrawerClick } from './drawer.js';
import { handleLightDarkClick, handleDifficultySelectChange } from './ui.js';
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
    const difficultySelect = document.getElementById('difficulty-select');
    difficultySelect.addEventListener('change', () => {
        handleDifficultySelectChange(difficultySelect, gameState);
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
