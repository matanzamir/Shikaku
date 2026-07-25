# Uniqueness Validator for Generated Shikaku Puzzles

Partition + clue placement always yields at least one solution (yours). Uniqueness means proving no second packing exists — that needs a small solver.

## Goal

After `partitionRecursion` + `cluePlacement`, accept a puzzle only when it has **exactly one** solution.

`hasUniqueSolution(clues, size) → boolean` means: count solutions and accept only when the count is exactly `1`. Stop as soon as a second solution is found (no need to enumerate all).

```text
partitionRecursion → cluePlacement → countSolutions(max 2)
                                      ├─ 1  → accept clues
                                      └─ 2+ → retry with a new partition
```

## Target file

`js/puzzleValidator.js` — candidate generation and solution counting.  
`js/puzzleGenerator.js` — calls the validator inside the `generatePuzzle` retry loop.

## Algorithm

Two pieces: **candidate generation**, then **backtracking**.

### 1. Candidates per clue

**`generateAllShapes(area)` / `factorPairs(area)`** answers: "what rectangle shapes have this area?"  
Example: area `6` → `{1×6, 2×3, 3×2, 6×1}`.

**`candidateRectangles(clue, size)`** answers: "given only this clue, which rectangles could legally cover it?"  
It is **not** `cluePlacement`. Those are opposite directions:

- `cluePlacement`: input = known rectangle → output = one random cell + area as a clue (hides the partition)
- `candidateRectangles`: input = known clue → output = all legal rectangles that could satisfy that clue (feeds the uniqueness search)

For clue `{row, col, value}` on an `N×N` grid, every legal rectangle must:

- contain `(row, col)`
- have `width * height === value`
- stay inside `[0, N)`

Steps:

1. Call `generateAllShapes(value)` to get shapes `(h, w)`
2. For each shape, slide the top-left over every position that still covers the clue cell:
   - top row `r` from `max(0, row - h + 1)` to `min(row, N - h)`
   - left col `c` from `max(0, col - w + 1)` to `min(col, N - w)`
3. Collect each `(r, c, w, h)` as a candidate rectangle

Sort clues by fewest candidates first (MRV) so the search prunes early.

### 2. Backtracking with occupancy

Keep a flat `N*N` occupancy mask (or 2D boolean grid). Recursively:

1. Pick next unassigned clue (MRV order)
2. Try each of its candidates that does not overlap occupied cells
3. Mark cells, recurse; unmark on backtrack
4. When all clues are placed, if every cell is covered → one solution found
5. If `solutions === 2`, return immediately (not unique)

Coverage check: track `filledCells` and require `filledCells === N*N` at the leaf. Clues already force area = value, so filled area equals the sum of clue values; if that sum ≠ `N*N` the puzzle is malformed and has 0 solutions.

### 3. Wire into the generator

In `generatePuzzle`, replace the stub with uniqueness only for now:

```js
validated = countSolutions(clues, difficulty.size, 2) === 1;
```

Defer any boredom / difficulty-scoring check until uniqueness works.

## Suggested signatures

```js
function generateAllShapes(area) // → [{width, height}, ...]
function candidateRectangles(clue, size) // → Rectangle[]
export function countSolutions(clues, size, limit = 2) // → number in 0..limit
export function hasUniqueSolution(clues, size) // → boolean
```

## Performance notes

For Easy / Medium / Hard (7 / 10 / 15) with early exit at 2 solutions and MRV ordering, this is typically fine in the browser. If Hard ever gets slow, consider later:

- pre-check that `sum(clue.values) === size * size`
- bitsets for occupancy
- optional time budget in the regenerate loop

Do not add those until measured.

## Out of scope for this step

- Boredom / aesthetic scoring
- Player-facing hint solver
- Changing difficulty tables
