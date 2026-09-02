/**
 * Tests for the fault-line detector and the partition shuffle.
 *
 *   $env:ELECTRON_RUN_AS_NODE=1
 *   & "$env:LOCALAPPDATA\Programs\cursor\Cursor.exe" tmp_test/testShuffle.mjs
 */

import { Difficulty } from '../js/difficulties.js';
import { createSeededRng, mulberry32 } from '../js/rngCreator.js';
import { partitionRecursion, generateBoard } from '../js/puzzleGenerator.js';
import { hasUniqueSolution } from '../js/puzzleValidator.js';
import { isBoring } from '../js/boredomCheck.js';
import { faultLines, isGuillotine, seamProfile, validateTiling, rectanglesTouch } from '../js/faultLines.js';
import { shufflePartition, closureAround, reRollBlock, seamCost } from '../js/partitionShuffle.js';

let passed = 0;
let failed = 0;

/**
 * @param {string} name
 * @param {boolean} condition
 * @param {string} [detail]
 */
function check(name, condition, detail = '') {
    if (condition) {
        passed++;
        return;
    }
    failed++;
    console.error(`  FAIL  ${name}${detail ? `\n        ${detail}` : ''}`);
}

/**
 * @param {string} name
 * @param {unknown} actual
 * @param {unknown} expected
 */
function checkEqual(name, actual, expected) {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    check(name, a === b, `expected ${b}\n        actual   ${a}`);
}

/**
 * The 6x6 layout worked through by hand while designing the shuffle:
 *
 *       0 1 2   3 4 5
 *   0   A A A | D E E
 *   1   A A A | D E E
 *   2   B B B | D E E
 *   3   B B B | F F F
 *   4   C C C | G G G
 *   5   C C C | G G G
 *
 * A vertical cut at column 3 and a horizontal one at row 4 both run edge to
 * edge, so it is a good fixture for every metric at once.
 */
const FIXTURE_SIZE = 6;
const FIXTURE = [
    { row: 0, col: 0, width: 3, height: 2 }, // A, index 0
    { row: 2, col: 0, width: 3, height: 2 }, // B, index 1
    { row: 4, col: 0, width: 3, height: 2 }, // C, index 2
    { row: 0, col: 3, width: 1, height: 3 }, // D, index 3
    { row: 0, col: 4, width: 2, height: 3 }, // E, index 4
    { row: 3, col: 3, width: 3, height: 1 }, // F, index 5
    { row: 4, col: 3, width: 3, height: 2 }, // G, index 6
];

console.log('\nfixture: detector');
check('fixture is a valid tiling', validateTiling(FIXTURE, FIXTURE_SIZE) === null, String(validateTiling(FIXTURE, FIXTURE_SIZE)));
checkEqual('board-spanning fault lines', faultLines(FIXTURE, FIXTURE_SIZE), { vertical: [3], horizontal: [4] });
checkEqual('seam profile', seamProfile(FIXTURE, FIXTURE_SIZE), {
    spanningFaults: 2,
    longestSeam: 6,
    longestSeamCount: 2,
    totalSeams: 5,
});
check('fixture is fully guillotine', isGuillotine(FIXTURE, FIXTURE_SIZE) === true);

console.log('fixture: closure');
// Seeding from B and D grows the box right to swallow F, exactly as worked out
// by hand: the block becomes the top four rows and holds A, B, D, E and F.
const closure = closureAround(FIXTURE, [1, 3]);
checkEqual('closure block', closure.block, { row: 0, col: 0, width: 6, height: 4 });
checkEqual('closure members', closure.members, [0, 1, 3, 4, 5]);
check(
    'closure is exactly filled',
    closure.members.reduce((sum, i) => sum + FIXTURE[i].width * FIXTURE[i].height, 0)
        === closure.block.width * closure.block.height
);

console.log('fixture: re-roll');
const reRolled = reRollBlock(FIXTURE, closure.block, closure.members, 10, mulberry32(7), partitionRecursion);
check('re-roll keeps a valid tiling', validateTiling(reRolled, FIXTURE_SIZE) === null, String(validateTiling(reRolled, FIXTURE_SIZE)));
check(
    're-roll leaves outside pieces untouched',
    [2, 6].every((i) => reRolled.some((r) => JSON.stringify(r) === JSON.stringify(FIXTURE[i])))
);

/**
 * @param {number} size
 * @param {number} maxArea
 * @param {() => number} rand
 * @returns {import('../js/game.js').Rectangle[]}
 */
function partition(size, maxArea, rand) {
    return partitionRecursion({ width: size, height: size, maxArea }, rand, { row: 0, col: 0 });
}

console.log('property: closure over generated boards');
{
    let closuresChecked = 0;
    let allExactlyFilled = true;
    let allContainSeeds = true;
    let firstProblem = '';

    for (const difficulty of Object.values(Difficulty)) {
        const size = difficulty.size;
        for (let day = 0; day < 60; day++) {
            const rand = createSeededRng(`2026-03-${String((day % 28) + 1).padStart(2, '0')}`, `${difficulty.name}-${day}`);
            const rectangles = partition(size, difficulty.maxRectangleSize, rand);

            for (let i = 0; i < rectangles.length; i++) {
                for (let j = i + 1; j < rectangles.length; j++) {
                    if (!rectanglesTouch(rectangles[i], rectangles[j])) {
                        continue;
                    }
                    const { block, members } = closureAround(rectangles, [i, j]);
                    closuresChecked++;

                    const filled = members.reduce((sum, k) => sum + rectangles[k].width * rectangles[k].height, 0);
                    if (filled !== block.width * block.height) {
                        allExactlyFilled = false;
                        firstProblem = firstProblem || `${difficulty.name} day ${day}: block ${JSON.stringify(block)} filled ${filled}`;
                    }
                    if (!members.includes(i) || !members.includes(j)) {
                        allContainSeeds = false;
                    }
                }
            }
        }
    }

    check('every closure is exactly filled by whole pieces', allExactlyFilled, firstProblem);
    check('every closure contains its seeds', allContainSeeds);
    check('closures actually exercised', closuresChecked > 5000, `only ${closuresChecked} closures`);
    console.log(`  (${closuresChecked} closures checked)`);
}

