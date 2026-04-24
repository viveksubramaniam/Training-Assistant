# Striive v2 Redesign — Implementation Plan

## Background

The app was run through Claude Design (claude.ai/design), which generated a full HTML prototype implementing the "Striive v2" premium-athletic design system. The prototype was exported and extracted from `https://api.anthropic.com/v1/design/h/gRKVB6V3YnIyL1wcs-Iz-A`.

Design reference files are at: `/tmp/design_extracted/striive/project/redesign/` (re-extract via the URL if /tmp is cleared).

**Design philosophy (from the chat transcript):**
- Premium-athletic aesthetic (Whoop / Oura-adjacent)
- Dark only, no glass morphism, flat surfaces, confident type
- Space Grotesk display + JetBrains Mono for data
- Deep midnight background, refined ignite orange (less neon), functional accent colors only for data
- One primary thing per screen — focus over density

---

## What's Already Done ✅

| Component | File | Notes |
|---|---|---|
| Home (Focus variant) | `frontend/src/DailyPlanTab.jsx` | Hero session card, readiness strip, effort profile bar, CTA buttons |
| Plan (Grid variant) | `frontend/src/CalendarPage.jsx` | Month grid, session type dots, metrics strip, selected day preview |
| Activity Detail | `frontend/src/ActivityDetailPage.jsx` | Leaflet map, 6-stat grid, HR trace, coach insight card |
| Activity List | `frontend/src/App.jsx → ActivityListPage` | 30-day sparkline, filter chips, list with type icons |
| Login Screen | `frontend/src/App.jsx → LoginScreen` | Editorial style, Strava button, demo account |
| Bottom Nav | `frontend/src/App.jsx → BottomNav` | Elevated center coach button, hash-based navigation |
| Hash routing | `frontend/src/App.jsx` | `#/home` `#/plan` `#/activity` `#/activity/:id` `#/coach` `#/profile` `#/login` |
| Design tokens | `frontend/src/index.css` | Full OKLCH token set, Space Grotesk + JetBrains Mono |

---

## What Needs to Be Done

### Task A — ProfilePage.jsx Redesign
**File:** `frontend/src/ProfilePage.jsx`  
**Design reference:** `proto-routes-b.jsx → ProfileRoute`

Replace the current 2-tab layout (Current Goal / History tabs, lucide-react icons, `#f97415`, glass-card, slate Tailwind colors) with:

1. **User row** — gradient avatar (ignite→crimson) with initial, name, "Since Feb 2024 · Strava linked" in mono
2. **Current goal hero card** — ignite ambient glow, goal type + title + days remaining, training-phase progress bar (Base → Build → Peak → Taper → Race) with dot marker, 3-stat grid (Weekly km, Avg pace, On track YES/NO), Edit goal + Mark complete buttons
3. **Fitness snapshot** — 2×2 card grid: VO₂ max, Resting HR, 5k PR, Weekly load (each with colored trend badge)
4. **Settings list** — Notifications, Units · Metric, Strava sync, Sign out (crimson color, calls `go('#/login')`)

**Keep:** goal fetch from `/api/goals`, GoalEditorModal, complete-goal confirmation, sign out (clear `authToken` from localStorage)  
**Remove:** History tab + tab switcher, lucide-react imports

---

### Task B — ChatWidget.jsx Redesign
**File:** `frontend/src/components/ChatWidget.jsx`  
**Design reference:** `proto-routes-b.jsx → ChatRoute`

Replace the overlay component (emerald/teal/rose Tailwind colors, Lucide icons) with a full-screen page:

1. **Header** — back button (circle, `history.back()` or `go('#/home')`), gradient coach avatar (ignite→crimson), "Coach" title + "● LIVE" in mint mono
2. **Message thread** — user messages right-aligned with `var(--color-ignite)` background, coach messages left-aligned with `var(--color-surface)` + line border; asymmetric border-radius (speech-bubble style)
3. **Plan updated card** — `var(--color-ignite-wash)` background with ignite ring border, plan details, "View session →" button
4. **Quick suggestion pills** — rounded pill buttons with surface background
5. **Input bar** — pill shape, surface background, "Ask coach…" placeholder, send button (ignite when text present, surface-2 when empty)

**Keep:** all API calls to `/api/coach/chat`, history loading, `onPlanUpdate`/`onGoalChanged` callbacks, action badges (re-styled with v2 tokens instead of emerald/teal classes)

