# 🗺️ Shikaku Website — Professional Learning Roadmap

> **Rules for Cursor:**
> 1. Focus ONLY on the step or task explicitly requested by the user. Do not write ahead or implement code for future steps.
> 2. Update the checklist markers (`[ ]` to `[x]`) and status labels of the active step when it is fully completed and verified.
> 3. Ensure all JavaScript implementations stay modular, clean, and follow the specified Target Folder Structure.

---

## 📊 High-Level Project Roadmap

- [x] Phase 1 — Foundations (Layout & Custom Design Tokens)
- [x] Phase 2 — Core Shikaku Gameplay & Input Validation
- [ ] Phase 3 — Seeded Deterministic Puzzle Generator
- [ ] Phase 4 — Game Loop Controls (Timer & Active Resets)
- [ ] Phase 5 — System Settings (Theme Persistence & Difficulty)
- [ ] Phase 6 — Static Context & Instructional Drawers
- [ ] Phase 7 — Daily Puzzle Rotation & Historical Archive
- [ ] Phase 8 — Visual Aesthetic Polish & Mobile Responsiveness

---

## 📂 Target Folder Structure
*Grow the workspace into this layout gradually. Split modules when files exceed ~150 lines.*

```text
Shikaku/
├── index.html
├── css/
│   ├── variables.css    # Colors, tokens, light/dark definitions
│   ├── layout.css       # Layout wrappers, layout bugs resolution
│   ├── components.css   # Buttons, sliders, drawer layouts
│   └── themes.css       # Specialized theme overrides
├── js/
│   ├── main.js          # App lifecycle and event orchestration
│   ├── puzzleGenerator.js # Seeded mulberry32 generation pipeline
│   ├── game.js          # Grid array structures, rect drawings, bounds verification
│   ├── ui.js            # Drawer controls, layout transitions, selection renders
│   ├── timer.js         # Date/time interval handlers
│   └── storage.js       # LocalStorage configurations
└── assets/
    └── (favicon, fonts)
```

---

## 🛠️ Detailed Breakdown by Phase

### 🟩 Phase 1 — Foundations
- **Status:** ✅ COMPLETE
- **Target Files:** `index.html`, `css/variables.css`, `css/layout.css`
- **Goal:** Set up a clean semantic layout, resolve the current CSS alignment/column bugs, and implement standard CSS design tokens.
- **Tasks:**
  - [x] **1.1 HTML Structuring:** Expand `index.html` with functional semantics including `<header>`, `<main>`, `<aside>` wrappers for settings/help drawers, and a dedicated `#win-overlay`.
  - [x] **1.2 Design Tokens:** Build `css/variables.css` using `:root` custom properties for easy variable mapping and prepare `[data-theme="dark"]` structural mappings.
  - [x] **1.3 Layout Fixes:** Refactor container layouts using Flexbox/Grid. Resolve invalid syntax declarations (`grid-template-columns: 5` and `position: center`). Use CSS properties to dynamically size `#game-block` (e.g., `--grid-size`).

### 🟩 Phase 2 — Core Shikaku Gameplay
- **Status:** ✅ COMPLETE
- **Target Files:** `js/game.js`, `css/components.css`
- **Goal:** Render a playable grid and write input validation rules handling non-overlapping area coordinates.
- **Tasks:**
  - [x] **2.1 Data Models:** Setup client-side immutable puzzle models (`{ rows, cols, clues: [] }`) alongside a mutable tracking array (`{ rectangles: [] }`).
  - [x] **2.2 Grid Generation:** Program dynamic DOM element injection into `#game-block` utilizing custom sizing mappings. Distinguish clue markers visually from active interactive zones.
  - [x] **2.3 Rectangle Selection Engine:** Build corner-selection interaction coordinates (Click Cell A -> Click Cell B) logic to formulate, render, or safely slice an active region overlay.
  - [x] **2.4 Matrix Geometry Validation:** Implement spatial verification checks. Enforce bounds rules: Ensure rectangles encapsulate exactly one clue index, validation dimensions equal specified grid areas (`width × height == value`), and coordinate lines do not intersect.
  - [x] **2.5 Win Matrix Checker:** Implement full completion scanners confirming code coverage matrix contains zero grid gaps or illegal overrides. Toggle visual flags on win completion state.

