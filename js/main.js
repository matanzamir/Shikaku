import { SAMPLE_PUZZLE, createGameState } from './game.js';
import { createGameGrid } from './ui.js';
import { startTimer } from './timer.js';
import { addDrawerEventListener } from './drawer.js';

const puzzle = SAMPLE_PUZZLE;
const gameState = createGameState();
createGameGrid(puzzle, gameState);
startTimer();
addDrawerEventListener();

export { puzzle, gameState };
