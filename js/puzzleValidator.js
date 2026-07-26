/**
 * @typedef {import('./game.js').Rectangle} Rectangle
 */

/**
 * @param {number} area
 * @returns {{width: number, height: number}[]} shapes
 */

export function generateAllShapes(area) {
    const shapes = [];
    for (let width = 1; width <= area; width++) {
        if (area % width === 0) {
            shapes.push({width, height: area / width});
        }
    }
    return shapes;
}

/**
 * @param {{row: number, col: number, value: number}} clue
 * @param {{width: number, height: number}} size
 * @returns {Rectangle[]} 
 */

export function candidateRectangles(clue, size) {
    const rectangles = [];
    let shapes = generateAllShapes(clue.value)
    shapes = shapes.filter(shape => shape.width <= size.width && shape.height <= size.height)
    for (const rectangle of shapes) {
        for (let row = 0; row < rectangle.height; row++) {
            for (let col = 0; col < rectangle.width; col++) {
                if (clue.row - row < 0 || clue.col - col < 0) {
                    continue;
                }
                if (clue.row - row + rectangle.height > size.height || clue.col - col + rectangle.width > size.width) {
                    continue;
                }
                rectangles.push({row: clue.row - row, col: clue.col - col, width: rectangle.width, height: rectangle.height});
            }
        }
    }
    return rectangles;
}

/**
 * @param {{row: number, col: number, value: number}[]} clues
 * @param {{width: number, height: number}} size
 * @param {number} limit
 * @returns {number}
 */

export function countSolutions(clues, size, limit = 2) {
    const allRectangles = []
    for (const clue of clues) {
        allRectangles.push({clue: clue, rectangles: candidateRectangles(clue, size)});
    }
    allRectangles.sort((a, b) => a.rectangles.length - b.rectangles.length)

    return countSolutionsHelper(size, limit, allRectangles, 0, 0, create2DArray(size));
}  

/**
 * @param {{width: number, height: number}} size
 * @param {number} limit
 * @param {{clue: {row: number, col: number, value: number}, rectangles: Rectangle[]}[]} allRectangles
 * @param {number} solutionsCount
 * @param {number} clueIndex
 * @param {boolean[][]} occupied
 * @returns {number}
 */

export function countSolutionsHelper(size, limit, allRectangles, solutionsCount, clueIndex, occupied) {
    if (solutionsCount >= limit || clueIndex === allRectangles.length) {
        return solutionsCount;
    }
    else {
        for (const rectangle of allRectangles[clueIndex].rectangles) {
            if (isValidRectangle(rectangle, occupied)) {
                if (clueIndex === allRectangles.length - 1) {
                    const updatedOccupied = updateOccupied(occupied, rectangle);
                    if (isValidSolution(updatedOccupied, size)) {
                        solutionsCount += 1;
                        if (solutionsCount === limit) {
                            return solutionsCount;
                        }
                    }
                    continue;
                }
                solutionsCount += countSolutionsHelper(size, limit - solutionsCount, allRectangles, 0, clueIndex + 1, updateOccupied(occupied, rectangle));
                if (solutionsCount >= limit) {
                    return solutionsCount;
                }
            }
        }
        return solutionsCount;
    }
}

/**
 * @param {{row: number, col: number, width: number, height: number}} rectangle
 * @param {boolean[][]} occupied
 * @returns {boolean}
 */

export function isValidRectangle(rectangle, occupied) {
    for (let row = rectangle.row; row < rectangle.row + rectangle.height; row++) {
        for (let col = rectangle.col; col < rectangle.col + rectangle.width; col++) {
            if (occupied[row][col]) {
                return false;
            }
        }
    }
    return true;
}

/**
 * @param {boolean[][]} occupied
 * @returns {boolean}
 */

export function isValidSolution(occupied, size) {
    for (let row = 0; row < size.height; row++) {
        for (let col = 0; col < size.width; col++) {
            if (!occupied[row][col]) {
                return false;
            }
        }
    }
    return true;
}

/**
 * @param {{width: number, height: number}} size
 * @returns {boolean[][]}
 */

export function create2DArray(size) {
    return Array.from({ length: size.height }, () => Array(size.width).fill(false));
}

/**
 * @param {boolean[][]} occupied
 * @param {{row: number, col: number, width: number, height: number}} rectangle
 * @returns {boolean[][]} occupied
 */

export function updateOccupied(occupied, rectangle) {
    const updatedOccupied = occupied.slice().map(row => row.slice());
    for (let row = rectangle.row; row < rectangle.row + rectangle.height; row++) {
        for (let col = rectangle.col; col < rectangle.col + rectangle.width; col++) {
            updatedOccupied[row][col] = true;
        }
    }
    return updatedOccupied;
}

/**
 * @param {{row: number, col: number, value: number}[]} clues
 * @param {{width: number, height: number}} size
 * @returns {boolean}
 */

export function hasUniqueSolution(clues, size) {
    return countSolutions(clues, size) === 1;
}