import Foundation

/// Reads Firestore document data (`[String: Any]`) the way use-habits.tsx does,
/// so a habit saved by the web app, the MCP server or this app always reads
/// back the same.
public enum Parse {
    /// A finite number, never a Bool (Firestore booleans bridge to NSNumber).
    public static func number(_ raw: Any?) -> Double? {
        guard let raw else { return nil }
        #if canImport(ObjectiveC)
        // Firestore numbers arrive as NSNumber; so do booleans, which must not count.
        guard let n = raw as? NSNumber, CFGetTypeID(n) != CFBooleanGetTypeID() else { return nil }
        let d = n.doubleValue
        return d.isFinite ? d : nil
        #else
        if raw is Bool { return nil }
        if let d = raw as? Double { return d.isFinite ? d : nil }
        if let i = raw as? Int { return Double(i) }
        if let i = raw as? Int64 { return Double(i) }
        return nil
        #endif
    }

    public static func timer(_ raw: Any?) -> RunningTimer? {
        guard let t = raw as? [String: Any],
              let startedAt = number(t["startedAt"]),
              let dateKey = t["dateKey"] as? String
        else { return nil }
        return RunningTimer(startedAt: startedAt, dateKey: dateKey)
    }
}

/// One completion doc (`habits/{id}/completions/{YYYY-MM-DD}`) as the app needs it.
public struct DayDoc: Equatable, Sendable {
    /// nil for docs saved before counts existed (plain check-offs).
    public var count: Double?
    public var skipped: Bool
    public var slots: [DayPart]

    public init(count: Double?, skipped: Bool = false, slots: [DayPart] = []) {
        self.count = count
        self.skipped = skipped
        self.slots = slots
    }

    public init(data: [String: Any]) {
        count = Parse.number(data["count"])
        skipped = (data["skipped"] as? Bool) == true
        slots = Rules.parseParts(data["slots"])
    }
}

public enum HabitParser {
    /// A habit doc without its logged days. `createdAt` comes from the
    /// Firestore timestamp (estimated while the write is still pending).
    public static func meta(id: String, data: [String: Any], createdAt: Date?) -> Habit {
        let streakGoal = Parse.number(data["streakGoal"]).map { Int($0.rounded()) }
        return Habit(
            id: id,
            name: data["name"] as? String ?? "",
            description: data["description"] as? String ?? "",
            icon: data["icon"] as? String,
            colorHex: data["colorHex"] as? String ?? "#8b5cf6",
            streakGoal: (streakGoal ?? 0) > 0 ? streakGoal : nil,
            goalType: Rules.parseGoalType(data["goalType"]),
            completionsPerDay: max(1, Int((Parse.number(data["completionsPerDay"]) ?? 1).rounded())),
            durationMinutes: max(1, Int((Parse.number(data["durationMinutes"]) ?? 15).rounded())),
            amountTarget: max(0, Parse.number(data["amountTarget"]) ?? 1),
            amountUnit: data["amountUnit"] as? String ?? "",
            amountStep: max(0.01, Parse.number(data["amountStep"]) ?? 1),
            schedule: Rules.parseSchedule(data["schedule"]),
            parts: Rules.parseParts(data["parts"]),
            timer: Parse.timer(data["timer"]),
            createdAt: createdAt ?? Date()
        )
    }

    /// Merges a habit's completion docs into `history`, `counts`, `skipped`
    /// and `slots`, exactly like use-habits.tsx.
    public static func habit(
        _ meta: Habit,
        days: [String: DayDoc],
        now: Date = Date(),
        math: DayMath = .current
    ) -> Habit {
        var habit = meta
        let target = meta.dayTarget
        let today = math.key(now)
        var history: [String: Bool] = [:]
        var counts: [String: Double] = [:]
        var skipped = Set<String>()
        var slots: [String: [DayPart]] = [:]

        if meta.goalType == .limit {
            // A limit is kept on every day nothing was logged, from the day the
            // habit was made; logged days are checked against the limit below.
            var day = math.startOfDay(meta.createdAt)
            var guardDays = 0
            while math.key(day) <= today && guardDays < 20_000 {
                history[math.key(day)] = true
                day = math.addDays(day, 1)
                guardDays += 1
            }
        }
        for (key, doc) in days {
            if doc.skipped {
                skipped.insert(key)
                history.removeValue(forKey: key)
                continue
            }
            // Days saved before counts existed were plain check-offs: treat as done.
            let count = doc.count ?? target
            counts[key] = count
            history[key] = meta.isDayMet(count)
            if !doc.slots.isEmpty { slots[key] = doc.slots }
        }
        habit.history = history
        habit.counts = counts
        habit.skipped = skipped
        habit.slots = slots
        return habit
    }
}

/// Turns app values into Firestore fields, matching what the web app writes.
public enum Encode {
    public static func schedule(_ schedule: Schedule) -> [String: Any] {
        switch schedule {
        case .daily: ["type": "daily"]
        case .days(let days): ["type": "days", "days": days.sorted()]
        case .period(let period, let times): ["type": "period", "period": period.rawValue, "times": times]
        case .interval(let every): ["type": "interval", "every": every]
        }
    }

    /// Whole numbers are stored as integers, like JS numbers end up in Firestore.
    public static func number(_ value: Double) -> Any {
        value == value.rounded() && abs(value) < 1e15 ? Int(value) as Any : value as Any
    }

    /// The habit fields a draft saves (not `createdAt`, `timer` or logged days).
    public static func draft(_ d: HabitDraft) -> [String: Any] {
        [
            "name": d.name,
            "description": d.description,
            "icon": d.icon,
            "colorHex": d.colorHex,
            "streakGoal": d.streakGoal.map { $0 as Any } ?? NSNull(),
            "goalType": d.goalType.rawValue,
            "completionsPerDay": d.completionsPerDay,
            "durationMinutes": d.durationMinutes,
            "amountTarget": number(d.amountTarget),
            "amountUnit": d.amountUnit,
            "amountStep": number(d.amountStep),
            "schedule": schedule(d.schedule),
            "parts": d.parts.map(\.rawValue),
        ]
    }

    public static func timer(_ t: RunningTimer) -> [String: Any] {
        ["startedAt": Int64(t.startedAt.rounded()), "dateKey": t.dateKey]
    }
}
