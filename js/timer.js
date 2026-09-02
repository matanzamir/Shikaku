import { setSavedElapsedMs, clearSavedElapsedMs } from './storage.js';

let startTime = 0;
let pauseStartedAt = 0;
let isPaused = false;
let intervalId = null;
let timerOffset = 0;

const minutesEl = document.getElementById('minutes');
const secondsEl = document.getElementById('seconds');
const pauseButton = document.getElementById('pause-button');

function pad(value) {
    return String(value).padStart(2, '0');
}

export function getElapsedMs() {
    if (startTime === 0) {
        return 0;
    }

    const end = isPaused ? pauseStartedAt : Date.now();
    return Math.max(0, end - startTime);
}

function render() {
    const elapsedMs = getElapsedMs();
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    minutesEl.textContent = pad(minutes);
    secondsEl.textContent = pad(seconds);
}

function clearTick() {
    if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
    }
}

function startTick() {
    clearTick();
    intervalId = setInterval(() => {
        render();
        setSavedElapsedMs(getElapsedMs());
    }, 1000);
}

/**
 * Begin a paused run at `offsetMs`, so a reload can pick the clock back up.
 * @param {number} [offsetMs] elapsed ms to resume from; 0 starts a fresh puzzle
 */
export function startTimer(offsetMs = 0) {
    clearTick();
    const now = Date.now();
    timerOffset = offsetMs;
    startTime = now - timerOffset;
    isPaused = true;
    pauseStartedAt = now;
    pauseButton.textContent = '▷';
    render();

    if (timerOffset === 0) {
        clearSavedElapsedMs();
    } else {
        setSavedElapsedMs(timerOffset);
    }
}

export function pauseTimer() {
    if (isPaused || startTime === 0) {
        return;
    }

    isPaused = true;
    pauseStartedAt = Date.now();
    clearTick();
    timerOffset = getElapsedMs();
    setSavedElapsedMs(timerOffset);
    pauseButton.textContent = '▷';
    render();
    document.getElementById('game-inactive-overlay').hidden = false;
}

export function resumeTimer() {
    if (!isPaused || startTime === 0) {
        return;
    }
    startTime += Date.now() - pauseStartedAt;
    pauseStartedAt = 0;
    isPaused = false;
    pauseButton.textContent = '⏸';
    render();
    startTick();
    document.getElementById('game-inactive-overlay').hidden = true;
}

export function handleTimerClick() {
    if (isPaused) {
        resumeTimer();
    } else {
        pauseTimer();
    }
}

export function handleTimerVisibilityChange() {
    if (document.hidden) {
        if (!isPaused) {
            pauseTimer();
        }
    }
}
