import Foundation

// Port of lib/schedule.ts: schedules, times of day, and the goal-aware helpers
// built on them (daily target, today's status, streaks).

public enum Limits {
    public static let maxTimes: [Period: Int] = [.week: 6, .month: 27]
    public static let maxInterval = 60
    /// Keeps the ring readable and the stepper sane.
    public static let maxDailyTarget = 20
    /// Stops the minutes stepper walks through (fine-grained when short).
    public static let durationSteps = [1, 2, 3, 5, 10, 15, 20, 25, 30, 40, 45, 60, 75, 90, 120, 150, 180, 240]
}

/// Monday-first, for pickers. Values are JS `getDay()` numbers.
public struct Weekday: Sendable, Identifiable {
    public let value: Int
    public let short: String
    public let long: String
    public var id: Int { value }

    public static let all: [Weekday] = [
        Weekday(value: 1, short: "M", long: "Mon"),
        Weekday(value: 2, short: "T", long: "Tue"),
        Weekday(value: 3, short: "W", long: "Wed"),
        Weekday(value: 4, short: "T", long: "Thu"),
        Weekday(value: 5, short: "F", long: "Fri"),
        Weekday(value: 6, short: "S", long: "Sat"),
        Weekday(value: 0, short: "S", long: "Sun"),
    ]
}

public enum DayStatus: String, Sendable {
    case done, due, rest, skipped
}

public enum StreakUnit: String, Sendable {
    case day, week, month, time
}

public extension DayPart {
    /// Which part of the day `now` falls in (morning < 12:00 ≤ afternoon < 17:00 ≤ evening).
    static func current(_ now: Date = Date(), math: DayMath = .current) -> DayPart {
        let h = math.hour(now)
        return DayPart.allCases.first { h < $0.until } ?? .evening
    }
}

public extension GoalFields {
    /// The day's number: taps (count), seconds (time), units (amount). For
    /// limit goals it's the maximum allowed.
    var dayTarget: Double {
        switch goalType {
        case .time: Double(durationMinutes * 60)
        case .amount, .limit: amountTarget
        case .count: Double(completionsPerDay)
        }
    }

    /// Whether `count` meets the day's goal (limit goals: stays at or under the limit).
    func isDayMet(_ count: Double) -> Bool {
        goalType == .limit ? count <= dayTarget : count >= dayTarget
    }
}

public extension Schedule {
    /// Fixed-weekday schedules only happen on their days; everything else can happen any day.
    func isScheduledDay(_ date: Date, math: DayMath = .current) -> Bool {
        if case .days(let days) = self { return days.contains(math.weekday(date)) }
        return true
    }

    var streakUnit: StreakUnit {
        switch self {
        case .period(let period, _): period == .week ? .week : .month
        case .interval: .time
        default: .day
        }
    }

    /// Short human description: "Every day", "Mon, Wed, Fri", "3× a week", "Every 3 days".
    var label: String {
        switch self {
        case .daily:
            return "Every day"
        case .period(let period, let times):
            return "\(times)× a \(period.rawValue)"
        case .interval(let every):
            return "Every \(every) days"
        case .days(let days):
            let set = Set(days)
            if set == [1, 2, 3, 4, 5] { return "Weekdays" }
            if set == [0, 6] { return "Weekends" }
            return Weekday.all.filter { set.contains($0.value) }.map(\.long).joined(separator: ", ")
        }
    }
}

public enum Rules {
    /// Days that count towards the quota in the period containing `date`, up
    /// to and including `until`. Skipped days are excused, so they count too.
    public static func periodDoneCount(
        _ habit: some HistoryFields,
        _ date: Date,
        _ period: Period,
        until: Date? = nil,
        math: DayMath = .current
    ) -> Int {
        let start = math.periodStart(date, period)
        let endKey = math.key(until ?? date)
        let stopKey = math.key(math.nextPeriodStart(start, period))
        var done = 0
        var day = start
        while true {
            let key = math.key(day)
            if key > endKey || key >= stopKey { break }
            if habit.history[key] == true || habit.skipped.contains(key) { done += 1 }
            day = math.addDays(day, 1)
        }
        return done
    }

    /// Done or skipped days up to `now`, newest first (interval anchors).
    static func anchorsDesc(_ habit: some HistoryFields, _ now: Date, math: DayMath) -> [String] {
        let today = math.key(now)
        var keys = Set<String>()
        for (key, done) in habit.history where done && key <= today { keys.insert(key) }
        for key in habit.skipped where key <= today { keys.insert(key) }
        return keys.sorted(by: >)
    }

    /// Days until an every-N-days habit is due (0 = due today or overdue).
    public static func daysUntilDue(_ habit: some HistoryFields, now: Date = Date(), math: DayMath = .current) -> Int {
        guard case .interval(let every) = habit.schedule,
              let last = anchorsDesc(habit, now, math: math).first
        else { return 0 }
        return max(0, every - math.daysBetween(last, now))
    }

