---
name: verify
description: Build, launch, and drive the dots app to verify changes end-to-end in the browser.
---

# Verifying dots

## Build & launch

- `npm run build` — production build (Turbopack); TypeScript errors surface here.
- `npm run lint` — ESLint; the react-hooks preset rejects synchronous setState in effects.
- `npm run dev` (background) — ready in <1s at http://localhost:3000.

## Driving the app

Firebase config comes from `.env.local` (real project: Auth email/password +
Firestore are enabled). Drive with the Chrome tools:

- Unauthenticated visits to `/` redirect to `/login`. A test account
  `claude.test.habitkit@example.com` / `test-habits-1234` exists with one habit.
- Flows worth driving: signup → main; + button → New Habit form (color grid,
  stepper, tracking toggle) → Save; today-checkbox toggle fills the heatmap
  cell instantly (Firestore latency compensation); view switcher pill at the
  bottom (grid/list/compact); habit name → detail (26-week heatmap, month
  calendar with prev/next); pencil → edit form is prefilled; settings gear →
  Dark Mode switch flips the `.dark` class instantly and persists in
  localStorage (`dots-theme`) across reloads; Sign Out → `/login`.

## Gotchas

- The Next.js dev overlay badge (bottom-left) counts console errors that the
  console-messages tool may miss — click the badge to read them.
- Base UI Buttons that render a `<Link>` need `nativeButton={false}` or the
  overlay logs an accessibility error per render.
- List-view day cells and calendar days toggle specific past dates; future
  days are disabled.
