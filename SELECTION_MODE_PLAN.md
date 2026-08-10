# 🗺️ Selection Mode Switch — Feature Roadmap

> **Rules for Cursor:**
>
> 1. Focus ONLY on the step or task explicitly requested by the user. Do not write ahead or implement code for future steps.
> 2. Update the checklist markers (`[ ]` to `[x]`) and status labels of the active step when it is fully completed and verified.
> 3. Keep selection modes modular: preference storage, UI control, and pointer input handlers should stay separated so the three modes (corners / drag / both) can share one rectangle-placement pipeline.
> 4. Preserve existing corner-tap behavior as the default until persistence and the switch UI are in place.

---



## 📊 High-Level Feature Roadmap

- [x] Stage 1 — Preference Model & Persistence
- [x] Stage 2 — Three-Option Switch UI (below light/dark)
- [x] Stage 3 — Wire Switch to Preference Storage
- [x] Stage 4 — Drag-Select Input Engine
- [x] Stage 5 — Mode Gating (corners / drag / both)
- [x] Stage 6 — Live Drag Preview & Invalid Feedback
- [x] Stage 7 — Conflict Handling & Edge Cases
- [ ] Stage 8 — Polish, Accessibility & Manual QA

---



## 🎯 Feature Summary

Today the board only supports **corner selection** (tap cell A, then cell B). This feature lets the player choose how rectangles are drawn:


| Mode        | Behavior                                                        |
| ----------- | --------------------------------------------------------------- |
| **Corners** | Existing flow: tap first corner, tap second corner              |
| **Drag**    | Pointer down on start cell, drag to end cell, release to commit |
| **Both**    | Corners and drag are active at the same time                    |


A **3-option switch** sits directly under the existing light/dark mode control. The choice is persisted so it survives reloads.

Shared outcome for all modes: build a candidate rectangle with `buildRectangle`, run the same overlap / validate / paint / win checks already used by corner selection in `js/ui.js`.

---



## 📂 Files Likely Touched

```text
Shikaku/
├── SELECTION_MODE_PLAN.md   # this roadmap
├── index.html               # switch markup under #light-dark-button
├── css/
│   └── layout.css           # position + style the 3-option switch
├── js/
│   ├── storage.js           # get/set selection mode preference
│   ├── eventListeners.js    # switch + (if split) grid pointer listeners
│   ├── init.js              # restore mode on boot
│   ├── ui.js                # switch handler, mode-aware grid input
│   └── game.js              # only if drag needs shared helpers
└── assets/
    └── icons/               # optional icons for the three modes
```

---



## 🛠️ Detailed Breakdown by Stage



### ✅ Stage 1 — Preference Model & Persistence

- **Status:** ✅ DONE
- **Target Files:** `js/storage.js`, `js/selectionModes.js`
- **Goal:** Define the selection-mode values and load/save them with `localStorage`, matching the existing theme/difficulty pattern.
- **Tasks:**
  - [x] **1.1 Mode constants:** Choose a small set of string IDs (e.g. `corners` | `drag` | `both`) and document defaults (`corners` recommended for backward compatibility).
  - [x] **1.2 Storage API:** Add `getSelectionMode()` / `setSelectionMode(mode)` next to theme helpers; reject unknown values by falling back to default.
  - [x] **1.3 Optional early apply:** If useful later, expose the mode on a single source of truth (function only is enough; no need for a global event bus yet).

**Tools you will use**


| Tool                                               | Why on this stage                                                                                                                    |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Browser DevTools → Application → Local Storage** | Confirm the key is written and reloaded correctly without any UI yet.                                                                |
| **Browser Console**                                | Manually call `getSelectionMode` / `setSelectionMode` after a temporary import test, or set the raw key and verify defaulting logic. |
| `localStorage` **API** (in code)                   | Same persistence approach as `THEME_KEY` / `DIFFICULTY_KEY` in `storage.js`.                                                         |


---



### ⬜ Stage 2 — Three-Option Switch UI (below light/dark)

