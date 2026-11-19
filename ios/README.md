# dots for iPhone

A native SwiftUI version of dots. It uses the same Firebase project as the web
app, so your habits, history, timers and life-in-weeks are the same on the
phone, on the web and for your agent's MCP.

## Offline and sync

- Firestore keeps a full copy of your data on the phone (unlimited persistent
  cache). Habits open instantly with no signal.
- Every tap is applied on the phone straight away and queued. Nothing waits on
  the server, so the app never hangs on a weak signal.
- Queued changes upload by themselves when the phone is back online, even if
  the app was closed in between. Changes from the web arrive live.
- Firebase keeps you signed in on the phone (keychain), so launching offline
  goes straight to your habits.
- The toolbar shows **Offline** with no network and **Syncing** while changes
  are on their way up. Settings → Sync shows the same.

## Reminders

Reminders are local notifications scheduled on the phone, not Web Push. They
fire at the exact time you set, offline too. The app re-plans the next week
of reminders whenever your habits change: today's text counts what's actually
left, and a day with nothing left gets no reminder. A running timer also
notifies you when its time is up.

If you turned on reminders in the web app, turn them off there (or ignore the
web ones) so you don't get both.

## Run it

You need a Mac with Xcode 16 or later.

1. **Register the app in Firebase.** In the Firebase console for the dots
   project: Project settings → Your apps → Add app → iOS, bundle ID
   `com.javianng.dots`. Download `GoogleService-Info.plist` and put it in
   `ios/App/` (it's git-ignored).
2. **Google sign-in (optional).** Enable Google as a sign-in provider if it
   isn't already. Copy `ios/Config/Firebase.example.xcconfig` to
   `ios/Config/Firebase.xcconfig` and set `REVERSED_CLIENT_ID` to the value in
   your `GoogleService-Info.plist`. Email and password sign-in works without
   this step.
3. **Generate the project and run.**

   ```sh
   brew install xcodegen
   cd ios
   xcodegen generate
   open Dots.xcodeproj
   ```

   Pick an iPhone simulator or your phone and press Run. For your phone, set
   your team under Signing & Capabilities.

Run the core tests without Xcode's UI:

```sh
swift test --package-path ios/Packages/DotsCore
```

The GitHub Actions workflow `.github/workflows/ios.yml` runs those tests and
builds the app for the simulator on every push that touches `ios/`.

## Layout

```
project.yml              XcodeGen spec; Dots.xcodeproj is generated, not committed
Config/                  Build settings; Firebase.xcconfig (yours) is git-ignored
App/                     SwiftUI app
  DotsApp.swift          Entry point, notification delegate
  Stores/                AuthStore, HabitStore (Firestore), Reminders, Connectivity
  Views/                 Screens: Today, habit page, form, settings, life in weeks
  Support/               Theme (Kinari & Sumi), Firebase setup
Packages/DotsCore/       Pure Swift logic with tests: models, schedules, streaks,
                         check-in rules, parsing, form rules, reminder planning
```

## Keeping it in step with the web app

DotsCore is a port of the web app's rules. When one of these changes on the
web, change its Swift twin too:

| Web | Swift |
| --- | --- |
| `lib/types.ts` | `Models.swift` |
| `lib/schedule.ts` | `ScheduleRules.swift`, `Labels.swift` |
| `lib/check-in.ts`, `lib/habits.ts` | `CheckIn.swift`, `HabitStore.apply` |
| `hooks/use-habits.tsx` | `Parse.swift` |
| `components/habit-form.tsx` | `HabitForm.swift` |
| `lib/palette.ts`, `lib/habit-icons.ts`, `lib/templates.ts` | `Palette.swift` |
| `lib/life.ts` | `Life.swift` |

The schedule tests were recorded by running `lib/schedule.ts` on the same
habits, so a mismatch shows up as a failing test.

## Before the App Store

- Apple requires Sign in with Apple in apps that offer Google sign-in. Add it
  (Firebase supports it) before submitting.
- Icons: dots stores lucide icon names; the phone shows the closest SF Symbol.
- Fonts: the app uses the system font (SF Pro) rather than Inter, which reads
  as native on iPhone. Bundle Inter and Noto Sans SC if you want an exact match.
