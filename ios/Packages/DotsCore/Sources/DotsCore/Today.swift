import Foundation

/// The main screen's grouping, ported from components/main-screen.tsx.
public enum Today {
    public struct Item: Identifiable, Equatable, Sendable {
        public var habit: Habit
        /// For habits checked off once per time of day: which check this row shows.
        public var part: DayPart?
        public var id: String { habit.id }
    }

    public struct Section: Identifiable, Equatable, Sendable {
        public var key: String
        public var label: String?
        public var isNow: Bool
        public var items: [Item]
        public var id: String { key }
    }

    /// Groups today's habits by time of day (Morning / Afternoon / Evening /
    /// Any time). With no times of day set anywhere there's one unlabelled
    /// section. A habit done several times a day shows once, under the time of
    /// day it's waiting on next, and moves along as each check is done.
    public static func sections(_ habits: [Habit], now: Date = Date(), math: DayMath = .current) -> [Section] {
        guard habits.contains(where: { !$0.parts.isEmpty }) else {
            return [Section(key: "all", label: nil, isNow: false, items: habits.map { Item(habit: $0, part: nil) })]
        }
        let current = DayPart.current(now, math: math)
        let today = math.key(now)
        var buckets: [String: [Item]] = [:]
        for habit in habits {
            var part = habit.parts.first
            let slots = CheckIn.usesSlots(habit)
            if slots {
                let done = Set(habit.slots[today] ?? [])
                part = habit.parts.contains(current) && !done.contains(current)
                    ? current
                    : (habit.parts.first { !done.contains($0) } ?? habit.parts.last)
            }
            let key = part?.rawValue ?? "any"
            buckets[key, default: []].append(Item(habit: habit, part: slots ? part : nil))
        }
        return (DayPart.allCases.map(\.rawValue) + ["any"]).compactMap { key in
            guard let items = buckets[key] else { return nil }
            let part = DayPart(rawValue: key)
            return Section(key: key, label: part?.label ?? "Any time", isNow: part == current, items: items)
        }
    }

    /// (done, total) for today's progress ring. Rest days sit out.
    public static func summary(_ habits: [Habit], now: Date = Date(), math: DayMath = .current) -> (done: Int, total: Int) {
        let statuses = habits.map { Rules.todayStatus($0, now: now, math: math) }
        return (statuses.filter { $0 == .done }.count, statuses.filter { $0 != .rest }.count)
    }
}
