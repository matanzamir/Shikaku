import { Difficulty } from './difficulties.js';

const THEME_KEY = 'theme';
const ACTIVE_RECTANGLES_KEY = 'activeRectangles';
const TIMER_OFFSET_KEY = 'timerOffset';
const DIFFICULTY_KEY = 'difficulty';

/**
 * @returns {'light' | 'dark'}
 */
export function getTheme() {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
}

/**
 * @param {'light' | 'dark'} theme
 */
export function setTheme(theme) {
    localStorage.setItem(THEME_KEY, theme);
}

/**
 * @returns {import('./game.js').Rectangle[]}
 */
export function getActiveRectangles() {
    const raw = localStorage.getItem(ACTIVE_RECTANGLES_KEY);
    if (!raw) {
        return [];
    }

    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

/**
 * @param {import('./game.js').Rectangle[]} rectangles
 */
export function setActiveRectangles(rectangles) {
    localStorage.setItem(ACTIVE_RECTANGLES_KEY, JSON.stringify(rectangles));
}

export function clearActiveRectangles() {
    localStorage.setItem(ACTIVE_RECTANGLES_KEY, JSON.stringify([]));
}

export function getTimerOffset() {
    const ms = Number(localStorage.getItem(TIMER_OFFSET_KEY));
    return Number.isFinite(ms) && ms > 0 ? ms : 0;
}

export function setTimerOffset(ms) {
    localStorage.setItem(TIMER_OFFSET_KEY, String(ms));
}

export function clearTimerOffset() {
    localStorage.removeItem(TIMER_OFFSET_KEY);
}   

export function getDifficulty() {
    return localStorage.getItem(DIFFICULTY_KEY) ? Difficulty[localStorage.getItem(DIFFICULTY_KEY).toUpperCase()] : Difficulty.EASY;
}

export function setDifficulty(difficulty) {
    localStorage.setItem(DIFFICULTY_KEY, difficulty);
    const currentShape = document.querySelector('#difficulty-button .difficulty-shape');
    if (currentShape) {
        currentShape.dataset.difficulty = String(difficulty).toLowerCase();
    }
}
