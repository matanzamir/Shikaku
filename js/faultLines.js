/**
 * @typedef {import('./game.js').Rectangle} Rectangle
 * @typedef {{ row: number, col: number, width: number, height: number }} Block
 */

/**
 * A fault line is an internal grid line of a block that no rectangle crosses,
 * so the block falls into two independent halves along it. A guillotine
 * partition has one at every level by construction, which is what lets a player
 * read its cuts straight off the board.
 */

/**
 * @param {number} size
 * @returns {Block}
 */
export function wholeBoard(size) {
    return { row: 0, col: 0, width: size, height: size };
}

/**
 * Uncrossed internal grid lines of a block, as absolute board offsets.
 * @param {Rectangle[]} rectangles the rectangles exactly tiling the block
 * @param {Block} block
 * @returns {{vertical: number[], horizontal: number[]}}
 */
export function faultLinesIn(rectangles, block) {
    const vertical = [];
    const horizontal = [];

    for (let k = block.col + 1; k < block.col + block.width; k++) {
        if (!rectangles.some((r) => r.col < k && k < r.col + r.width)) {
            vertical.push(k);
        }
    }
    for (let k = block.row + 1; k < block.row + block.height; k++) {
        if (!rectangles.some((r) => r.row < k && k < r.row + r.height)) {
            horizontal.push(k);
        }
    }

    return { vertical, horizontal };
}

/**
 * Board-spanning fault lines: the cuts that run edge to edge.
 * @param {Rectangle[]} rectangles
 * @param {number} size
 * @returns {{vertical: number[], horizontal: number[]}}
 */
export function faultLines(rectangles, size) {
    return faultLinesIn(rectangles, wholeBoard(size));
}

/**
 * How central a line is within a block: 1 when it halves the block exactly,
 * near 0 when it hugs an edge. Central lines read as "the big cut".
 * @param {number} k absolute offset
 * @param {number} start block start on that axis
 * @param {number} length block length on that axis
 * @returns {number}
 */
export function centrality(k, start, length) {
    return 1 - Math.abs(k - (start + length / 2)) / (length / 2);
}

/**
 * Recursively slice a block at its most central fault line.
 *
 * Slicing at the most central line rather than the first one mirrors how a
 * player reads the board; the guillotine verdict itself does not depend on the
 * choice, since a block either has a fault line or it does not. Blocks where
 * slicing runs out of fault lines are the genuinely interlocked parts.
 *
 * @param {Rectangle[]} rectangles the rectangles exactly tiling the block
 * @param {Block} block
 * @param {number} [depth]
 * @returns {{guillotine: boolean, depth: number, stuck: {block: Block, pieces: number}[]}}
 */
export function sliceBlock(rectangles, block, depth = 0) {
    if (rectangles.length <= 1) {
        return { guillotine: true, depth, stuck: [] };
    }

    const { vertical, horizontal } = faultLinesIn(rectangles, block);
    const candidates = [
        ...vertical.map((k) => ({ k, vertical: true, score: centrality(k, block.col, block.width) })),
        ...horizontal.map((k) => ({ k, vertical: false, score: centrality(k, block.row, block.height) })),
    ];

    if (candidates.length === 0) {
        return { guillotine: false, depth, stuck: [{ block, pieces: rectangles.length }] };
    }

    candidates.sort((a, b) => b.score - a.score);
    const cut = candidates[0];

    const lowRects = cut.vertical
        ? rectangles.filter((r) => r.col + r.width <= cut.k)
        : rectangles.filter((r) => r.row + r.height <= cut.k);
    const highRects = cut.vertical
        ? rectangles.filter((r) => r.col >= cut.k)
        : rectangles.filter((r) => r.row >= cut.k);
    const lowBlock = cut.vertical
        ? { ...block, width: cut.k - block.col }
        : { ...block, height: cut.k - block.row };
    const highBlock = cut.vertical
        ? { ...block, col: cut.k, width: block.col + block.width - cut.k }
        : { ...block, row: cut.k, height: block.row + block.height - cut.k };

    const low = sliceBlock(lowRects, lowBlock, depth + 1);
    const high = sliceBlock(highRects, highBlock, depth + 1);

    return {
        guillotine: low.guillotine && high.guillotine,
        depth: Math.max(low.depth, high.depth),
        stuck: [...low.stuck, ...high.stuck],
    };
}

/**
 * @param {Rectangle[]} rectangles
 * @param {number} size
 * @returns {{guillotine: boolean, depth: number, stuck: {block: Block, pieces: number}[], largestStuckArea: number, stuckArea: number}}
 */
