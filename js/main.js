import { createPuzzle, createGameState } from './game.js';
import { init } from './init.js';
import { resolveQuery, redirectToQuery, playUrlForDate } from './formValidation.js';
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

const { date, difficulty, wasInvalid, snappedFrom } = resolveQuery();
const previousDifficulty = getDifficulty().name;
const target = await resolvePlayTarget();

if (target !== null) {
    const difficultyConfig = Difficulty[target.difficulty.toUpperCase()] ?? Difficulty.EASY;
    setDifficulty(difficultyConfig.name);
    setPlayDateKey(target.date);

    const clues = generatePuzzle(difficultyConfig, target.date);
    const puzzle = createPuzzle(difficultyConfig.size, difficultyConfig.size, clues);
    const gameState = createGameState();
    init(puzzle, gameState);

    if (wasInvalid) {
        openAlertBox(Message.INVALID_QUERY);
    }
}

/**
 * Pick the puzzle this load ends up on, asking before any progress is dropped.
 * The query follows that decision, so declining leaves the address bar untouched.
 * @returns {Promise<{ date: string, difficulty: string } | null>} null while navigating away instead of booting
 */
async function resolvePlayTarget() {
    if (await confirmDateChangeProgress(date)) {
        if (snappedFrom !== null) {
            redirectToQuery(date);
        }
        return { date, difficulty };
    }

    // Declined: keep playing the day the progress belongs to.
    const progressDate = getProgressDateKey();

    // A deferred reload snap never moved the query, so that day is still loadable in place.
    if (snappedFrom !== null) {
        redirectToQuery(progressDate);
        return { date: progressDate, difficulty: previousDifficulty };
    }

    window.location.replace(playUrlForDate(progressDate));
    return null;
}

/**
 * If saved progress is for a different day, ask before discarding it.
 * Proceed → clear.
 * @param {string} newDateKey
 * @returns {Promise<boolean>} false when the player kept the in-progress day
 */
async function confirmDateChangeProgress(newDateKey) {
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
    }

    return answer;
}
