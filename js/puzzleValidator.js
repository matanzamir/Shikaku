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
 * @param {{row: number, col: number, value: number}} clue
 * @param {{width: number, height: number}} size
 * @param {number} limit
 * @returns {number}
 */

export function countSolutions(clues, size, limit = 2) {
    const allRectangles = []
    for (const clue of clues) {
        allRectangles.push(...candidateRectangles(clue, size));
    }
    allRectangles.sort((a, b) => a.length - b.length)
    let solutions = 0;
    for (const clueOptions of allRectangles) {
        for (const rectangle of clueOptions) {
            
        }
    }
}  

/**
 * 
 */

export function hasUniqueSolution(clues, size) {
    return countSolutions(clues, size) === 1;
}