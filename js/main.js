import { SAMPLE_PUZZLE, createGameState, createGameGrid } from './game.js';

const puzzle = SAMPLE_PUZZLE;
const gameState = createGameState();
createGameGrid(puzzle);

export { puzzle, gameState };
