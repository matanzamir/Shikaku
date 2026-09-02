import { rectanglesTouch, seamProfile } from './faultLines.js';

/**
 * @typedef {import('./game.js').Rectangle} Rectangle
 * @typedef {{ row: number, col: number, width: number, height: number }} Block
 * @typedef {(size: {width: number, height: number, maxArea: number}, rand: () => number, position: {row: number, col: number}) => Rectangle[]} Repartition
 */

/**
 * Break up the readable cuts left behind by a guillotine partition.
 *
 * A slicing partition always leaves at least one line running edge to edge
 * uncrossed, and its second-level cuts leave long straight seams inside each
 * half, which is what lets a player see the board as a few big rectangles
 * chopped down rather than as one interlocking whole.
 *
 * The fix is local: find a group of neighbouring pieces that together happen to
 * form a perfect rectangle, throw them away, and re-cut that little rectangle
 * from scratch. Each re-cut block is itself sliced, but blocks straddle the old
 * cut lines, so the new edges inside one block do not line up with the pieces
 * left outside it and the long seams stop running through.
 *
 * Piece sizes are not re-invented here: every block is handed back to the
 * caller's own partition function, so whatever area distribution it was tuned
 * for survives the shuffle.
 */

/**
 * Moves attempted per piece on the board.
 *
 * Scaling by piece count rather than board area is what makes one constant work
 * for every difficulty: a 7x7 board needs far more moves per cell than a 15x15
 * one, because it has fewer pieces and so fewer legal moves to choose from.
 */
const MOVES_PER_PIECE = 32;

/**
 * How far the piece count may drift from the partition handed in.
 *
 * Left unchecked the shuffle coarsens the board: a re-rolled block small enough
 * to pass keepWholeChance can come back as one big piece, and repeated over
 * hundreds of moves that walks the whole board towards fewer, larger pieces.
 * Anchoring the count to the original keeps the tuned area distribution.
 */
const DEFAULT_COUNT_SLACK = 1;

/**
 * The partition function is injected rather than imported to keep this module
 * free of a cycle with puzzleGenerator.js, which is what consumes it.
 *
 * @param {Rectangle[]} rectangles a partition of the whole board
 * @param {{size: number, maxArea: number, rand: () => number, repartition: Repartition, budget?: number, movesPerPiece?: number, countSlack?: number}} options
 * @returns {Rectangle[]} a different partition of the same board
 */
export function shufflePartition(rectangles, options) {
    const { size, maxArea, rand, repartition } = options;
    const budget = options.budget ?? rectangles.length * (options.movesPerPiece ?? MOVES_PER_PIECE);
    const countSlack = options.countSlack ?? DEFAULT_COUNT_SLACK;
    const targetCount = rectangles.length;

    let current = rectangles;
    let currentCost = seamCost(current, size);

    for (let move = 0; move < budget; move++) {
        const seeds = pickSeedPair(current, rand);
        if (seeds === null) {
            continue;
        }

        const { block, members } = closureAround(current, seeds);
        // The whole board is trivially closed, and re-cutting it would just be
        // another guillotine partition from scratch.
        if (members.length < 2 || (block.width === size && block.height === size)) {
            continue;
        }

        const candidate = reRollBlock(current, block, members, maxArea, rand, repartition);
        if (Math.abs(candidate.length - targetCount) > countSlack) {
            continue;
        }

        const candidateCost = seamCost(candidate, size);

        // Equal-cost moves are kept on purpose. They scatter the edges so they
        // no longer line up across the old cut lines, which is what makes the
        // improving moves available in the first place.
        if (!isWorse(candidateCost, currentCost)) {
            current = candidate;
            currentCost = candidateCost;
        }
    }

    return current;
}

/**
 * What the shuffle is trying to minimise, compared in order: cuts that run edge
 * to edge first, then the longest straight seam anywhere on the board, then how
 * many seams are that long.
 *
 * All three come from one pass and none of them reward using fewer pieces, so
 * the search cannot cheat by merging the board into a handful of big slabs.
 *
 * @param {Rectangle[]} rectangles
 * @param {number} size
 * @returns {number[]}
 */
