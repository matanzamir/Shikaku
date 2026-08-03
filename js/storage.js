import { Difficulty } from './difficulties.js';
import { toDateKey } from './rngCreator.js';

const THEME_KEY = 'theme';
const ACTIVE_RECTANGLES_KEY = 'activeRectangles';
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

const SCORE_KEY = 'score';
const SCORE_DATE_KEY = 'scoreDate';

/**
 * @returns {Record<string, number>} difficulty name → best seconds for today
 */
function readTodayScores() {
    if (localStorage.getItem(SCORE_DATE_KEY) !== toDateKey()) {
        return {};
    }

    const raw = localStorage.getItem(SCORE_KEY);
    if (!raw) {
        return {};
    }

    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

/**
 * Persist today's best times per difficulty.
 * @param {Record<string, number>} scores
 */
function writeTodayScores(scores) {
    localStorage.setItem(SCORE_KEY, JSON.stringify(scores));
    localStorage.setItem(SCORE_DATE_KEY, toDateKey());
}

/**
 * Today's best completion time in seconds for a difficulty, or null if none yet today.
 * @param {string} [difficultyName]
 * @returns {number | null}
 */
export function getScore(difficultyName = getDifficulty().name) {
    const score = Number(readTodayScores()[difficultyName]);
    return Number.isFinite(score) && score > 0 ? score : null;
}

/**
 * Persist a best time for a difficulty.
 * @param {number} scoreSeconds
 * @param {string} [difficultyName]
 */
function setScore(scoreSeconds, difficultyName = getDifficulty().name) {
    const scores = readTodayScores();
    scores[difficultyName] = scoreSeconds;
    writeTodayScores(scores);
}

/**
 * @param {number} scoreSeconds
 * @returns {string} mm:ss
 */
export function returnAsMinuteString(scoreSeconds) {
    const totalSeconds = Math.floor(scoreSeconds);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * @param {string} difficultyName
 * @param {number} scoreSeconds
 */
function formatScoreText(difficultyName, scoreSeconds) {
    return `You've completed the ${difficultyName} difficulty in ${returnAsMinuteString(scoreSeconds)}!`;
}

/**
 * Save a new best for the current difficulty and show it.
 * @param {number} scoreSeconds
 */
export function setScoreText(scoreSeconds) {
    const difficultyName = getDifficulty().name;
    setScore(scoreSeconds, difficultyName);
    document.getElementById('score').textContent = formatScoreText(difficultyName, scoreSeconds);
}

/**
 * Show today's stored best for the current difficulty without rewriting storage.
 */
export function showStoredScore() {
    const difficultyName = getDifficulty().name;
    const score = getScore(difficultyName);
    const scoreEl = document.getElementById('score');
    if (!scoreEl) {
        return;
    }

    if (score === null) {
        scoreEl.textContent = 'Good Luck!';
        return;
    }

    scoreEl.textContent = formatScoreText(difficultyName, score);
}
