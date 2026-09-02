/**
 * Measure the structure of the boards the generator actually ships, by calling
 * generateBoard() directly so there is no second copy of the accept/reject loop
 * to drift out of step.
 *
 * Run with Cursor's bundled Electron acting as Node:
 *   $env:ELECTRON_RUN_AS_NODE=1
 *   & "$env:LOCALAPPDATA\Programs\cursor\Cursor.exe" tmp_test/measure.mjs --boards=300
 *
 * Flags: --boards=N  --samples=N  --out=path
 */

import { writeFileSync } from 'node:fs';

import { Difficulty } from '../js/difficulties.js';
import { generateBoard } from '../js/puzzleGenerator.js';
import { faultLines, analyseSlicing, seamProfile, isVisible, looksQuartered, validateTiling } from './faultLines.mjs';
import { renderBoard } from './render.mjs';

/**
 * @param {string} name
 * @param {string | number | boolean} fallback
 */
function flag(name, fallback) {
    const match = process.argv.find((arg) => arg === `--${name}` || arg.startsWith(`--${name}=`));
    if (match === undefined) {
        return fallback;
    }
    return match.includes('=') ? match.slice(match.indexOf('=') + 1) : true;
}

const BOARDS_PER_DIFFICULTY = Number(flag('boards', 200));
const SAMPLES_TO_DRAW = Number(flag('samples', 2));
const REPORT_PATH = String(flag('out', 'tmp_test/report.txt'));
const START_DATE = '2026-01-01';

/**
 * Electron-as-Node writes to the attached console rather than a redirectable
 * stdout, so the report is buffered and written to a file directly.
 * @type {string[]}
 */
const report = [];

/**
 * @param {string} [line]
 */
function say(line = '') {
    report.push(line);
    console.log(line);
}

/**
 * @param {string} startKey YYYY-MM-DD
 * @param {number} offsetDays
 * @returns {string} YYYY-MM-DD
 */
