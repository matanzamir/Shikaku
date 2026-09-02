/**
 * ASCII rendering of a rectangular partition, so board structure can be eyeballed
 * next to the statistics.
 *
 * @typedef {{row: number, col: number, width: number, height: number}} Rectangle
 */

import { faultLines } from './faultLines.mjs';

/**
 * Draw the partition as a grid of bordered cells. Each piece shows its area in
 * its top-left cell. Board-spanning fault lines are drawn with doubled strokes
 * so the cuts a player can read stand out from ordinary piece borders.
 *
 * @param {Rectangle[]} rectangles
 * @param {number} size
 * @returns {string}
 */
export function renderBoard(rectangles, size) {
    /** @type {number[]} cell -> piece index */
    const owner = new Array(size * size).fill(-1);
    for (let i = 0; i < rectangles.length; i++) {
        const r = rectangles[i];
        for (let row = r.row; row < r.row + r.height; row++) {
            for (let col = r.col; col < r.col + r.width; col++) {
                owner[row * size + col] = i;
            }
        }
    }

    const { vertical, horizontal } = faultLines(rectangles, size);
    const isVerticalFault = new Set(vertical);
    const isHorizontalFault = new Set(horizontal);

    const pieceAt = (row, col) => owner[row * size + col];
    const sameAbove = (row, col) => row > 0 && pieceAt(row, col) === pieceAt(row - 1, col);
    const sameLeft = (row, col) => col > 0 && pieceAt(row, col) === pieceAt(row, col - 1);

    const lines = [];

    for (let row = 0; row <= size; row++) {
        // Border line above cell row `row`.
        let border = '';
        for (let col = 0; col < size; col++) {
            const drawn = row === size || row === 0 || !sameAbove(row, col);
            const doubled = isHorizontalFault.has(row);
            border += '+';
            border += drawn ? (doubled ? '===' : '---') : '   ';
        }
        border += '+';
        lines.push(border);

        if (row === size) {
            break;
        }

        // Cell contents for row `row`.
        let content = '';
        for (let col = 0; col < size; col++) {
            const drawn = col === 0 || !sameLeft(row, col);
            const doubled = isVerticalFault.has(col);
            content += drawn ? (doubled ? '"' : '|') : ' ';

            const piece = rectangles[pieceAt(row, col)];
            const isAnchor = piece.row === row && piece.col === col;
            content += isAnchor ? String(piece.width * piece.height).padStart(2).padEnd(3) : '   ';
        }
        content += '|';
        lines.push(content);
    }

    return lines.join('\n');
}
