/**
 * @typedef {import('./game.js').Rectangle} Rectangle
 * @typedef {{ row: number, col: number, value: number }} Clue
 */

/**
 * @param {number} area
 * @returns {{width: number, height: number}[]} shapes
 */
export function generateAllShapes(area) {
    const shapes = [];
    for (let width = 1; width <= area; width++) {
        if (area % width === 0) {
            shapes.push({ width, height: area / width });
        }
    }
    return shapes;
}

/**
 * @param {Clue} clue
 * @param {{width: number, height: number}} size
 * @param {Clue[]} [allClues] when provided, drop placements that cover another clue
 * @returns {Rectangle[]}
 */
export function candidateRectangles(clue, size, allClues = null) {
    const rectangles = [];
    let shapes = generateAllShapes(clue.value);
    shapes = shapes.filter(
        (shape) => shape.width <= size.width && shape.height <= size.height
    );
    for (const shape of shapes) {
        for (let rowOff = 0; rowOff < shape.height; rowOff++) {
            for (let colOff = 0; colOff < shape.width; colOff++) {
                const row = clue.row - rowOff;
                const col = clue.col - colOff;
                if (row < 0 || col < 0) {
                    continue;
                }
                if (row + shape.height > size.height || col + shape.width > size.width) {
                    continue;
                }
                const rect = {
                    row,
                    col,
                    width: shape.width,
                    height: shape.height,
                };
                if (allClues && coversOtherClue(rect, clue, allClues)) {
                    continue;
                }
                rectangles.push(rect);
            }
        }
    }
    return rectangles;
}

/**
 * @param {Rectangle} rect
 * @param {Clue} clue
 * @param {Clue[]} clues
 * @returns {boolean}
 */
function coversOtherClue(rect, clue, clues) {
    for (const other of clues) {
        if (other.row === clue.row && other.col === clue.col) {
            continue;
        }
        if (
            other.row >= rect.row &&
            other.row < rect.row + rect.height &&
            other.col >= rect.col &&
            other.col < rect.col + rect.width
        ) {
            return true;
        }
    }
    return false;
}

/**
 * Work budget for a single count, measured in rectangle-placement tests. A few
 * clue sets in every thousand send the search exponential; without a ceiling
 * one of them can lock the page for minutes. Hitting the ceiling reports the
 * puzzle as non-unique so the generator simply moves on to the next candidate.
 * The count is deterministic, so every machine rejects the same clue sets.
 */
const MAX_SEARCH_STEPS = 300000;

/**
 * @param {Clue[]} clues
 * @param {{width: number, height: number}} size
 * @param {number} limit
 * @returns {number} solutions found, or limit when the search budget ran out
 */
export function countSolutions(clues, size, limit = 2) {
    if (clues.length === 0) {
        return size.width * size.height === 0 ? 1 : 0;
    }

    /** @type {Rectangle[][]} */
    const candidates = clues.map((clue) => candidateRectangles(clue, size, clues));
    if (candidates.some((list) => list.length === 0)) {
        return 0;
    }

    const cellCount = size.width * size.height;
    const occupied = new Uint8Array(cellCount);
    const assigned = new Uint8Array(clues.length);
    const cols = size.width;
    let steps = 0;
    let outOfBudget = false;

    /**
     * @param {Rectangle} rect
     * @returns {boolean}
     */
    function fits(rect) {
        steps++;
        for (let r = rect.row; r < rect.row + rect.height; r++) {
            const rowBase = r * cols;
            for (let c = rect.col; c < rect.col + rect.width; c++) {
                if (occupied[rowBase + c]) {
                    return false;
                }
            }
        }
        return true;
    }

    /**
     * @param {Rectangle} rect
     * @param {number} value 1 place, 0 undo
     */
    function mark(rect, value) {
        for (let r = rect.row; r < rect.row + rect.height; r++) {
            const rowBase = r * cols;
            for (let c = rect.col; c < rect.col + rect.width; c++) {
                occupied[rowBase + c] = value;
            }
        }
    }

    /**
     * @returns {number} clue index with fewest remaining placements, or -1 if dead
     */
    function pickMrv() {
        let best = -1;
        let bestCount = Infinity;
        for (let i = 0; i < clues.length; i++) {
            if (assigned[i]) {
                continue;
            }
            let count = 0;
            const list = candidates[i];
            for (let j = 0; j < list.length; j++) {
                if (fits(list[j])) {
                    count++;
                }
            }
            if (count === 0) {
                return -1;
            }
            if (count < bestCount) {
                bestCount = count;
                best = i;
                if (bestCount === 1) {
                    return best;
                }
            }
        }
        return best;
    }

    let solutions = 0;

    function search(placed) {
        if (solutions >= limit || outOfBudget) {
            return;
        }
        if (steps > MAX_SEARCH_STEPS) {
            outOfBudget = true;
            return;
        }
        if (placed === clues.length) {
            solutions += 1;
            return;
        }

        const idx = pickMrv();
        if (idx < 0) {
            return;
        }

        const list = candidates[idx];
        assigned[idx] = 1;
        for (let j = 0; j < list.length; j++) {
            const rect = list[j];
            if (!fits(rect)) {
                continue;
            }
            mark(rect, 1);
            search(placed + 1);
            mark(rect, 0);
            if (solutions >= limit || outOfBudget) {
                break;
            }
        }
        assigned[idx] = 0;
    }

    search(0);
    return outOfBudget ? limit : solutions;
}

/**
 * @param {Clue[]} clues
 * @param {{width: number, height: number}} size
 * @returns {boolean}
 */
export function hasUniqueSolution(clues, size) {
    return countSolutions(clues, size) === 1;
}