function dateKeyPlus(startKey, offsetDays) {
    const [year, month, day] = startKey.split('-').map(Number);
    const date = new Date(year, month - 1, day + offsetDays);
    return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * @param {number[]} values
 */
function summarise(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
    return {
        mean: values.reduce((s, v) => s + v, 0) / values.length,
        median: at(0.5),
        min: sorted[0],
        max: sorted[sorted.length - 1],
        p90: at(0.9),
    };
}

/**
 * @param {number[]} values
 * @param {(k: number) => string} [label]
 * @returns {string}
 */
function histogram(values, label = String) {
    const counts = new Map();
    for (const v of values) {
        counts.set(v, (counts.get(v) || 0) + 1);
    }
    const keys = [...counts.keys()].sort((a, b) => a - b);
    const total = values.length;
    return keys
        .map((k) => {
            const share = counts.get(k) / total;
            const bar = '#'.repeat(Math.max(1, Math.round(share * 40)));
            return `      ${label(k).padStart(5)} | ${bar} ${(share * 100).toFixed(1)}% (${counts.get(k)})`;
        })
        .join('\n');
}

/**
 * @param {number} n
 * @returns {string}
 */
function pct(n) {
    return `${(n * 100).toFixed(1)}%`;
}

say(`Measuring generateBoard(): ${BOARDS_PER_DIFFICULTY} boards per difficulty, dates from ${START_DATE}.`);

for (const difficulty of Object.values(Difficulty)) {
    const size = difficulty.size;
    const boardArea = size * size;
    const startedAt = Date.now();

    const spanningFaults = [];
    const visibleSpanningFaults = [];
    const slicingDepths = [];
    const largestStuckShares = [];
    const stuckShares = [];
    const pieceCounts = [];
    const attemptCounts = [];
    const areas = [];
    const samples = [];
    const spanningPieceShares = [];
    const longestSeams = [];
    const totalSeams = [];
    let boardsWithSpanningPiece = 0;
    let guillotine = 0;
    let quartered = 0;
    let anySpanningFault = 0;
    let failures = 0;
    let tilingErrors = 0;

    for (let i = 0; i < BOARDS_PER_DIFFICULTY; i++) {
        const dateKey = dateKeyPlus(START_DATE, i);
        const board = generateBoard(difficulty, dateKey);

        if (!board || !board.rectangles) {
            failures++;
            continue;
        }

        const problem = validateTiling(board.rectangles, size);
        if (problem) {
            tilingErrors++;
            say(`  !! ${difficulty.name} ${dateKey}: ${problem}`);
            continue;
        }

        const { vertical, horizontal } = faultLines(board.rectangles, size);
        const spanning = [...vertical, ...horizontal];
        const slicing = analyseSlicing(board.rectangles, size);
        const seams = seamProfile(board.rectangles, size);

        longestSeams.push(seams.longestSeam / size);
        totalSeams.push(seams.totalSeams);
        spanningFaults.push(spanning.length);
        visibleSpanningFaults.push(spanning.filter((k) => isVisible(k, 0, size)).length);
        slicingDepths.push(slicing.depth);
        largestStuckShares.push(slicing.largestStuckArea / boardArea);
        stuckShares.push(slicing.stuckArea / boardArea);
        pieceCounts.push(board.rectangles.length);
        attemptCounts.push(board.attempts);
        for (const r of board.rectangles) {
            areas.push(r.width * r.height);
        }
        // Pieces that reach all the way across the board advertise a cut line on
        // their own, independently of the slicing structure.
        const spanningPieces = board.rectangles.filter((r) => r.width === size || r.height === size);
        spanningPieceShares.push(spanningPieces.reduce((s, r) => s + r.width * r.height, 0) / boardArea);
        if (spanningPieces.length > 0) {
            boardsWithSpanningPiece++;
        }

        if (slicing.guillotine) {
            guillotine++;
        }
        if (looksQuartered(board.rectangles, size)) {
            quartered++;
        }
        if (spanning.length > 0) {
            anySpanningFault++;
        }
        if (samples.length < SAMPLES_TO_DRAW) {
            samples.push({ dateKey, rectangles: board.rectangles, slicing });
        }
    }

    const measured = spanningFaults.length;
    const elapsed = Date.now() - startedAt;

    say(`\n${'='.repeat(70)}`);
    say(`${difficulty.name}  (${size}x${size}, maxArea ${difficulty.maxRectangleSize})`);
    say('='.repeat(70));
    say(`  boards measured: ${measured}/${BOARDS_PER_DIFFICULTY}` +
        `${failures ? `  (${failures} produced nothing)` : ''}` +
        `${tilingErrors ? `  (${tilingErrors} INVALID TILINGS)` : ''}`);
    say(`  generation: ${elapsed} ms total, ${(elapsed / Math.max(1, measured)).toFixed(1)} ms/board`);
    say(`  candidate boards tried: mean ${summarise(attemptCounts).mean.toFixed(2)}, ` +
        `median ${summarise(attemptCounts).median}, p90 ${summarise(attemptCounts).p90}, max ${summarise(attemptCounts).max}`);

    say('\n  SLICING STRUCTURE  (recursive: keep cutting at fault lines)');
    say(`    fully guillotine (board comes apart into single pieces): ${pct(guillotine / measured)}`);
    say(`    slicing depth: mean ${summarise(slicingDepths).mean.toFixed(2)}, max ${summarise(slicingDepths).max}`);
    say(`    largest interlocked block, as share of board: mean ${pct(summarise(largestStuckShares).mean)}, max ${pct(summarise(largestStuckShares).max)}`);
    say(`    total interlocked area: mean ${pct(summarise(stuckShares).mean)}`);

    say('\n  SEAMS  (longest unbroken run of piece border, as a share of board width)');
    say(`    longest seam: mean ${pct(summarise(longestSeams).mean)}, median ${pct(summarise(longestSeams).median)}, min ${pct(summarise(longestSeams).min)}`);
    say(`    boards whose longest seam reaches the full width: ${pct(longestSeams.filter((s) => s >= 1).length / measured)}`);
    say(`    seam count per board: mean ${summarise(totalSeams).mean.toFixed(1)}`);

    say('\n  BOARD-SPANNING FAULT LINES  (edge-to-edge, uncrossed)');
    say(`    boards with at least one: ${pct(anySpanningFault / measured)}`);
    say(`    count per board: mean ${summarise(spanningFaults).mean.toFixed(2)}, median ${summarise(spanningFaults).median}, max ${summarise(spanningFaults).max}`);
    say(`    of those, in the middle third: mean ${summarise(visibleSpanningFaults).mean.toFixed(2)}`);
    say(`    "four big rectangles" signature: ${pct(quartered / measured)}`);
    say(`    boards with a piece spanning the full board: ${pct(boardsWithSpanningPiece / measured)}, ` +
        `mean board area in such pieces: ${pct(summarise(spanningPieceShares).mean)}, ` +
        `max ${pct(summarise(spanningPieceShares).max)}`);
    say('\n    spanning fault lines per board:');
    say(histogram(spanningFaults));

    say(`\n  pieces per board: mean ${summarise(pieceCounts).mean.toFixed(1)}, min ${summarise(pieceCounts).min}, max ${summarise(pieceCounts).max}`);
    say('  piece areas:');
    say(histogram(areas));

    for (const sample of samples) {
        say(`\n  --- sample ${difficulty.name} ${sample.dateKey} ` +
            `(guillotine: ${sample.slicing.guillotine}, depth ${sample.slicing.depth}, ` +
            `largest interlocked block ${pct(sample.slicing.largestStuckArea / boardArea)}) ---`);
        say(`  doubled strokes (=== and ") mark board-spanning fault lines`);
        say(renderBoard(sample.rectangles, size).split('\n').map((l) => `  ${l}`).join('\n'));
    }
}

writeFileSync(REPORT_PATH, `${report.join('\n')}\n`, 'utf8');
console.log(`\nreport written to ${REPORT_PATH}`);
