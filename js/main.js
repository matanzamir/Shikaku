import { createPuzzle, createGameState } from './game.js';
import { init } from './init.js';
import { resolveQuery } from './formValidation.js';
import { generatePuzzle } from './puzzleGenerator.js';
import { Difficulty } from './difficulties.js';
import {
    setDifficulty,
    setPlayDateKey,
    getActiveRectangles,
    getProgressDateKey,
    setProgressDateKey,
    clearActiveRectangles,
    getDifficulty,
} from './storage.js';
import { openAlertBox } from './ui.js';
import { Message } from './messages.js';

const { date, difficulty, wasInvalid } = resolveQuery();
const difficultyConfig = Difficulty[difficulty.toUpperCase()] ?? Difficulty.EASY;
const previousDifficulty = getDifficulty().name;

if (await confirmDateChangeProgress(date, previousDifficulty)) {
    setDifficulty(difficultyConfig.name);
    setPlayDateKey(date);

    const clues = generatePuzzle(difficultyConfig, date);
    const puzzle = createPuzzle(difficultyConfig.size, difficultyConfig.size, clues);
    const gameState = createGameState();
    init(puzzle, gameState);

    if (wasInvalid) {
        openAlertBox(Message.INVALID_QUERY);
    }
}

/**
 * If saved progress is for a different day, ask before discarding it.
 * Proceed → clear. Cancel → return to the progress day when known.
 * @param {string} newDateKey
 * @param {string} previousDifficulty difficulty from before this load's URL was applied
 * @returns {Promise<boolean>}
 */
async function confirmDateChangeProgress(newDateKey, previousDifficulty) {
    if (getActiveRectangles().length === 0) {
        return true;
    }

    const progressDate = getProgressDateKey();
    if (progressDate === null) {
        // Legacy in-progress board with no day tag: claim it for this load.
        setProgressDateKey(newDateKey);
        return true;
    }
    if (progressDate === newDateKey) {
        return true;
    }

    const answer = await openAlertBox(Message.UNSAVED);
    if (answer) {
        clearActiveRectangles();
        return true;
    }

    const url = new URL(window.location.href);
    url.searchParams.set('date', progressDate);
    url.searchParams.set('difficulty', previousDifficulty);
    window.location.replace(url.toString());
    return false;
}