export function analyseSlicing(rectangles, size) {
    const result = sliceBlock(rectangles, wholeBoard(size));
    const areas = result.stuck.map((s) => s.block.width * s.block.height);
    return {
        ...result,
        largestStuckArea: areas.length ? Math.max(...areas) : 0,
        stuckArea: areas.reduce((sum, area) => sum + area, 0),
    };
}

/**
 * True when the board comes apart into single rectangles by straight cuts alone,
 * i.e. every cut the generator made is still readable off the finished board.
 * @param {Rectangle[]} rectangles
 * @param {number} size
 * @returns {boolean}
 */
export function isGuillotine(rectangles, size) {
    return sliceBlock(rectangles, wholeBoard(size)).guillotine;
}

/**
 * Which rectangle owns each cell, indexed row * size + col.
 * @param {Rectangle[]} rectangles
 * @param {number} size
 * @returns {Int32Array}
 */
export function ownerGrid(rectangles, size) {
    const owner = new Int32Array(size * size).fill(-1);

    for (let i = 0; i < rectangles.length; i++) {
        const r = rectangles[i];
        for (let row = r.row; row < r.row + r.height; row++) {
            for (let col = r.col; col < r.col + r.width; col++) {
                owner[row * size + col] = i;
            }
        }
    }

    return owner;
}

/**
 * Straight, unbroken runs of piece border, measured in cells.
 *
 * A seam is what the eye actually follows: a long uninterrupted edge reads as a
 * cut whether or not it reaches the board rim. A seam as long as the board is
 * exactly a board-spanning fault line, so this one pass covers both the strict
 * guillotine signal and the softer "I can see where it was sliced" one.
 *
 * @param {Rectangle[]} rectangles
 * @param {number} size
 * @returns {{spanningFaults: number, longestSeam: number, longestSeamCount: number, totalSeams: number}}
 */
export function seamProfile(rectangles, size) {
    const owner = ownerGrid(rectangles, size);
    let spanningFaults = 0;
    let longestSeam = 0;
    let longestSeamCount = 0;
    let totalSeams = 0;

    /**
     * @param {number} length
     */
    const recordRun = (length) => {
        if (length === 0) {
            return;
        }
        totalSeams++;
        if (length > longestSeam) {
            longestSeam = length;
            longestSeamCount = 1;
        } else if (length === longestSeam) {
            longestSeamCount++;
        }
    };

    for (let k = 1; k < size; k++) {
        // Vertical line at column k: bordered wherever the cells either side differ.
        let run = 0;
        for (let row = 0; row < size; row++) {
            if (owner[row * size + k - 1] !== owner[row * size + k]) {
                run++;
            } else {
                recordRun(run);
                run = 0;
            }
        }
        if (run === size) {
            spanningFaults++;
        }
        recordRun(run);

        // Horizontal line at row k.
        run = 0;
        for (let col = 0; col < size; col++) {
            if (owner[(k - 1) * size + col] !== owner[k * size + col]) {
                run++;
            } else {
                recordRun(run);
                run = 0;
            }
        }
        if (run === size) {
            spanningFaults++;
        }
        recordRun(run);
    }

    return { spanningFaults, longestSeam, longestSeamCount, totalSeams };
}

/**
 * @param {Rectangle} a
 * @param {Rectangle} b
 * @returns {boolean} true when a and b share a border edge (not just a corner)
 */
export function rectanglesTouch(a, b) {
    const colsOverlap = a.col < b.col + b.width && b.col < a.col + a.width;
    const rowsOverlap = a.row < b.row + b.height && b.row < a.row + a.height;
    return (colsOverlap && (a.row + a.height === b.row || b.row + b.height === a.row))
        || (rowsOverlap && (a.col + a.width === b.col || b.col + b.width === a.col));
}

/**
 * Check that a rectangle list really is a partition of the board, so a bug
 * cannot quietly masquerade as an interesting layout.
 * @param {Rectangle[]} rectangles
 * @param {number} size
 * @returns {string | null} description of the first problem found, or null
 */
export function validateTiling(rectangles, size) {
    const cover = new Int32Array(size * size);

    for (const r of rectangles) {
        if (r.row < 0 || r.col < 0 || r.row + r.height > size || r.col + r.width > size) {
            return `rectangle out of bounds: ${JSON.stringify(r)}`;
        }
        for (let row = r.row; row < r.row + r.height; row++) {
            for (let col = r.col; col < r.col + r.width; col++) {
                cover[row * size + col]++;
            }
        }
    }

    for (let i = 0; i < cover.length; i++) {
        if (cover[i] !== 1) {
            return `cell (${Math.floor(i / size)},${i % size}) covered ${cover[i]} times`;
        }
    }

    return null;
}