- **Status:** ⏳ PENDING
- **Target Files:** `index.html`, `css/layout.css` (optional: small icons under `assets/icons/`)
- **Goal:** Place a compact 3-option control **directly under** `#light-dark-button`, visually related to the theme control but not competing with the board.
- **Tasks:**
  - [x] **2.1 Markup:** Add a container (e.g. `#selection-mode-switch`) with three mutually exclusive options (buttons or a radio group styled as a segmented control). Label options clearly: Corners / Drag / Both.
  - [x] **2.2 Layout:** Position under the light/dark button (`top` offset past the 46px theme button + gap). Keep `z-index` consistent so it sits above the board but does not block the drawer.
  - [x] **2.3 Visual states:** Active option uses primary/surface tokens from `variables.css`; inactive options stay subdued. Match board chrome (border, shadow, radius language of the theme button / control bar).
  - [x] **2.4 Responsive note:** On narrow viewports, ensure the switch does not overlap the logo or timer; adjust top/right offsets if needed.

**Tools you will use**


| Tool                                            | Why on this stage                                                                         |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Browser DevTools → Elements + Styles**        | Live-tweak position under `#light-dark-button` and check box model / stacking.            |
| **Device / responsive mode**                    | Verify the switch does not collide with the title or control bar on small screens.        |
| **SVG / existing mask-icon pattern** (optional) | If you use icons, follow the same CSS mask technique as sun/moon on `#light-dark-button`. |


---



### ✅ Stage 3 — Wire Switch to Preference Storage

- **Status:** ✅ DONE
- **Target Files:** `js/eventListeners.js`, `js/ui.js`, `js/init.js`, `js/storage.js`
- **Goal:** Clicking an option updates UI immediately and persists; on startup the switch reflects the stored mode.
- **Tasks:**
  - [x] **3.1 Handler:** On option click/change, call `setSelectionMode`, update active class / `aria-pressed` / `aria-checked` on the three options.
  - [x] **3.2 Boot sync:** In `init`, read `getSelectionMode()` and paint the switch before or with theme restore.
  - [x] **3.3 Listener registration:** `addSelectionModeEventListener()` (or similar) from `eventListeners.js`, registered in `init.js` like the light/dark listener.
  - [x] **3.4 Changing mode mid-game:** Clear `pendingSelection` (and any drag preview state once it exists) so a half-finished corners pick cannot conflict with drag after a mode flip.

**Tools you will use**


| Tool                                        | Why on this stage                                                               |
| ------------------------------------------- | ------------------------------------------------------------------------------- |
| **Chrome DevTools → Event Listeners panel** | Confirm only one listener is bound and that the correct option fires.           |
| **Application → Local Storage**             | Toggle each of the three options and confirm the stored value flips every time. |
| **Hard refresh / new tab**                  | Prove persistence survives full reload.                                         |


---



### ✅ Stage 4 — Drag-Select Input Engine

- **Status:** ✅ COMPLETED
- **Target Files:** `js/ui.js` (primary), possibly a small helper extract if `addGridEventListener` grows too large
- **Goal:** Support “pointer down → move → up” rectangle selection on the grid, reusing `buildRectangle`, validation, overlap removal, paint, and win checks.
- **Tasks:**
  - [x] **4.1 Pointer lifecycle:** On the grid (or cells), handle `pointerdown` (capture start cell + `setPointerCapture` if useful), `pointermove` (resolve cell under pointer), `pointerup` / `pointercancel` (commit or cancel).
  - [x] **4.2 Hit testing:** Map client coordinates to a `.grid-cell` via `elementFromPoint` or cell rect math so dragging across cells still resolves `row`/`col`.
  - [x] **4.3 Commit path:** On successful release with start ≠ cancelled, build the rectangle and share one internal `placeRectangle(start, end)` used also by corners (refactor of the second-corner branch in `handleCellClick` is ideal).
  - [x] **4.4 Delete existing rect:** Decide drag-on-existing behavior (recommended: pointer down on a rectangle without meaningful drag removes it, mirroring first-tap erase in corners mode—document the choice when implementing).
  - [x] **4.5 Scrolling / page gestures:** With `user-select: none` already set, still prevent accidental page pan on touch if needed (`touch-action: none` on `#game-grid` during active drag).

**4.4 policy (implemented):** In drag-only mode, a press that never leaves the start cell (below drag threshold) removes the rectangle under that cell if any; it never places a 1×1. In both mode, the same tap is left to the click / corners path.

