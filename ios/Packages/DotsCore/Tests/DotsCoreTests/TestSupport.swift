import Foundation
@testable import DotsCore

/// Tests run in Singapore time on a fixed "now" (Thursday 19 Nov 2026, 10:00),
/// the same setup used to record the web app's expected values.
enum Fixture {
    static let math: DayMath = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Asia/Singapore")!
        calendar.locale = Locale(identifier: "en_US_POSIX")
        return DayMath(calendar: calendar)
    }()

    static let en = Locale(identifier: "en_US")

    static func date(_ key: String, _ hour: Int = 0, _ minute: Int = 0) -> Date {
        math.at(math.date(key)!, minutes: hour * 60 + minute)
    }

    static let now = date("2026-11-19", 10)

    static func done(_ keys: [String]) -> [String: Bool] {
        Dictionary(uniqueKeysWithValues: keys.map { ($0, true) })
    }

    static func habit(
        schedule: Schedule = .daily,
        goalType: GoalType = .count,
        done keys: [String] = [],
        skipped: [String] = [],
        counts: [String: Double] = [:],
        configure: (inout Habit) -> Void = { _ in }
    ) -> Habit {
        var habit = Habit(
            id: "x",
            name: "X",
            goalType: goalType,
            schedule: schedule,
            createdAt: date("2026-01-01"),
            history: done(keys),
            counts: counts,
            skipped: Set(skipped)
        )
        configure(&habit)
        return habit
    }

    /// Typed so heterogeneous literals compile where `Any?` is expected.
    static func dict(_ d: [String: Any]) -> [String: Any] { d }
}
