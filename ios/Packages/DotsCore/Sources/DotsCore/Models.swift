import Foundation

// Mirrors lib/types.ts in the web app. The Firestore documents are shared with
// the web app, the MCP server and the reminders sender, so field names and
// meanings must stay identical.

/// How often a habit is meant to happen.
/// - daily: every day.
/// - days: on fixed weekdays only (0 = Sunday … 6 = Saturday, like JS `getDay()`).
/// - period: any `times` days within each week (Mon–Sun) or calendar month.
/// - interval: once every `every` days, counted from the last time it was done.
public enum Schedule: Equatable, Hashable, Sendable {
    case daily
    case days([Int])
    case period(Period, times: Int)
    case interval(every: Int)
}

public enum Period: String, Equatable, Hashable, Sendable, CaseIterable {
    case week, month
}

/// What finishes a day.
/// - count: `completionsPerDay` taps (one per time of day when several are set).
/// - amount: reach `amountTarget` of `amountUnit`; each tap adds `amountStep`.
/// - time: `durationMinutes` of focused time, logged with a play/pause countdown.
/// - limit: stay at or under `amountTarget` (each tap logs `amountStep`).
public enum GoalType: String, Equatable, Hashable, Sendable, CaseIterable {
    case count, amount, time, limit
}

public enum DayPart: String, Equatable, Hashable, Sendable, CaseIterable, Comparable {
    case morning, afternoon, evening

    public var label: String {
        switch self {
        case .morning: "Morning"
        case .afternoon: "Afternoon"
        case .evening: "Evening"
        }
    }

    /// The hour (exclusive) this part of the day runs until.
    public var until: Int {
        switch self {
        case .morning: 12
        case .afternoon: 17
        case .evening: 24
        }
    }

    private var order: Int { DayPart.allCases.firstIndex(of: self) ?? 0 }

    public static func < (lhs: DayPart, rhs: DayPart) -> Bool { lhs.order < rhs.order }
}

/// A running countdown: when it was (re)started (ms since 1970) and which day it logs to.
public struct RunningTimer: Equatable, Hashable, Sendable {
    public var startedAt: Double
    public var dateKey: String

    public init(startedAt: Double, dateKey: String) {
        self.startedAt = startedAt
        self.dateKey = dateKey
    }
}

/// The fields shared by every goal calculation.
public protocol GoalFields {
    var goalType: GoalType { get }
    var completionsPerDay: Int { get }
    var durationMinutes: Int { get }
    var amountTarget: Double { get }
}

/// The fields streak and status calculations need.
public protocol HistoryFields {
    var history: [String: Bool] { get }
    var skipped: Set<String> { get }
    var schedule: Schedule { get }
}

/// Everything the New / Edit Habit form saves.
public struct HabitDraft: Equatable, Sendable, GoalFields {
    public var name: String
    public var description: String
    public var icon: String
    public var colorHex: String
    public var streakGoal: Int?
    public var goalType: GoalType
    /// Taps needed to finish a day. 1 = a simple check-off.
    public var completionsPerDay: Int
    /// Minutes needed to finish a day (time goals).
    public var durationMinutes: Int
    /// Amount goals: the daily target. Limit goals: the daily maximum (may be 0).
    public var amountTarget: Double
    /// "ml", "pages", "coffees"… empty for plain counts.
    public var amountUnit: String
    /// How much one quick tap logs.
    public var amountStep: Double
    public var schedule: Schedule
    /// When in the day it happens; empty = any time.
    public var parts: [DayPart]

    public init(
        name: String = "",
        description: String = "",
        icon: String = HabitIcons.defaultKey,
        colorHex: String = Palette.defaultHex,
        streakGoal: Int? = nil,
        goalType: GoalType = .count,
        completionsPerDay: Int = 1,
        durationMinutes: Int = 15,
        amountTarget: Double = 1,
        amountUnit: String = "",
        amountStep: Double = 1,
        schedule: Schedule = .daily,
        parts: [DayPart] = []
    ) {
        self.name = name
        self.description = description
        self.icon = icon
        self.colorHex = colorHex
        self.streakGoal = streakGoal
        self.goalType = goalType
        self.completionsPerDay = completionsPerDay
        self.durationMinutes = durationMinutes
        self.amountTarget = amountTarget
        self.amountUnit = amountUnit
        self.amountStep = amountStep
        self.schedule = schedule
        self.parts = parts
    }
}

/// A habit with its logged days merged in (see `HabitParser.habit`).
public struct Habit: Identifiable, Equatable, Sendable, GoalFields, HistoryFields {
    public var id: String
    public var name: String
    public var description: String
    /// nil for habits saved before icons existed; see `HabitIcons.resolve`.
    public var icon: String?
    public var colorHex: String
    public var streakGoal: Int?
    public var goalType: GoalType
    public var completionsPerDay: Int
    public var durationMinutes: Int
    public var amountTarget: Double
    public var amountUnit: String
    public var amountStep: Double
    public var schedule: Schedule
    public var parts: [DayPart]
    /// Set while the countdown is playing; nil when paused or idle.
    public var timer: RunningTimer?
    public var createdAt: Date
    /// 'YYYY-MM-DD' → the day's goal is met (limit goals: kept under the limit).
    public var history: [String: Bool]
    /// 'YYYY-MM-DD' → amount logged that day (only days with some): taps for
    /// count goals, seconds for time goals, units for amount and limit goals.
    public var counts: [String: Double]
    /// Days marked as skipped (sick, travelling): they neither count nor break streaks.
    public var skipped: Set<String>
    /// Times of day ticked off, for check-off habits with several times of day.
    public var slots: [String: [DayPart]]

    public init(
        id: String,
        name: String,
        description: String = "",
        icon: String? = nil,
        colorHex: String = Palette.defaultHex,
        streakGoal: Int? = nil,
        goalType: GoalType = .count,
        completionsPerDay: Int = 1,
        durationMinutes: Int = 15,
        amountTarget: Double = 1,
        amountUnit: String = "",
        amountStep: Double = 1,
        schedule: Schedule = .daily,
        parts: [DayPart] = [],
        timer: RunningTimer? = nil,
        createdAt: Date = Date(),
        history: [String: Bool] = [:],
        counts: [String: Double] = [:],
        skipped: Set<String> = [],
        slots: [String: [DayPart]] = [:]
    ) {
        self.id = id
        self.name = name
        self.description = description
        self.icon = icon
        self.colorHex = colorHex
        self.streakGoal = streakGoal
        self.goalType = goalType
        self.completionsPerDay = completionsPerDay
        self.durationMinutes = durationMinutes
        self.amountTarget = amountTarget
        self.amountUnit = amountUnit
        self.amountStep = amountStep
        self.schedule = schedule
        self.parts = parts
        self.timer = timer
        self.createdAt = createdAt
        self.history = history
        self.counts = counts
        self.skipped = skipped
        self.slots = slots
    }

    /// The editable settings, with the icon resolved for legacy habits.
    public var draft: HabitDraft {
        HabitDraft(
            name: name,
            description: description,
            icon: HabitIcons.resolve(icon, habitID: id),
            colorHex: colorHex,
            streakGoal: streakGoal,
            goalType: goalType,
            completionsPerDay: completionsPerDay,
            durationMinutes: durationMinutes,
            amountTarget: amountTarget,
            amountUnit: amountUnit,
            amountStep: amountStep,
            schedule: schedule,
            parts: parts
        )
    }
}
