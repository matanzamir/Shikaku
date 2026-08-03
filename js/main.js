import { createPuzzle, createGameState } from './game.js';
import { init } from './init.js';
import { resolveQuery } from './formValidation.js';
import { generatePuzzle } from './puzzleGenerator.js';
import { Difficulty } from './difficulties.js';
import { setDifficulty } from './storage.js';
import { openAlertBox } from './ui.js';
import { Message } from './messages.js';

const { date, difficulty, wasInvalid } = resolveQuery();
const difficultyConfig = Difficulty[difficulty.toUpperCase()] ?? Difficulty.EASY;

setDifficulty(difficultyConfig.name);

const clues = generatePuzzle(difficultyConfig, date);
const puzzle = createPuzzle(difficultyConfig.size, difficultyConfig.size, clues);
const gameState = createGameState();
init(puzzle, gameState);

if (wasInvalid) {
    openAlertBox(Message.INVALID_QUERY);
}

export { puzzle, gameState };
