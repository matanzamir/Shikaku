/**
 * Measurement-only helpers on top of the real detector in js/faultLines.js.
 * Everything the game itself relies on lives there, so the harness always
 * measures shipped code rather than a copy that can drift.
 *
 * @typedef {import('../js/game.js').Rectangle} Rectangle
 */

import { faultLinesIn, wholeBoard } from '../js/faultLines.js';

export {
    faultLinesIn,
    faultLines,
    wholeBoard,
    centrality,
    sliceBlock,
    analyseSlicing,
    isGuillotine,
    seamProfile,
    validateTiling,
} from '../js/faultLines.js';

/**
 * A line is "visible" when it sits in the middle third of its block.
 * @param {number} k
 * @param {number} start
 * @param {number} length
 * @returns {boolean}
 */
export function isVisible(k, start, length) {
    return k >= start + length / 3 && k <= start + (length * 2) / 3;
}

/**
 * The "four big rectangles" signature: the board's first two slices both land
 * in the middle third, quartering the whole board into comparable blocks.
 * @param {Rectangle[]} rectangles
 * @param {number} size
 * @returns {boolean}
 */
export function looksQuartered(rectangles, size) {
    const board = wholeBoard(size);
    const { vertical, horizontal } = faultLinesIn(rectangles, board);
    const visibleVertical = vertical.filter((k) => isVisible(k, 0, size));
    const visibleHorizontal = horizontal.filter((k) => isVisible(k, 0, size));

    if (visibleVertical.length > 0 && visibleHorizontal.length > 0) {
        return true;
    }

    // One board-spanning cut, then a visible cut on the other axis in each half.
    for (const [lines, isVerticalCut] of [[visibleVertical, true], [visibleHorizontal, false]]) {
        for (const k of lines) {
            const halves = isVerticalCut
                ? [
                    { rects: rectangles.filter((r) => r.col + r.width <= k), block: { ...board, width: k } },
                    { rects: rectangles.filter((r) => r.col >= k), block: { ...board, col: k, width: size - k } },
                ]
                : [
                    { rects: rectangles.filter((r) => r.row + r.height <= k), block: { ...board, height: k } },
                    { rects: rectangles.filter((r) => r.row >= k), block: { ...board, row: k, height: size - k } },
                ];

            const bothHalvesSplit = halves.every(({ rects, block }) => {
                const inner = faultLinesIn(rects, block);
                return isVerticalCut
                    ? inner.horizontal.some((j) => isVisible(j, block.row, block.height))
                    : inner.vertical.some((j) => isVisible(j, block.col, block.width));
            });

            if (bothHalvesSplit) {
                return true;
            }
        }
    }

    return false;
}
