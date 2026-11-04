# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- `npm run dev` — start the dev server (http://localhost:3000)
- `npm run build` — production build
- `npm run start` — serve the production build
- `npm run lint` — run ESLint (flat config in `eslint.config.mjs`, extends `eslint-config-next`)

No test framework is configured yet.

## Architecture

This is **dots**, a habit-tracking app built on a `create-next-app` scaffold.

- **Next.js App Router** (`app/`), TypeScript, path alias `@/*` → repo root.
- **Styling**: Tailwind CSS v4, configured via `@theme inline` in `app/globals.css`
  (no `tailwind.config`). Colours follow the javian ng brand, **Kinari & Sumi**: kinari
  paper, sumi ink, and one persimmon accent (`--accent`) reserved for "now" (today's dot,
  a full progress ring, a reached goal). Light/dark variants are toggled by a `.dark`
  class. Habit colours come from `lib/palette.ts` and must be rendered through
  `habitTint()` / `habitTintAlpha()` so dark mode can swap pigments; glyphs on a habit
  colour use `--on-tint`. Days and tiles use `rounded-squircle` (32%, the app icon's
  corner). Fonts are loaded in `app/layout.tsx` via `next/font/google`: Inter
  (`--font-inter`) with Noto Sans SC (`--font-noto-sc`) for Chinese, combined into
  `--font-sans`; headings use the same family.
- **UI components**: shadcn/ui (`components.json`, style `base-mira`), built on
  `@base-ui/react` primitives (not Radix) with `class-variance-authority` for variants
  and the `cn()` helper (`lib/utils.ts`, clsx + tailwind-merge) for class merging. Add
  new components with `npx shadcn add <name>`; they land in `components/ui/`.
- **Firebase**: client init in `lib/firebase.ts`; auth in `hooks/use-auth.tsx`. Habits
  are subscribed once at the root (`HabitsProvider` in `hooks/use-habits.tsx`, mounted by
  `components/app-providers.tsx`), so pages read `useHabits()` with no loading flash.
  Security rules live in `firestore.rules`.
- **Motion / Apple feel**: page transitions use React `<ViewTransition>`
  (`experimental.viewTransition` in `next.config.ts`). Wrap each page in
  `PageTransition` and tag navigations with `nav("push" | "pop" | "sheetUp" |
  "sheetDown" | "fade")` from `lib/transitions.tsx` (via `<Link transitionTypes>` or
  `router.push(href, { transitionTypes })`). Keyframes and easing tokens
  (`--ease-ios`, `--ease-spring`) are in `app/globals.css`, along with `.material`,
  `.pressable`, `.tappable` utilities. iOS-style grouped lists: `components/grouped-list.tsx`.
- **Habit model**: a habit has a goal type (`count` check-off, `amount`, `time`
  countdown, `limit`), a `schedule` (daily / fixed weekdays / N× a week or month /
  every N days) and optional times of day (`parts`). Goal and schedule rules live in
  `lib/schedule.ts` (targets, today's status, streaks, labels); writes go through
  `lib/check-in.ts`. A day's `count` means taps, seconds or units depending on the
  goal; completion docs also carry `completed`, `skipped` and `slots`. Running timers
  are stored on the habit doc and finished by `TimerRunner` (`hooks/use-timer.tsx`).
  New Habit templates are in `lib/templates.ts`.
- **Toasts**: Sonner (`components/ui/sonner.tsx`, top-centre). Completing a habit calls
  `celebrateCompletion()` in `components/celebrate-toast.tsx`; haptics in `lib/haptics.ts`.