---

### Task C — GoalEditorModal + ConfirmationModal Token Update
**Files:** `frontend/src/GoalEditorModal.jsx`, `frontend/src/components/ConfirmationModal.jsx`

Token swap only — no structural/functional changes:

| Old | New |
|---|---|
| `#f97415` | `var(--color-ignite)` |
| `bg-white/5` | `background: var(--color-surface)` |
| `border-white/10` | `border: 1px solid var(--color-line)` |
| `text-slate-400` / `text-slate-300` | `color: var(--color-fg-dim)` / `var(--color-fg-muted)` |
| `text-white` | `color: var(--color-fg)` |
| `bg-gray-700` | `background: var(--color-surface-2)` |
| `background: '#1e293b'` | `background: var(--color-surface)` |
| Destructive button | `var(--color-crimson)` |

---

### Task D — App.jsx: Coach as Full Route
**File:** `frontend/src/App.jsx`  
**Design reference:** `proto-routes-a.jsx → BottomNavC`

1. Add `#/coach` to the routing switch — renders `<ChatWidget isOpen={true} onClose={() => go('#/home')} .../>` as a full page
2. Update `BottomNav` center-button `onClick` to `() => go('#/coach')` instead of `onOpenCoach`
3. Remove `onOpenCoach` prop from BottomNav and its callsite
4. `ChatWidget` back button (from Task B) handles returning to `#/home`

---

## Implementation: Parallel Agents

Spawn these 4 agents in parallel after plan approval:

| Agent | Task | Files touched |
|---|---|---|
| Agent 1 | ProfilePage v2 redesign | `ProfilePage.jsx` |
| Agent 2 | ChatWidget v2 redesign + back nav | `components/ChatWidget.jsx` |
| Agent 3 | GoalEditorModal + ConfirmationModal token swap | `GoalEditorModal.jsx`, `components/ConfirmationModal.jsx` |
| Agent 4 | App.jsx coach route wiring | `App.jsx` |

Then trigger **Agent 5 (verification)** after all 4 complete — read-only fidelity check against the design spec.

---

## Design Token Reference

All defined in `frontend/src/index.css`:

```
--color-bg            oklch(0.16 0.015 250)    deep midnight (page bg)
--color-surface       oklch(0.205 0.013 250)   card surface
--color-surface-2     oklch(0.24 0.012 250)    raised / input
--color-line          rgba(255,255,255,0.06)   subtle borders
--color-line-hi       rgba(255,255,255,0.10)   highlighted borders
--color-fg            oklch(0.96 0.005 80)     primary text
--color-fg-muted      oklch(0.70 0.012 250)    secondary text
--color-fg-dim        oklch(0.52 0.012 250)    labels / captions
--color-fg-faint      oklch(0.38 0.012 250)    disabled / placeholder
--color-ignite        oklch(0.72 0.17 48)      brand orange
--color-ignite-hi     oklch(0.80 0.16 55)      hover state
--color-ignite-lo     oklch(0.45 0.13 45)      pressed state
--color-ignite-wash   ignite @ 12% opacity     card tint
--color-ignite-ring   ignite @ 25% opacity     card border tint
--color-mint          oklch(0.78 0.12 165)     recovery / easy runs
--color-gold          oklch(0.82 0.14 85)      tempo / threshold
--color-crimson       oklch(0.66 0.19 18)      HR peak / hard / destructive
--color-sky           oklch(0.76 0.10 230)     long runs / cross training
```

Font utilities: `font-display` (Space Grotesk), `mono-data` / `font-mono` (JetBrains Mono)

---

## Verification Checklist

After all agents complete:

- [ ] `#/profile` — user row with gradient avatar, goal hero with phase progress bar, fitness 2×2 grid, settings list; no slate/glass/emerald colors
- [ ] `#/coach` — full screen, not overlay; coach gradient avatar, v2 bubble styling, plan-updated card, pill input bar
- [ ] Coach bottom nav button → navigates to `#/coach`; back button in coach → returns to `#/home`
- [ ] "Edit goal" in Profile → GoalEditorModal opens with v2 tokens (ignite orange, surface backgrounds)
- [ ] ConfirmationModal uses v2 surface + crimson for destructive action
- [ ] All API calls still function (goal fetch, chat, sign out)
- [ ] No lucide-react imports in ProfilePage or ChatWidget (use inline SVG per v2 pattern)