    /// Today, for this habit:
    /// - done: logged today, a weekly/monthly quota already met.
    /// - skipped: marked as skipped for today.
    /// - rest: not scheduled today (fixed weekdays, or every-N-days not yet due).
    /// - due: everything else.
    public static func todayStatus(_ habit: some HistoryFields, now: Date = Date(), math: DayMath = .current) -> DayStatus {
        let today = math.key(now)
        if habit.skipped.contains(today) { return .skipped }
        if habit.history[today] == true { return .done }
        switch habit.schedule {
        case .days:
            return habit.schedule.isScheduledDay(now, math: math) ? .due : .rest
        case .period(let period, let times):
            return periodDoneCount(habit, now, period, math: math) >= times ? .done : .due
        case .interval:
            return daysUntilDue(habit, now: now, math: math) > 0 ? .rest : .due
        case .daily:
            return .due
        }
    }

    /// Earliest logged day, so streak walks know when to stop.
    static func earliestKey(_ habit: some HistoryFields) -> String? {
        habit.history.filter { $0.value }.keys.min()
    }

    /// The current streak in the schedule's own unit.
    /// - daily: consecutive completed days.
    /// - days: consecutive completed *scheduled* days; rest days neither count nor break it.
    /// - period: consecutive weeks/months that met the quota.
    /// - interval: completions in a row, each within N days of the one before.
    /// Skipped days are treated like rest days everywhere. Today (or this
    /// week/month) only counts once done, and never breaks the run before it's over.
    public static func streak(
        _ habit: some HistoryFields,
        now: Date = Date(),
        math: DayMath = .current
    ) -> (value: Int, unit: StreakUnit) {
        let unit = habit.schedule.streakUnit
        guard let first = earliestKey(habit) else { return (0, unit) }

        switch habit.schedule {
        case .period(let period, let times):
            var start = math.periodStart(now, period)
            var value = 0
            if periodDoneCount(habit, start, period, until: now, math: math) >= times { value = 1 }
            while true {
                start = math.periodStart(math.addDays(start, -1), period)
                if math.key(math.nextPeriodStart(start, period)) <= first { break }
                let end = math.addDays(math.nextPeriodStart(start, period), -1)
                if periodDoneCount(habit, start, period, until: end, math: math) < times { break }
                value += 1
            }
            return (value, unit)

        case .interval(let every):
            let anchors = anchorsDesc(habit, now, math: math)
            guard let newest = anchors.first, math.daysBetween(newest, now) <= every else { return (0, unit) }
            var value = 0
            for i in anchors.indices {
                if habit.history[anchors[i]] == true { value += 1 }
                guard i + 1 < anchors.count, let current = math.date(anchors[i]) else { break }
                if math.daysBetween(anchors[i + 1], current) > every { break }
            }
            return (value, unit)

        case .daily, .days:
            var cursor = math.startOfDay(now)
            var value = 0
            // Today can't break a streak before it's logged.
            if habit.history[math.key(cursor)] != true { cursor = math.addDays(cursor, -1) }
            while math.key(cursor) >= first {
                let key = math.key(cursor)
                let scheduled = habit.schedule.isScheduledDay(cursor, math: math) && !habit.skipped.contains(key)
                if habit.history[key] == true {
                    if scheduled { value += 1 }
                } else if scheduled {
                    break
                }
                cursor = math.addDays(cursor, -1)
            }
            return (value, unit)
        }
    }

    /// Reads a stored schedule defensively: anything malformed falls back to daily.
    public static func parseSchedule(_ raw: Any?) -> Schedule {
        guard let s = raw as? [String: Any], let type = s["type"] as? String else { return .daily }
        switch type {
        case "days":
            guard let list = s["days"] as? [Any] else { return .daily }
            let days = Set(list.compactMap { Parse.number($0) }
                .filter { $0 == $0.rounded() && $0 >= 0 && $0 <= 6 }
                .map { Int($0) })
            return days.isEmpty || days.count == 7 ? .daily : .days(days.sorted())
        case "period":
            guard let raw = s["period"] as? String, let period = Period(rawValue: raw),
                  let n = Parse.number(s["times"]) else { return .daily }
            let times = Int(n.rounded())
            return times >= 1 ? .period(period, times: min(times, Limits.maxTimes[period] ?? times)) : .daily
        case "interval":
            guard let n = Parse.number(s["every"]) else { return .daily }
            let every = Int(n.rounded())
            return every >= 2 ? .interval(every: min(every, Limits.maxInterval)) : .daily
        default:
            return .daily
        }
    }

    public static func parseGoalType(_ raw: Any?) -> GoalType {
        guard let s = raw as? String, let type = GoalType(rawValue: s) else { return .count }
        return type
    }

    /// Known times of day in canonical order (morning, afternoon, evening).
    public static func parseParts(_ raw: Any?) -> [DayPart] {
        guard let list = raw as? [Any] else { return [] }
        let names = Set(list.compactMap { $0 as? String })
        return DayPart.allCases.filter { names.contains($0.rawValue) }
    }
}

public extension Habit {
    var todayStatus: DayStatus { Rules.todayStatus(self) }
    var streak: (value: Int, unit: StreakUnit) { Rules.streak(self) }
}
