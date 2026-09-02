import { isGuillotine, rectanglesTouch } from './faultLines.js';

/**
 * isGuillotine is the one rule about how the board was built rather than how it
 * looks: a board that comes apart by straight cuts alone lets the player read
 * the generator's own cuts straight off it, which is what made the pre-shuffle
 * puzzles feel like a few big rectangles chopped down. It only belongs here
 * because the shuffle can produce boards that pass it; a plain guillotine
 * partition fails it every single time.
 */
export function isBoring(rectangles, size) {
    const allRows = rectangles.every(r => r.height === 1 && r.width === size);
    const allCols = rectangles.every(r => r.width === 1 && r.height === size);
    return allRows || allCols || hasBoardSpanningPiece(rectangles, size) || mostlySameRatio(rectangles, size) || mostlySameDirection(rectangles, size) || dominoFlood(rectangles, size) || hasStripeWall(rectangles) || hasLopsidedHalf(rectangles, size) || isGuillotine(rectangles, size);
  }

/**
 * A single piece reaching from one edge of the board to the opposite one draws
 * a cut line by itself, whatever the rest of the layout is doing. This replaces
 * an earlier rule that only objected once such pieces covered 60% of the board,
 * which let a lone full-width bar through on a third of all Easy boards.
 * @param {Rectangle[]} rectangles
 * @param {number} size
 * @returns {boolean}
 */
function hasBoardSpanningPiece(rectangles, size) {
    return rectangles.some((r) => r.width === size || r.height === size);
}

function mostlySameRatio(rectangles, size) {
    const keys = rectangles.map((r) => `${r.width}x${r.height}`);
    const dominant = Math.max(...[...keys.reduce((m, k) => m.set(k, (m.get(k) || 0) + 1), new Map()).values()]);
    return dominant / rectangles.length > 0.85;
}

function mostlySameDirection (rectangles, size) {
    const cols = rectangles.filter(r => stripDirection(r) === -1);
    const rows = rectangles.filter(r => stripDirection(r) === 1);
    return cols.length / rectangles.length > 0.6 || rows.length / rectangles.length > 0.6;
}

function dominoFlood(rectangles, size) {
    const dominos = rectangles.filter(r => r.width * r.height === 2);
    return (dominos.length * 2) / (size * size) > 0.5;
}

/**
 * 1 for a horizontal strip, -1 for a vertical strip, 0 for a chunky piece.
 * A piece reads as a strip once it is twice as long as it is thick, so 2- and
 * 3-cell-wide bars count the same way 1-cell slivers do.
 * @param {Rectangle} r
 * @returns {number}
 */
function stripDirection(r) {
    if (r.width >= 2 * r.height) return 1;
    if (r.height >= 2 * r.width) return -1;
    return 0;
}

/**
 * Catches "walls" of same-direction strips: a chain of touching strips
 * all running the same way (e.g. a run of horizontal bars stacked
 * on top of each other, or a column of vertical slivers) that ends up
 * dominating the puzzle's piece count. Judged by piece count rather than
 * area, since a fence of thin strips can look just as monotonous as a big
 * one even though each strip covers little area on its own. A single long
 * strip, or a couple of small ones, is normal and stays under the bar.
 * @param {Rectangle[]} rectangles
 * @returns {boolean}
 */
function hasStripeWall(rectangles) {
    const n = rectangles.length;
    const directions = rectangles.map(stripDirection);
    const parent = Array.from({ length: n }, (_, i) => i);
    const find = (x) => {
        while (parent[x] !== x) {
            parent[x] = parent[parent[x]];
            x = parent[x];
        }
        return x;
    };

    for (let i = 0; i < n; i++) {
        if (directions[i] === 0) continue;
        for (let j = i + 1; j < n; j++) {
            if (directions[j] === directions[i] && rectanglesTouch(rectangles[i], rectangles[j])) {
                parent[find(i)] = find(j);
            }
        }
    }

    const clusterCount = new Map();
    for (let i = 0; i < n; i++) {
        if (directions[i] === 0) continue;
        const root = find(i);
        clusterCount.set(root, (clusterCount.get(root) || 0) + 1);
    }

    for (const count of clusterCount.values()) {
        if (count / n > 0.45) {
            return true;
        }
    }
    return false;
}

/**
 * Catches regional monotony that hasStripeWall misses because a chunky piece
 * breaks the touching-chain: split the board at the row midline and again at
 * the column midline, and check each resulting half for a lopsided mix of
 * horizontal vs. vertical strips (e.g. "the top is basically all vertical").
 * minCount scales with board size so bigger boards (more strips overall)
 * need a proportionally bigger lopsided group before it counts as boring.
 * @param {Rectangle[]} rectangles
 * @param {number} size
 * @returns {boolean}
 */
function hasLopsidedHalf(rectangles, size) {
    const minCount = Math.max(4, Math.round(size / 2));
    const midpoints = [
        (r) => r.row + r.height / 2,
        (r) => r.col + r.width / 2,
    ];

    for (const centerOf of midpoints) {
        const lowerHalf = { h: 0, v: 0 };
        const upperHalf = { h: 0, v: 0 };
        for (const r of rectangles) {
            const half = centerOf(r) < size / 2 ? lowerHalf : upperHalf;
            const direction = stripDirection(r);
            if (direction === 1) half.h++;
            else if (direction === -1) half.v++;
        }
        for (const half of [lowerHalf, upperHalf]) {
            const total = half.h + half.v;
            if (total >= minCount && Math.max(half.h, half.v) / total >= 0.85) {
                return true;
            }
        }
    }
    return false;
}