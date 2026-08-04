import { Difficulty } from './difficulties.js';
import { toDateKey } from './rngCreator.js';

const THEME_KEY = 'theme';
const ACTIVE_RECTANGLES_KEY = 'activeRectangles';
/** Local YYYY-MM-DD the in-progress rectangles belong to */
const PROGRESS_DATE_KEY = 'progressDate';
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
    if (rectangles.length === 0) {
        localStorage.removeItem(PROGRESS_DATE_KEY);
    } else {
        localStorage.setItem(PROGRESS_DATE_KEY, getPlayDateKey());
    }
}

export function clearActiveRectangles() {
    localStorage.setItem(ACTIVE_RECTANGLES_KEY, JSON.stringify([]));
    localStorage.removeItem(PROGRESS_DATE_KEY);
}

/**
 * Date of the saved in-progress board, or null if none.
 * @returns {string | null}
 */
export function getProgressDateKey() {
    return localStorage.getItem(PROGRESS_DATE_KEY);
}

/**
 * @param {string} dateKey YYYY-MM-DD
 */
export function setProgressDateKey(dateKey) {
    localStorage.setItem(PROGRESS_DATE_KEY, dateKey);
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

/** @type {string} local YYYY-MM-DD for the puzzle currently loaded */
let playDateKey = toDateKey();

/**
 * Bind score/clearance reads and writes to the active puzzle day (from `?date=` or today).
 * @param {string} dateKey YYYY-MM-DD
 */
export function setPlayDateKey(dateKey) {
    playDateKey = dateKey;
    document.getElementById('date').textContent = `${dateKey.split('-').slice(0, 3).reverse().join('/')}`;
}

/**
 * @returns {string} YYYY-MM-DD
 */
export function getPlayDateKey() {
    return playDateKey;
}

/** dateKey → { difficultyName → best seconds } */
const CLEARED_PUZZLES_KEY = 'clearedPuzzles';

/**
 * @returns {Record<string, Record<string, number>>}
 */
function readClearedPuzzles() {
    const raw = localStorage.getItem(CLEARED_PUZZLES_KEY);
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
 * @param {Record<string, Record<string, number>>} map
 */
function writeClearedPuzzles(map) {
    localStorage.setItem(CLEARED_PUZZLES_KEY, JSON.stringify(map));
}

/**
 * Record a clear for a date + difficulty, keeping the best time.
 * @param {string} dateKey YYYY-MM-DD
 * @param {string} difficultyName
 * @param {number} scoreSeconds
 */
export function markPuzzleCleared(dateKey, difficultyName, scoreSeconds) {
    const map = readClearedPuzzles();
    const day = { ...(map[dateKey] ?? {}) };
    const prev = Number(day[difficultyName]);
    if (!Number.isFinite(prev) || prev <= 0 || scoreSeconds < prev) {
        day[difficultyName] = scoreSeconds;
        map[dateKey] = day;
        writeClearedPuzzles(map);
    }
}

/**
 * @param {string} dateKey YYYY-MM-DD
 * @param {string} [difficultyName]
 * @returns {boolean}
 */
export function isPuzzleCleared(dateKey, difficultyName = getDifficulty().name) {
    return getScore(difficultyName, dateKey) !== null;
}

/**
 * Dates that have at least one clearance, optionally filtered by difficulty.
 * @param {string} [difficultyName]
 * @returns {string[]} sorted YYYY-MM-DD keys
 */
export function getClearedDates(difficultyName) {
    const map = readClearedPuzzles();
    return Object.keys(map)
        .filter((dateKey) => {
            const day = map[dateKey];
            if (!day || typeof day !== 'object') {
                return false;
            }
            if (difficultyName === undefined) {
                return Object.keys(day).some((name) => {
                    const score = Number(day[name]);
                    return Number.isFinite(score) && score > 0;
                });
            }
            const score = Number(day[difficultyName]);
            return Number.isFinite(score) && score > 0;
        })
        .sort();
}

/**
 * Best completion time in seconds for a difficulty on a date, or null if uncleared.
 * @param {string} [difficultyName]
 * @param {string} [dateKey] defaults to the active play date
 * @returns {number | null}
 */
export function getScore(difficultyName = getDifficulty().name, dateKey = getPlayDateKey()) {
    const day = readClearedPuzzles()[dateKey];
    if (!day || typeof day !== 'object') {
        return null;
    }

    const score = Number(day[difficultyName]);
    return Number.isFinite(score) && score > 0 ? score : null;
}

/**
 * Persist a best time for a difficulty on the active play date.
 * @param {number} scoreSeconds
 * @param {string} [difficultyName]
 */
function setScore(scoreSeconds, difficultyName = getDifficulty().name) {
    markPuzzleCleared(getPlayDateKey(), difficultyName, scoreSeconds);
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
    return `${difficultyName}\ncompleted in ${returnAsMinuteString(scoreSeconds)}`;
}

/**
 * Save best for the active date + difficulty and show it.
 * @param {number} scoreSeconds
 */
export function setScoreText(scoreSeconds) {
    const difficultyName = getDifficulty().name;
    setScore(scoreSeconds, difficultyName);
    const best = getScore(difficultyName);
    if (best === null) {
        return;
    }
    document.getElementById('score').textContent = formatScoreText(difficultyName, best);
}

/**
 * Show stored best for the active play date + difficulty without rewriting storage.
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
