import { getTimerOffset, setTimerOffset } from './storage.js';

let startTime = 0;
let pauseStartedAt = 0;
let isPaused = false;
let intervalId = null;

const minutesEl = document.getElementById('minutes');
const secondsEl = document.getElementById('seconds');
const pauseButton = document.getElementById('pause-button');

function pad(value) {
    return String(value).padStart(2, '0');
}

function getElapsedMs() {
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
    intervalId = setInterval(render, 1000);
}

export function startTimer() {
    clearTick();
    const offset = getTimerOffset();
    startTime = Date.now() - offset;
    isPaused = true;
    pauseStartedAt = Date.now();
    pauseButton.textContent = '▷';
    render();
}

export function pauseTimer() {
    if (isPaused || startTime === 0) {
        return;
    }

    isPaused = true;
    pauseStartedAt = Date.now();
    clearTick();
    setTimerOffset(getElapsedMs());
    pauseButton.textContent = '▷';
    render();
    //ToDo: blur board
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
    //ToDo: unblur board
}

export function stopTimer() {
    if (startTime === 0) {
        return;
    }

    if (!isPaused) {
        pauseStartedAt = Date.now();
        isPaused = true;
    }

    clearTick();
    setTimerOffset(getElapsedMs());
    render();
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
