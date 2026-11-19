import Foundation

/// The New / Edit Habit form's state and rules, ported from
/// components/habit-form.tsx. Numbers the user types stay strings until saved.
public struct HabitForm: Equatable, Sendable {
    public enum Repeat: String, CaseIterable, Sendable {
        case daily, days, week, month, interval

        public var label: String {
            switch self {
            case .daily: "Every day"
            case .days: "Days of the week"
            case .week: "Times a week"
            case .month: "Times a month"
            case .interval: "Every few days"
            }
        }
    }

    public var name: String
    public var description: String
    public var icon: String
    public var colorHex: String
    public var streakGoal: String
    public private(set) var goalType: GoalType
    public var completionsPerDay: Int
    public var durationMinutes: Int
    public var amountTarget: String
    public var amountUnit: String
    public var amountStep: String
    public var repeatKind: Repeat
    public var days: [Int]
    public var times: Int
    public var every: Int
    public private(set) var parts: [DayPart]

    public init(_ d: HabitDraft = HabitDraft()) {
        name = d.name
        description = d.description
        icon = d.icon
        colorHex = d.colorHex
        streakGoal = d.streakGoal.map(String.init) ?? ""
        goalType = d.goalType
        completionsPerDay = d.completionsPerDay
        durationMinutes = d.durationMinutes
        amountTarget = HabitForm.text(d.amountTarget)
        amountUnit = d.amountUnit
        amountStep = HabitForm.text(d.amountStep)
        parts = d.parts
        switch d.schedule {
        case .daily: repeatKind = .daily
        case .days: repeatKind = .days
        case .period(let period, _): repeatKind = period == .week ? .week : .month
        case .interval: repeatKind = .interval
        }
        if case .days(let list) = d.schedule { days = list } else { days = [1, 3, 5] }
        if case .period(_, let n) = d.schedule { times = n } else { times = 3 }
        if case .interval(let n) = d.schedule { every = n } else { every = 3 }
    }

    static func text(_ n: Double) -> String {
        n == n.rounded() && abs(n) < 1e15 ? String(Int(n)) : String(n)
    }

