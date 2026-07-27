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

function tick() {
    if (!isPaused) {
        render();
    }
}

export function startTimer() {
    stopTimer();
    startTime = Date.now();
    pauseStartedAt = 0;
    isPaused = false;
    pauseButton.textContent = 'Pause';
    render();
    intervalId = setInterval(tick, 1000);
}

export function pauseTimer() {
    if (isPaused || startTime === 0 || intervalId === null) {
        return;
    }

    isPaused = true;
    pauseStartedAt = Date.now();
    pauseButton.textContent = 'Resume';
    render();
}

export function resumeTimer() {
    if (!isPaused || startTime === 0) {
        return;
    }

    startTime += Date.now() - pauseStartedAt;
    pauseStartedAt = 0;
    isPaused = false;
    pauseButton.textContent = 'Pause';
    render();
}

export function stopTimer() {
    if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
    }

    isPaused = false;
    pauseStartedAt = 0;
    pauseButton.textContent = 'Pause';
}

export function resetTimer() {
    startTimer();
}

pauseButton.addEventListener('click', () => {
    if (isPaused) {
        resumeTimer();
    } else {
        pauseTimer();
    }
});