console.log('property: shuffle over generated boards');
{
    let allValid = true;
    let allNotWorse = true;
    let improved = 0;
    let boards = 0;
    let firstProblem = '';

    for (const difficulty of Object.values(Difficulty)) {
        const size = difficulty.size;
        for (let day = 0; day < 40; day++) {
            const rand = createSeededRng(`2026-04-${String((day % 28) + 1).padStart(2, '0')}`, difficulty.name);
            const before = partition(size, difficulty.maxRectangleSize, rand);
            const after = shufflePartition(before, {
                size,
                maxArea: difficulty.maxRectangleSize,
                rand,
                repartition: partitionRecursion,
            });
            boards++;

            const problem = validateTiling(after, size);
            if (problem) {
                allValid = false;
                firstProblem = firstProblem || `${difficulty.name} day ${day}: ${problem}`;
            }

            const costBefore = seamCost(before, size);
            const costAfter = seamCost(after, size);
            for (let i = 0; i < costBefore.length; i++) {
                if (costAfter[i] !== costBefore[i]) {
                    if (costAfter[i] > costBefore[i]) {
                        allNotWorse = false;
                        firstProblem = firstProblem || `${difficulty.name} day ${day}: cost ${JSON.stringify(costBefore)} -> ${JSON.stringify(costAfter)}`;
                    }
                    break;
                }
            }

            if (!isGuillotine(after, size)) {
                improved++;
            }
        }
    }

    check('shuffled boards are still valid tilings', allValid, firstProblem);
    check('shuffle never returns a worse board than it was given', allNotWorse, firstProblem);
    console.log(`  (${improved}/${boards} boards came out non-guillotine)`);
}

console.log('property: determinism');
{
    let identical = true;
    for (const difficulty of Object.values(Difficulty)) {
        const runs = [0, 1].map(() => {
            const rand = createSeededRng('2026-05-05', difficulty.name);
            const rectangles = partition(difficulty.size, difficulty.maxRectangleSize, rand);
            return shufflePartition(rectangles, {
                size: difficulty.size,
                maxArea: difficulty.maxRectangleSize,
                rand,
                repartition: partitionRecursion,
            });
        });
        if (JSON.stringify(runs[0]) !== JSON.stringify(runs[1])) {
            identical = false;
        }
    }
    check('same seed shuffles to the same board', identical);
}

console.log('end to end: generateBoard');
{
    let allValid = true;
    let allUnique = true;
    let allInteresting = true;
    let cluesMatchPieces = true;
    let deterministic = true;
    let boards = 0;
    let firstProblem = '';

    for (const difficulty of Object.values(Difficulty)) {
        const size = difficulty.size;
        for (let day = 0; day < 25; day++) {
            const dateKey = `2026-06-${String(day + 1).padStart(2, '0')}`;
            const board = generateBoard(difficulty, dateKey);
            boards++;

            const problem = validateTiling(board.rectangles, size);
            if (problem) {
                allValid = false;
                firstProblem = firstProblem || `${difficulty.name} ${dateKey}: ${problem}`;
            }
            if (!hasUniqueSolution(board.clues, { width: size, height: size })) {
                allUnique = false;
                firstProblem = firstProblem || `${difficulty.name} ${dateKey}: not uniquely solvable`;
            }
            if (isBoring(board.rectangles, size)) {
                allInteresting = false;
                firstProblem = firstProblem || `${difficulty.name} ${dateKey}: shipped a board isBoring rejects`;
            }

            // Exactly one clue per piece, carrying that piece's area.
            const matched = board.rectangles.every((r) => {
                const inside = board.clues.filter((c) => c.row >= r.row && c.row < r.row + r.height
                    && c.col >= r.col && c.col < r.col + r.width);
                return inside.length === 1 && inside[0].value === r.width * r.height;
            });
            if (!matched || board.clues.length !== board.rectangles.length) {
                cluesMatchPieces = false;
                firstProblem = firstProblem || `${difficulty.name} ${dateKey}: clues do not line up with pieces`;
            }

            if (JSON.stringify(generateBoard(difficulty, dateKey).clues) !== JSON.stringify(board.clues)) {
                deterministic = false;
                firstProblem = firstProblem || `${difficulty.name} ${dateKey}: not reproducible`;
            }
        }
    }

    check('every shipped board is a valid tiling', allValid, firstProblem);
    check('every shipped board is uniquely solvable', allUnique, firstProblem);
    check('every shipped board passes isBoring', allInteresting, firstProblem);
    check('clues line up one-to-one with pieces', cluesMatchPieces, firstProblem);
    check('same date and difficulty regenerate the same puzzle', deterministic, firstProblem);
    console.log(`  (${boards} boards generated end to end)`);
}

console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'}  ${passed} passed, ${failed} failed\n`);
process.exitCode = failed === 0 ? 0 : 1;
