import Foundation

/// Plans the phone's local reminder notifications. Unlike the web app's push
/// reminders (sent by a scheduled job that can run late), these are scheduled
/// on the phone itself, so they fire on time, offline too.
///
/// The phone can't run code at the moment a notification fires, so the app
/// plans the next week of notifications whenever habits change: today's text
/// counts what's actually left, a day with nothing left gets no notification,
/// and later days count what will be due if nothing more is logged.
/// Wording mirrors scripts/reminders/send-reminders.mjs.
public enum ReminderPlanner {
    public struct Settings: Equatable, Sendable {
        public var enabled: Bool
        /// Minutes since midnight.
        public var time: Int
        public var morningEnabled: Bool
        /// Minutes since midnight. Only used before noon.
        public var morningTime: Int

        public init(enabled: Bool, time: Int = 20 * 60, morningEnabled: Bool = false, morningTime: Int = 7 * 60 + 30) {
            self.enabled = enabled
            self.time = time
            self.morningEnabled = morningEnabled
            self.morningTime = morningTime
        }
    }

    public struct Planned: Equatable, Sendable {
        public var id: String
        public var fireDate: Date
        public var title: String
        public var body: String
    }

    public static let idPrefix = "dots-reminder-"

    public static func reminderMessage(remaining: Int, total: Int) -> String {
        if total == remaining {
            return remaining == 1
                ? "Your habit is still waiting for today's dot."
                : "None of your \(remaining) habits are done yet today."
        }
        return remaining == 1 ? "One habit left to fill in today." : "\(remaining) habits left to fill in today."
    }

    public static func morningMessage(remaining: Int) -> String {
        remaining == 1 ? "One morning habit to fill in." : "\(remaining) morning habits to fill in."
    }

    /// (remaining, total) at `moment`: limits never nag; rest days sit out;
    /// skipped days count as handled.
    static func count(_ habits: [Habit], at moment: Date, morningOnly: Bool, math: DayMath) -> (remaining: Int, total: Int) {
        var remaining = 0
        var total = 0
        let key = math.key(moment)
        for habit in habits where habit.goalType != .limit {
            if morningOnly {
                guard habit.parts.contains(.morning) else { continue }
                if (habit.slots[key] ?? []).contains(.morning) { total += 1; continue }
            }
            switch Rules.todayStatus(habit, now: moment, math: math) {
            case .rest: continue
            case .done, .skipped: total += 1
            case .due: total += 1; remaining += 1
            }
        }
        return (remaining, total)
    }

    public static func plan(
        habits: [Habit],
        settings: Settings,
        now: Date = Date(),
        days: Int = 7,
        math: DayMath = .current
    ) -> [Planned] {
        guard settings.enabled else { return [] }
        var planned: [Planned] = []
        for offset in 0..<days {
            let day = math.addDays(math.startOfDay(now), offset)
            let key = math.key(day)

            if settings.morningEnabled, settings.morningTime < 12 * 60 {
                let fire = math.at(day, minutes: settings.morningTime)
                if fire > now {
                    let (remaining, _) = count(habits, at: fire, morningOnly: true, math: math)
                    if remaining > 0 {
                        planned.append(Planned(id: "\(idPrefix)morning-\(key)", fireDate: fire, title: "dots", body: morningMessage(remaining: remaining)))
                    }
                }
            }

            let fire = math.at(day, minutes: settings.time)
            if fire > now {
                let (remaining, total) = count(habits, at: fire, morningOnly: false, math: math)
                if remaining > 0 {
                    planned.append(Planned(id: "\(idPrefix)daily-\(key)", fireDate: fire, title: "dots", body: reminderMessage(remaining: remaining, total: total)))
                }
            }
        }
        return planned
    }
}
