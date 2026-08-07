export function isBoring(rectangles, size) {
    const allRows = rectangles.every(r => r.height === 1 && r.width === size);
    const allCols = rectangles.every(r => r.width === 1 && r.height === size);
    return allRows || allCols || mostlySizedStrips(rectangles, size) || mostlySameRatio(rectangles, size) || mostlySameDirection(rectangles, size) || dominoFlood(rectangles, size);
  }

/**
 * @param {Rectangle[]} rectangles
 * @param {number} size
 * @returns {boolean}
 */
function mostlySizedStrips(rectangles, size) {
    const total = size * size;
    const area = (r) => r.width * r.height;
    const fullHeight = rectangles.filter((r) => r.height === size).reduce((s, r) => s + area(r), 0);
    const fullWidth = rectangles.filter((r) => r.width === size).reduce((s, r) => s + area(r), 0);
    return fullHeight / total > 0.6 || fullWidth / total > 0.6;
}

function mostlySameRatio(rectangles, size) {
    const keys = rectangles.map((r) => `${r.width}x${r.height}`);
    const dominant = Math.max(...[...keys.reduce((m, k) => m.set(k, (m.get(k) || 0) + 1), new Map()).values()]);
    return dominant / rectangles.length > 0.85;
}

function mostlySameDirection (rectangles, size) {
    const cols = rectangles.filter(r => r.height > r.width && r.height / r.width >= 2);
    const rows = rectangles.filter(r => r.width > r.height && r.width / r.height >= 2);
    return cols.length / rectangles.length > 0.85 || rows.length / rectangles.length > 0.85;
}

function dominoFlood(rectangles, size) {
    const dominos = rectangles.filter(r => r.width * r.height === 2);
    return (dominos.length * 2) / (size * size) > 0.5;
}