**Tools you will use**


| Tool                                                                        | Why on this stage                                                                 |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **Pointer Events API** (`pointerdown` / `move` / `up`, `setPointerCapture`) | Unified mouse + touch + pen path; prefer this over separate mouse + touch stacks. |
| `elementFromPoint` **/** `getBoundingClientRect`                            | Resolve which grid cell is under the finger/cursor while dragging.                |
| **DevTools → Performance or Event Listener breakpoints**                    | Diagnose missed `pointerup` / capture issues.                                     |
| **Real touch device or DevTools device mode + force touch simulation**      | Mouse-only testing is not enough for drag comfort and `touch-action`.             |


---



### ✅ Stage 5 — Mode Gating (corners / drag / both)

- **Status:** ✅ DONE
- **Target Files:** `js/ui.js`, `js/eventListeners.js` if listeners are split by mode
- **Goal:** Only enable the input methods required by the current preference.
- **Tasks:**
  - [x] **5.1 Corners-only:** Keep click / tap corner flow; do not start a drag commit (ignore short pointer moves as click if needed).
  - [x] **5.2 Drag-only:** Disable pending two-tap corner selection; ensure clicks do not leave a stuck `pendingSelection` unless you intentionally map click-to-cancel.
  - [x] **5.3 Both:** Allow corner taps and drag commits; define the disambiguation rule (e.g. movement past a small threshold = drag; otherwise treat as corner click).
  - [x] **5.4 Live rebinding:** When mode changes, re-read preference inside handlers (or re-attach listeners) so the next interaction follows the new mode without reload.

**Tools you will use**


| Tool                                                         | Why on this stage                                                      |
| ------------------------------------------------------------ | ---------------------------------------------------------------------- |
| **Mode matrix test checklist** (manual table: mode × action) | Systematically confirm each mode only allows intended inputs.          |
| **Breakpoint in** `handleCellClick` **/ drag handlers**      | Verify corners handlers are skipped in drag-only and vice versa.       |
| **Movement threshold constant**                              | Small pixel/delta check to separate tap from drag when mode is `both`. |


---



### ✅ Stage 6 — Live Drag Preview & Invalid Feedback

- **Status:** ✅ DONE
- **Target Files:** `js/ui.js`, `css/gameStates.css`, `js/cellClasses.js` if new classes are needed
- **Goal:** While dragging, show the provisional rectangle; on invalid commit (e.g. colliding with a validated region), flash feedback and do not leave a bad preview stuck on the board.
- **Tasks:**
  - [x] **6.1 Preview state:** Track `dragOrigin` + `dragCurrent` (or a preview rect) and extend `paintCellStates` (or a sibling painter) to highlight the preview region.
  - [x] **6.2 Invalid feedback:** Live overlay `blocked` / `valid` / `outline` states; invalid commit rejects without flash (intentional — no commit-time flash).
  - [x] **6.3 Cleanup:** On `pointercancel` / mode change / drag end, clear preview + capture via `clearActiveDrag` (does not pause the game).

**Tools you will use**


| Tool                                     | Why on this stage                                                                                                        |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **CSS animation inspection in DevTools** | Confirm invalid flash duration matches existing 300ms-style feedback without lingering classes.                          |
| `paintCellStates` **style debugging**    | Compare class toggles for selected / rectangle / preview layers so preview does not permanently look like a locked rect. |
| **Forced** `pointercancel` **testing**   | e.g. open the pause overlay or switch tabs mid-drag to ensure no stuck highlight.                                        |


---



### ✅ Stage 7 — Conflict Handling & Edge Cases

- **Status:** ✅ DONE
- **Target Files:** `js/ui.js`, possibly `js/game.js` for pure helpers
- **Goal:** Drag and corners share one placement policy so progress save, overlaps, and win detection stay correct.
- **Tasks:**
  - [x] **7.1 Shared placement:** One function for “accept or reject candidate rectangle” used by both input styles (validated overlap rejection, non-validated overlap replacement, `setActiveRectangles`, win → timer pause + overlays).
  - [x] **7.2 Outside grid:** Drag leaving the board cancels or clamps (pick one; clamping to last valid cell is usually better UX).
  - [x] **7.3 Multi-pointer:** Ignore secondary fingers; only the capturing pointer owns the gesture.
  - [x] **7.4 Overlays:** While `#game-inactive-overlay` or win overlay is visible, selection inputs must not place rectangles.
  - [x] **7.5 Same-cell drag:** Down and up on the same cell without drag — either cancel, treat as delete/select depending on mode policy, but never place a 1×1 unless that is intentional for a clue of 1.