    /// A number as typed, accepting "," as the decimal mark too.
    static func number(_ s: String) -> Double? {
        let trimmed = s.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: ",", with: ".")
        guard !trimmed.isEmpty, let n = Double(trimmed), n.isFinite else { return nil }
        return n
    }

    public var schedule: Schedule {
        switch repeatKind {
        case .days:
            return days.isEmpty || days.count == 7 ? .daily : .days(days.sorted())
        case .week:
            return .period(.week, times: min(times, Limits.maxTimes[.week] ?? times))
        case .month:
            return .period(.month, times: min(times, Limits.maxTimes[.month] ?? times))
        case .interval:
            return .interval(every: every)
        case .daily:
            return .daily
        }
    }

    public var draft: HabitDraft {
        let goal = Int(streakGoal.trimmingCharacters(in: .whitespaces))
        let target = HabitForm.number(amountTarget)
        let step = HabitForm.number(amountStep)
        let multiSlot = goalType == .count && parts.count > 1
        return HabitDraft(
            name: name.trimmingCharacters(in: .whitespacesAndNewlines),
            description: description.trimmingCharacters(in: .whitespacesAndNewlines),
            icon: icon,
            colorHex: colorHex,
            streakGoal: (goal ?? 0) > 0 ? goal : nil,
            goalType: goalType,
            // One check per time of day when several are picked.
            completionsPerDay: multiSlot ? parts.count : completionsPerDay,
            durationMinutes: durationMinutes,
            amountTarget: target.map { max(0, $0) } ?? 1,
            amountUnit: amountUnit.trimmingCharacters(in: .whitespaces),
            amountStep: step.flatMap { $0 > 0 ? $0 : nil } ?? 1,
            schedule: schedule,
            parts: goalType == .count ? parts : Array(parts.prefix(1))
        )
    }

    /// Why the form can't be saved yet, if anything.
    public var problem: String? {
        if name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return "Give it a name." }
        if repeatKind == .days && days.isEmpty { return "Pick at least one day." }
        let target = HabitForm.number(amountTarget)
        let step = HabitForm.number(amountStep)
        if goalType == .amount && !((target ?? 0) > 0) { return "Set a daily target above 0." }
        if goalType == .limit && !((target ?? -1) >= 0) { return "Set a limit (0 or more)." }
        if (goalType == .amount || goalType == .limit) && !((step ?? 0) > 0) { return "Each tap needs to add more than 0." }
        return nil
    }

    /// Only check-off habits can repeat through the day; others pick one time.
    public mutating func togglePart(_ part: DayPart) {
        let on = parts.contains(part)
        if goalType != .count {
            parts = on ? [] : [part]
            return
        }
        let next = on ? parts.filter { $0 != part } : parts + [part]
        parts = DayPart.allCases.filter { next.contains($0) }
    }

    public mutating func toggleDay(_ day: Int) {
        if days.contains(day) { days.removeAll { $0 == day } } else { days.append(day) }
    }

    public mutating func changeGoalType(_ type: GoalType) {
        // Sensible starting points so the row never opens empty.
        if type == .limit && goalType != .limit { amountTarget = "2" }
        if type == .amount && goalType != .amount { amountTarget = "10" }
        if type != .count { parts = Array(parts.prefix(1)) }
        goalType = type
    }

    public var canDecreaseDuration: Bool { durationMinutes > (Limits.durationSteps.first ?? 1) }
    public var canIncreaseDuration: Bool { durationMinutes < (Limits.durationSteps.last ?? 240) }

    public mutating func shorter() {
        durationMinutes = Limits.durationSteps.last { $0 < durationMinutes } ?? durationMinutes
    }

    public mutating func longer() {
        durationMinutes = Limits.durationSteps.first { $0 > durationMinutes } ?? durationMinutes
    }

    /// Footer under the Goal section.
    public var goalFooter: String {
        let d = draft
        switch d.goalType {
        case .time:
            return "Tap play to count down \(Labels.minutes(d.durationMinutes)). Pause any time; the day is done when the timer runs out."
        case .amount:
            return "Each tap adds \(Labels.withUnit(d.amountStep, d.amountUnit)). The day is done at \(Labels.withUnit(d.amountTarget, d.amountUnit))."
        case .limit:
            return d.amountTarget == 0
                ? "Tap when it happens. A day with nothing logged is a kept day."
                : "Tap when it happens. Days at or under \(Labels.withUnit(d.amountTarget, d.amountUnit)) count as kept."
        case .count:
            if d.parts.count > 1 { return "One check for each: \(Labels.parts(d.parts).lowercased())." }
            return d.completionsPerDay == 1 ? "One tap marks the day done." : "Tap \(d.completionsPerDay) times to finish the day."
        }
    }

    /// Footer under the When section.
    public var whenFooter: String {
        if repeatKind == .days && days.isEmpty { return "Pick at least one day." }
        let d = draft
        let repeatText: String
        switch d.schedule {
        case .daily: repeatText = "Every day."
        case .days: repeatText = "\(d.schedule.label). Other days are rest days."
        case .interval(let every): repeatText = "Every \(every) days, counted from the last time you did it."
        case .period(let period, let times): repeatText = "Any \(times) \(times == 1 ? "day" : "days") a \(period.rawValue)."
        }
        let timeText: String
        if d.parts.isEmpty {
            timeText = "No time of day: shows under Any time."
        } else if d.goalType == .count && d.parts.count > 1 {
            timeText = "A separate check for each time of day."
        } else {
            timeText = "Shows in your \(Labels.parts(d.parts).lowercased()) list."
        }
        return "\(repeatText) \(timeText)"
    }
}
