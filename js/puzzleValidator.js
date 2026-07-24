/**
 * @typedef {import('./game.js').Rectangle} Rectangle
 */

/**
 * @param {number} area
 * @returns {{width: number, height: number}} shapes
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
 * @param {row: number, col: number, value: number} clue
 * @param {width: number, height: number} size
 * @returns {Rectangle[]} 
 */

export function candidateRectangles(clue, size) {
    const rectangles = [];
    const shapes = generateAllShapes(size.area)
    shapes.filter(shape => shape.width <= size.width && shape.height <= size.height)
    for (const rectangle of shapes) {
        if (!(shape.width <= size.width && shape.height <= size.height)) { continue };
    }
    return rectangles;
}