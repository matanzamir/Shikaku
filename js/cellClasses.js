/**
 * DOM class names for cell visual states.
 * Use these instead of string literals so renames stay in one place.
 */
export const CellClass = Object.freeze({
    CLUE: 'clue',
    RECTANGLE: 'rectangle',
    SELECTED: 'selected',
    VALIDATED: 'validated',
    // Purely visual hooks (see paintCellStates): mark which sides of a
    // covered cell sit on its rectangle's true outer edge, so CSS can
    // draw a border/rounded-corner only there and stay flush elsewhere.
    EDGE_TOP: 'edge-top',
    EDGE_BOTTOM: 'edge-bottom',
    EDGE_LEFT: 'edge-left',
    EDGE_RIGHT: 'edge-right',
});
