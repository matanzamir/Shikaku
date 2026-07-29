import { SAMPLE_PUZZLE, createGameState } from './game.js';
import { init } from './init.js';

const puzzle = SAMPLE_PUZZLE;
const gameState = createGameState();
init(puzzle, gameState);

export { puzzle, gameState };
