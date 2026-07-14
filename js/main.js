import { SAMPLE_PUZZLE, createGameState } from './game.js';
import { createGameGrid } from './ui.js';

const puzzle = SAMPLE_PUZZLE;
const gameState = createGameState();
createGameGrid(puzzle, gameState);

export { puzzle, gameState };