**Tools you will use**


| Tool                                        | Why on this stage                                                       |
| ------------------------------------------- | ----------------------------------------------------------------------- |
| **Edge-case checklist**                     | Outside-grid, multi-touch, pause mid-drag, win mid-gesture.             |
| **Regression: complete a full easy puzzle** | After drag work, ensure Phase 2 win pipeline still fires.               |
| `localStorage` **progress keys**            | Confirm drag-placed rectangles still persist via `setActiveRectangles`. |


---



### ⬜ Stage 8 — Polish, Accessibility & Manual QA

- **Status:** ⏳ PENDING
- **Target Files:** `index.html`, `css/layout.css`, `js/ui.js`
- **Goal:** Ship a control that is understandable and keyboard/AT friendly enough for a settings-like toggle.
- **Tasks:**
  - [ ] **8.1 Accessibility:** Use `role="radiogroup"` + `role="radio"` (or a real radio group), `aria-label` on the group (“Selection mode”), and keyboard left/right or tab + enter/space.
  - [ ] **8.2 Labels:** Visible short labels and/or `title` tooltips (Corners / Drag / Both) so icons alone are not the only cue.
  - [ ] **8.3 Visual polish:** Align spacing under the theme button; hover/focus rings consistent with other surface controls.
  - [ ] **8.4 Full QA pass:** Run the mode matrix on desktop mouse and at least one touch path; update this plan’s checkboxes as each stage is verified.

**Tools you will use**


| Tool                                                       | Why on this stage                                                    |
| ---------------------------------------------------------- | -------------------------------------------------------------------- |
| **Keyboard-only navigation**                               | Tab/arrow through the radiogroup without a mouse.                    |
| **Screen reader spot-check** (Narrator / VoiceOver / NVDA) | Confirm the group and selected option are announced.                 |
| `prefers-reduced-motion` **(optional)**                    | Soften preview transitions if you add motion heavy enough to matter. |
| **Manual QA checklist**                                    | Final gate before merging to `main`.                                 |


---



## ✅ Suggested Implementation Order (Cursor sessions)

1. Ask Cursor to complete **only Stage 1**, then verify storage in DevTools.
2. Complete **Stage 2** (static UI, no behavior beyond layout).
3. Complete **Stage 3** (switch persists + reloads).
4. Complete **Stage 4** behind drag mode only (or a temporary force-drag flag).
5. Complete **Stage 5** so all three modes work.
6. Add preview/feedback (**Stage 6**), hardening (**Stage 7**), then a11y/QA (**Stage 8**).

Do not jump to drag logic before the preference API and switch exist unless you explicitly want an experimental branch.

---



## 🔗 Relationship to Existing Code


| Existing piece                                      | Role in this feature                                                      |
| --------------------------------------------------- | ------------------------------------------------------------------------- |
| `handleCellClick` in `ui.js`                        | Current corners engine; becomes mode-gated and shares placement with drag |
| `buildRectangle` / `validateRectangle` in `game.js` | Unchanged geometry + rules, used by both modes                            |
| `paintCellStates`                                   | Extend for pending corner + drag preview                                  |
| `getTheme` / `setTheme` in `storage.js`             | Template for selection-mode getters/setters                               |
| `#light-dark-button` layout in `layout.css`         | Anchor for positioning the new control underneath                         |


---



## 📝 Notes / Decisions to Confirm During Build

- **Default mode:** Prefer `corners` so existing players feel no behavior change until they opt in.
- **Both-mode threshold:** Pick a small pixel threshold (e.g. 6–10px) or a “left original cell” rule for tap vs drag.
- **Erase interaction in drag-only:** Match corners (tap/press existing free rectangle to remove) so rules stay consistent.
- **Icons vs text:** Segmented text labels are clearer on first ship; icons can follow if the control feels crowded.

