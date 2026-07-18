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
  (no `tailwind.config`). Colors are oklch tokens with light/dark variants toggled by
  a `.dark` class. Fonts are loaded in `app/layout.tsx` via `next/font/google` and
  exposed as CSS variables: Quattrocento Sans for headings (`--font-heading`, applied
  to all `h1`-`h6` via a base-layer rule in `app/globals.css`), Muli/Mulish for body
  text (`--font-sans`), and Geist Mono (`--font-mono`, currently unused in the UI).
- **UI components**: shadcn/ui (`components.json`, style `base-mira`), built on
  `@base-ui/react` primitives (not Radix) with `class-variance-authority` for variants
  and the `cn()` helper (`lib/utils.ts`, clsx + tailwind-merge) for class merging. Add
  new components with `npx shadcn add <name>`; they land in `components/ui/`.
- **Firebase** is a declared dependency but not yet wired up anywhere in the source —
  no config/init file exists yet.
