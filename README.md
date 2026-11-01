# dots

A quiet way to keep your habits.

Each day is a dot. Fill it in, and let the pattern build itself.

## What it does

- **Track** — mark a habit done for the day, in one tap.
- **See** — a year of dots, laid out as a heatmap.
- **Hold** — a running streak, and a goal if you want one.
- **Choose your view** — grid, list, or compact.

## Getting started

```bash
npm install
npm run dev
```

Open [localhost:3000](http://localhost:3000).

## Commands

| Command | Does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Build for production |
| `npm run start` | Serve the production build |
| `npm run lint` | Check code with ESLint |
| `npm run format:check` | Check formatting with Prettier |
| `npm run format:write` | Apply formatting with Prettier |

## Built with

Next.js (App Router), TypeScript, and Tailwind CSS. Components from
shadcn/ui, on top of Base UI. Auth and data via Firebase.

See `CLAUDE.md` for architecture notes.

## Reminders (Web Push)

dots can send a daily reminder if today's dots aren't filled in. It uses
standard Web Push, so there's no paid service involved:

- **Browser side**: `app/manifest.ts` + `public/sw.js` make dots installable,
  and the Reminders switch in Settings subscribes the device
  (`lib/push.ts`, `components/reminder-settings.tsx`).
- **Sender**: `scripts/reminders/send-reminders.mjs`, run every 15 minutes by
  `.github/workflows/reminders.yml`. It reads due reminders from Firestore and
  pushes only to users with habits still open today.

On **iPhone/iPad** (iOS 16.4+), notifications only work after dots is added to
the Home Screen from Safari and opened from there.

### Setup

1. Generate VAPID keys: `npx web-push generate-vapid-keys`
2. Add the public key to your hosting env (and `.env.local`) as
   `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, then redeploy.
3. In Firebase console → Project settings → Service accounts, generate a
   private key (JSON).
4. In GitHub → Settings → Secrets and variables → Actions, add:
   - `FIREBASE_SERVICE_ACCOUNT`: the full service account JSON
   - `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`: from step 1
   - `VAPID_SUBJECT`: `mailto:you@example.com`
5. Publish the Firestore rules in `firestore.rules` (paste them into Firebase
   console → Firestore → Rules, or run
   `npx firebase-tools deploy --only firestore:rules`).
6. Merge to the default branch (scheduled workflows only run from there). To
   test, run **Send reminders** manually from the Actions tab with `force` on.

Data lives at `users/{uid}.reminder` (`enabled`, `time`, `timezone`,
`lastSentDate`) and `users/{uid}/pushSubscriptions/{id}` (one per device).