### ⬜ Phase 3 — Seeded Deterministic Puzzle Generator
- **Status:** ⏳ PENDING
- **Target Files:** `js/puzzleGenerator.js`
- **Goal:** Build a procedural grid partition system driven by explicit date/difficulty hashes to guarantee identical daily map layouts across browsers.
- **Tasks:**
  - [x] **3.1 PRNG Engine Setup:** Code a deterministic random engine variant (like `mulberry32`) tied directly to hashed timestamp intervals.
  - [ ] **3.2 Grid Splitting Strategy:** Implement recursive direction binary splitting functions to break boundaries down into proportional matrix components.
  - [ ] **3.3 Grid Extraction Rules:** Map clue definitions out across generated clusters; hide baseline layout paths to keep source definitions fully implicit.
  - [ ] **3.4 Scale Mappings configuration:** Standardize matrix tiers: Easy (`7×7`), Medium (`10×10`), and Hard (`15×15`).
  - [ ] **3.5 Code Cleaning:** Remove the error catchers and object immutability in the createPuzzle function.

### ⬜ Phase 4 — Game Loop Controls
- **Status:** ⏳ PENDING
- **Target Files:** `js/timer.js`, `js/main.js`
- **Goal:** Wire up session management clocks, progress tracking, and secure game state reset switches.
- **Tasks:**
  - [ ] **4.1 Dynamic Tracking Timer:** Build an active tracker framework tracking local environment intervals (`setInterval`/`clearInterval`). Save baseline anchor dates rather than absolute increments to prevent background tab sleep bugs.
  - [ ] **4.2 Board Purge Routine:** Bind clean reset states clearing rectangle history logs completely while keeping current active seed layout assets unchanged.
  - [ ] **4.3 Automatic Win Catchers:** Chain completion hooks to the placement pipeline to automatically intercept the exact moment of solution clearance, stopping the active timer metrics instantly.

### ⬜ Phase 5 — System Settings
- **Status:** ⏳ PENDING
- **Target Files:** `js/storage.js`, `js/ui.js`
- **Goal:** Program modular settings menus that update UI layouts and securely save layout options via persistent storage hooks.
- **Tasks:**
  - [ ] **5.1 Slider Drawer Framework:** Code flyout containers using smooth hardware-accelerated transitions via CSS `transform` rules.
  - [ ] **5.2 Theme Synchronization Switcher:** Sync dataset selectors toggling layout themes across structural target parameters cleanly without style flashing bugs.
  - [ ] **5.3 State Retention Setup:** Hook local environment key configs (`localStorage`) ensuring preferences match user configs on initialization.
  - [ ] **5.4 Intercept Risk Logic:** Insert user confirmation alerts warning players of data wipes before updating grid difficulty settings.

### ⬜ Phase 6 — Static Context & Instructional Drawers
- **Status:** ⏳ PENDING
- **Target Files:** `index.html`, `css/components.css`
- **Goal:** Build a dry, fast instruction tray template rendering step charts, diagrams, and operational layout maps cleanly.
- **Tasks:**
  - [ ] **6.1 Container Layout Uniformity:** Extend the structural wrapper definitions built in Phase 5 to seamlessly scale auxiliary menu windows.
  - [ ] **6.2 Instructional UI Matrix:** Layout micro grid schemas or ascii design documentation detailing alignment and coordinate solutions step by step.

### ⬜ Phase 7 — Daily Puzzle Rotation & Historical Archive
- **Status:** ⏳ PENDING
- **Target Files:** `js/storage.js`, `js/main.js`
- **Goal:** Build date-seeded map hooks parsing timeline configurations to manage chronological archiving loops.
- **Tasks:**
  - [ ] **7.1 Local Timestamp Handlers:** Leverage your local user timezone indicators to securely structure calendar index maps.
  - [ ] **7.2 Historical Grid Loaders:** Inject timeline parameters dynamically using structured URL inputs (e.g., `?date=YYYY-MM-DD`) or clean calendar layout overlays.
  - [ ] **7.3 Achievement Retention Trackers:** Append timeline clearance metadata to localized browser memory banks to mark completed dates on historical trackers.

### ⬜ Phase 8 — Visual Aesthetic Polish & Mobile Responsiveness
- **Status:** ⏳ PENDING
- **Target Files:** Entire codebase
- **Goal:** Elevate layout interfaces to clean consumer-grade specifications through smooth interaction styling, animations, and fluid view transformations.
- **Tasks:**
  - [ ] **8.1 Active Element UI Tuning:** Implement smooth micro-interaction behaviors on tap/click inputs via scaling matrix rules (`transform: scale(0.98)`).
  - [ ] **8.2 Grid Feedback Visuals:** Build clean alert classes flashing error components red for 300ms when bounding calculations breach constraint targets.
  - [ ] **8.3 Fluid Boundary View Scaling:** Integrate scaling handlers (like `max-width: 90vw` or specialized transform maps) ensuring complex layouts fit mobile screens nicely.
  - [ ] **8.4 Fonts Architecture Refactoring:** Inject systemic Google Typography links (like *Bungee Shade*) across runtime setup modules to stabilize visual style targets.