export function seamCost(rectangles, size) {
    const { spanningFaults, longestSeam, longestSeamCount } = seamProfile(rectangles, size);
    return [spanningFaults, longestSeam, longestSeamCount];
}

/**
 * @param {number[]} candidate
 * @param {number[]} current
 * @returns {boolean}
 */
function isWorse(candidate, current) {
    for (let i = 0; i < candidate.length; i++) {
        if (candidate[i] !== current[i]) {
            return candidate[i] > current[i];
        }
    }
    return false;
}

/**
 * A random piece plus one of its neighbours. Neighbours rather than any two
 * pieces because a distant pair drags the closure out to most of the board.
 * @param {Rectangle[]} rectangles
 * @param {() => number} rand
 * @returns {[number, number] | null}
 */
function pickSeedPair(rectangles, rand) {
    if (rectangles.length < 2) {
        return null;
    }

    const first = Math.floor(rand() * rectangles.length);
    const neighbours = [];
    for (let i = 0; i < rectangles.length; i++) {
        if (i !== first && rectanglesTouch(rectangles[first], rectangles[i])) {
            neighbours.push(i);
        }
    }

    if (neighbours.length === 0) {
        return null;
    }

    return [first, neighbours[Math.floor(rand() * neighbours.length)]];
}

/**
 * Grow the seeds' bounding box until it is exactly filled by whole rectangles.
 *
 * A box drawn at random usually cuts through the middle of some pieces, and a
 * piece cannot be half re-cut. So the box swallows anything it clips, which may
 * clip something new, and repeats. This always terminates, because in the worst
 * case the box grows to the whole board.
 *
 * @param {Rectangle[]} rectangles
 * @param {number[]} seeds indices to start from
 * @returns {{block: Block, members: number[]}}
 */
export function closureAround(rectangles, seeds) {
    let top = Infinity;
    let left = Infinity;
    let bottom = -Infinity;
    let right = -Infinity;

    for (const index of seeds) {
        const r = rectangles[index];
        top = Math.min(top, r.row);
        left = Math.min(left, r.col);
        bottom = Math.max(bottom, r.row + r.height);
        right = Math.max(right, r.col + r.width);
    }

    let grew = true;
    while (grew) {
        grew = false;
        for (const r of rectangles) {
            const overlaps = r.row < bottom && top < r.row + r.height
                && r.col < right && left < r.col + r.width;
            if (!overlaps) {
                continue;
            }
            if (r.row < top) {
                top = r.row;
                grew = true;
            }
            if (r.col < left) {
                left = r.col;
                grew = true;
            }
            if (r.row + r.height > bottom) {
                bottom = r.row + r.height;
                grew = true;
            }
            if (r.col + r.width > right) {
                right = r.col + r.width;
                grew = true;
            }
        }
    }

    const members = [];
    for (let i = 0; i < rectangles.length; i++) {
        const r = rectangles[i];
        if (r.row >= top && r.col >= left && r.row + r.height <= bottom && r.col + r.width <= right) {
            members.push(i);
        }
    }

    return {
        block: { row: top, col: left, width: right - left, height: bottom - top },
        members,
    };
}

/**
 * Replace a block's pieces with a fresh partition of that block.
 * @param {Rectangle[]} rectangles
 * @param {Block} block
 * @param {number[]} members indices of the rectangles filling the block
 * @param {number} maxArea
 * @param {() => number} rand
 * @param {Repartition} repartition
 * @returns {Rectangle[]}
 */
export function reRollBlock(rectangles, block, members, maxArea, rand, repartition) {
    const replaced = new Set(members);
    const kept = rectangles.filter((_, i) => !replaced.has(i));
    const fresh = repartition(
        { width: block.width, height: block.height, maxArea },
        rand,
        { row: block.row, col: block.col }
    );
    return [...kept, ...fresh];
}
