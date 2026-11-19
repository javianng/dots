import Foundation

// The short texts shown in the UI, ported from lib/schedule.ts, lib/check-in.ts
// and components/celebrate-toast.tsx so both apps word things the same way.

public enum Labels {
    /// "1,500", "2.5".
    public static func amount(_ n: Double, locale: Locale = .current) -> String {
        let formatter = NumberFormatter()
        formatter.locale = locale
        formatter.numberStyle = .decimal
        formatter.maximumFractionDigits = 2
        formatter.minimumFractionDigits = 0
        return formatter.string(from: NSNumber(value: n)) ?? String(n)
    }

    /// "250 ml", "3 pages", "2".
    public static func withUnit(_ n: Double, _ unit: String, locale: Locale = .current) -> String {
        unit.isEmpty ? amount(n, locale: locale) : "\(amount(n, locale: locale)) \(unit)"
    }

    /// "25:00", "1:05:30".
    public static func clock(_ totalSeconds: Double) -> String {
        let s = max(0, Int(totalSeconds.rounded()))
        let h = s / 3600
        let m = (s % 3600) / 60
        let sec = String(format: "%02d", s % 60)
        return h > 0 ? "\(h):\(String(format: "%02d", m)):\(sec)" : "\(m):\(sec)"
    }

    /// "25 min", "1 h 30 min".
    public static func minutes(_ minutes: Int) -> String {
        let h = minutes / 60
        let m = minutes % 60
        if h == 0 { return "\(m) min" }
        return m == 0 ? "\(h) h" : "\(h) h \(m) min"
    }

    /// "3 days", "1 week".
    public static func plural(_ n: Int, _ unit: String) -> String {
        "\(n) \(unit)\(n == 1 ? "" : "s")"
    }

    /// "3-day streak", "4 in a row".
    public static func streakPhrase(_ value: Int, _ unit: StreakUnit) -> String {
        unit == .time ? "\(value) in a row" : "\(value)-\(unit.rawValue) streak"
    }

    /// "Morning & evening", "Evening", "Any time".
    public static func parts(_ parts: [DayPart]) -> String {
        let labels = parts.map(\.label)
        guard let last = labels.last else { return "Any time" }
        let text = labels.count == 1
            ? last
            : "\(labels.dropLast().joined(separator: ", ")) & \(last.lowercased())"
        return String(text.prefix(1)) + text.dropFirst().lowercased()
    }

    /// What a day asks for: "Check off", "3× a day", "2,000 ml", "25 min", "At most 2 coffees".
    public static func goal(_ habit: some GoalFields & PartsFields, locale: Locale = .current) -> String {
        switch habit.goalType {
        case .time:
            return minutes(habit.durationMinutes)
        case .amount:
            return withUnit(habit.amountTarget, habit.amountUnit, locale: locale)
        case .limit:
            if habit.amountTarget == 0 { return habit.amountUnit.isEmpty ? "None" : "No \(habit.amountUnit)" }
            return "At most \(withUnit(habit.amountTarget, habit.amountUnit, locale: locale))"
        case .count:
            if habit.parts.count > 1 { return "Once each time" }
            return habit.completionsPerDay > 1 ? "\(habit.completionsPerDay)× a day" : "Check off"
        }
    }

    /// Status line under a habit name.
    public static func progress(_ habit: Habit, now: Date = Date(), math: DayMath = .current, locale: Locale = .current) -> String {
        let today = math.key(now)
        let (value, unit) = Rules.streak(habit, now: now, math: math)
        let streak = value > 0 ? streakPhrase(value, unit) : nil
        func join(_ parts: String?...) -> String { parts.compactMap { $0 }.joined(separator: " · ") }
        let status = Rules.todayStatus(habit, now: now, math: math)

        if status == .skipped { return join("Skipped today", streak) }
        if habit.goalType == .limit {
            let logged = habit.counts[today] ?? 0
            let left = habit.amountTarget - logged
            let text = left < 0 ? "Over today"
                : left == 0 ? "At your limit"
                : "\(withUnit(left, habit.amountUnit, locale: locale)) left today"
            return join(text, streak)
        }
        if case .period(let period, let times) = habit.schedule {
            let done = Rules.periodDoneCount(habit, now, period, math: math)
            return join("\(min(done, times))/\(times) this \(period.rawValue)", streak)
        }
        if case .interval = habit.schedule, status == .rest {
            let days = Rules.daysUntilDue(habit, now: now, math: math)
            return join(days == 1 ? "Due tomorrow" : "Next in \(days) days", streak)
        }
        if status == .rest { return join("Rest day", streak) }
        if let streak { return streak }
        return habit.history.values.contains(true) ? "No current streak" : "Not started"
    }

    /// The "done" toast for a day that was just finished. `habit` is the habit
    /// before the tap.
    public static func celebration(_ habit: Habit, dateKey: String, now: Date = Date(), math: DayMath = .current) -> (title: String, subtitle: String, goalReached: Bool) {
        var after = habit
        after.history[dateKey] = true
        let (streak, unit) = Rules.streak(after, now: now, math: math)
        let goalReached = (habit.streakGoal ?? 0) > 0 && streak == habit.streakGoal
        if goalReached { return ("Goal reached!", habit.name, true) }
        let subtitle: String
        if dateKey != math.key(now) {
            subtitle = "Marked as done"
        } else if streak > 1 {
            subtitle = "Done for today · \(streakPhrase(streak, unit))"
        } else {
            subtitle = "Done for today"
        }
        return (habit.name, subtitle, false)
    }

    /// "750", "1.5k": fits inside a small ring.
    public static func compact(_ n: Double) -> String {
        if n >= 10_000 { return "\(Int((n / 1000).rounded()))k" }
        if n >= 1000 { return "\(amount((n / 100).rounded() / 10, locale: Locale(identifier: "en_US_POSIX")))k" }
        return amount((n * 10).rounded() / 10, locale: Locale(identifier: "en_US_POSIX"))
    }
}

/// Times of day, for goal labels.
public protocol PartsFields {
    var parts: [DayPart] { get }
}

extension Habit: PartsFields {}
extension HabitDraft: PartsFields {}
