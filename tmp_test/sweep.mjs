/**
 * Sweep shuffle settings against the metrics, in one process so it is quick.
 *
 *   $env:ELECTRON_RUN_AS_NODE=1
 *   & "$env:LOCALAPPDATA\Programs\cursor\Cursor.exe" tmp_test/sweep.mjs [boards]
 */

import { writeFileSync } from 'node:fs';

import { Difficulty } from '../js/difficulties.js';
import { createSeededRng } from '../js/rngCreator.js';
import { partitionRecursion, cluePlacement } from '../js/puzzleGenerator.js';
import { hasUniqueSolution } from '../js/puzzleValidator.js';
import { isBoring } from '../js/boredomCheck.js';
import { analyseSlicing, seamProfile, validateTiling } from '../js/faultLines.js';
import { shufflePartition } from '../js/partitionShuffle.js';

const BOARDS = Number(process.argv[2]) || 100;
const ONLY = process.argv[3] ?? '';
const MAX_ATTEMPTS = 3000;

/** Electron-as-Node writes to the console rather than a redirectable stdout. */
const report = [];

/**
 * @param {string} [line]
 */
function say(line = '') {
    report.push(line);
    console.log(line);
}

/**
 * @param {number} offsetDays
 * @returns {string}
 */
function dateKey(offsetDays) {
    const date = new Date(2026, 0, 1 + offsetDays);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * @param {typeof Difficulty[keyof typeof Difficulty]} difficulty
 * @param {string} key
 * @param {{budget?: number, countSlack?: number} | null} shuffleOptions
 */
function generate(difficulty, key, shuffleOptions) {
    const rand = createSeededRng(key, difficulty.name);
    const size = { width: difficulty.size, height: difficulty.size };
    let attempts = 0;

    while (attempts < MAX_ATTEMPTS) {
        attempts++;
        let rectangles = partitionRecursion(
            { width: difficulty.size, height: difficulty.size, maxArea: difficulty.maxRectangleSize },
            rand,
            { row: 0, col: 0 }
        );
        if (shuffleOptions) {
            rectangles = shufflePartition(rectangles, {
                size: difficulty.size,
                maxArea: difficulty.maxRectangleSize,
                rand,
                repartition: partitionRecursion,
                ...shuffleOptions,
            });
        }
        const clues = cluePlacement(rectangles, rand);
        if (isBoring(rectangles, difficulty.size)) {
            continue;
        }
        if (!hasUniqueSolution(clues, size)) {
            continue;
        }
        return { rectangles, attempts };
    }

    return { rectangles: null, attempts };
}

// A no-shuffle row is deliberately absent: isBoring now rejects fully
// guillotine boards, so a plain partition can never satisfy it and the config
// would just grind to MAX_ATTEMPTS on every board. tmp_test/baseline.txt holds
// the pre-shuffle numbers instead.
const configs = [
    { label: '8 moves/piece', options: { movesPerPiece: 8, countSlack: 1 } },
    { label: '16 moves/piece', options: { movesPerPiece: 16, countSlack: 1 } },
    { label: '24 moves/piece', options: { movesPerPiece: 24, countSlack: 1 } },
    { label: '32 moves/piece', options: { movesPerPiece: 32, countSlack: 1 } },
    { label: '48 moves/piece', options: { movesPerPiece: 48, countSlack: 1 } },
    { label: '64 moves/piece', options: { movesPerPiece: 64, countSlack: 1 } },
    { label: '32/piece, slack 2', options: { movesPerPiece: 32, countSlack: 2 } },
    { label: '32/piece, slack off', options: { movesPerPiece: 32, countSlack: Infinity } },
];

for (const difficulty of Object.values(Difficulty)) {
    if (ONLY && difficulty.name !== ONLY) {
        continue;
    }
    const size = difficulty.size;
    const boardArea = size * size;
    say(`\n=== ${difficulty.name} (${size}x${size}) ===`);
    say('  config                 guillotine  interlocked  longestSeam  pieces  attempts  ms/board  invalid');

    for (const config of configs) {
        const options = { ...config.options };

        let guillotine = 0;
        let interlocked = 0;
        let longestSeam = 0;
        let pieces = 0;
        let attempts = 0;
        let invalid = 0;
        let measured = 0;
        const startedAt = Date.now();

        for (let i = 0; i < BOARDS; i++) {
            const board = generate(difficulty, dateKey(i), options);
            attempts += board.attempts;
            if (!board.rectangles) {
                continue;
            }
            if (validateTiling(board.rectangles, size) !== null) {
                invalid++;
                continue;
            }
            measured++;
            const slicing = analyseSlicing(board.rectangles, size);
            if (slicing.guillotine) {
                guillotine++;
            }
            interlocked += slicing.largestStuckArea / boardArea;
            longestSeam += seamProfile(board.rectangles, size).longestSeam / size;
            pieces += board.rectangles.length;
        }

        const elapsed = Date.now() - startedAt;
        const row = [
            config.label.padEnd(22),
            `${((guillotine / measured) * 100).toFixed(0)}%`.padStart(10),
            `${((interlocked / measured) * 100).toFixed(0)}%`.padStart(12),
            `${((longestSeam / measured) * 100).toFixed(0)}%`.padStart(12),
            (pieces / measured).toFixed(1).padStart(7),
            (attempts / BOARDS).toFixed(1).padStart(9),
            (elapsed / BOARDS).toFixed(1).padStart(9),
            String(invalid).padStart(8),
        ].join(' ');
        say(`  ${row}`);
    }
}

writeFileSync('tmp_test/sweep.txt', `${report.join('\n')}\n`, 'utf8');
