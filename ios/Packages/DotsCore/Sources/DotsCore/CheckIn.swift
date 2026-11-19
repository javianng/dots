import Foundation

// Port of lib/check-in.ts and the write helpers in lib/habits.ts. These
// functions don't touch Firestore: they return the writes to make, which the
// app applies (HabitStore.apply). That keeps the rules testable and makes sure
// the phone writes exactly what the web app would.

/// One change to a habit's Firestore data.
public enum HabitWrite: Equatable, Sendable {
    /// `completions/{dateKey}` = { count, completed, slots?, completedAt: serverTimestamp }.
    case setDay(dateKey: String, count: Double, completed: Bool, slots: [DayPart]?)
    /// Deletes `completions/{dateKey}`.
    case deleteDay(dateKey: String)
    /// `completions/{dateKey}` = { count: 0, completed: false, skipped: true, completedAt }.
    case skipDay(dateKey: String)
    /// `timer` on the habit doc.
    case startTimer(RunningTimer)
    /// One batch: `timer: null` and the day's seconds (deleted when 0).
    case stopTimer(dateKey: String, seconds: Double, completed: Bool)
    /// `timer: null` without logging (after a goal-type change).
    case clearTimer
    /// Merges { count, completed } into a day (goal-type rescale).
    case mergeDay(dateKey: String, count: Double, completed: Bool)

    /// `setDayCount`: zero removes the day.
    public static func day(_ dateKey: String, count: Double, completed: Bool, slots: [DayPart]? = nil) -> HabitWrite {
        count <= 0 ? .deleteDay(dateKey: dateKey) : .setDay(dateKey: dateKey, count: count, completed: completed, slots: slots)
    }
}

/// How a tap should feel.
public enum Feedback: Equatable, Sendable {
    case none
    case light
    /// The day was just finished: show the "done" toast.
    case celebrate(dateKey: String)
}

public struct CheckInResult: Equatable, Sendable {
    public var writes: [HabitWrite]
    public var feedback: Feedback

    public init(_ writes: [HabitWrite], _ feedback: Feedback) {
        self.writes = writes
        self.feedback = feedback
    }

    public static let nothing = CheckInResult([], .none)
}

public enum CheckIn {
    /// Amount logged for a day, capped at the habit's current target.
    public static func dayCount(_ habit: Habit, _ dateKey: String) -> Double {
        min(habit.counts[dateKey] ?? 0, habit.dayTarget)
    }

    /// Seconds logged for a day including a running countdown, capped at the target.
    public static func elapsedSeconds(_ habit: Habit, _ dateKey: String, now: Date = Date()) -> Double {
        var seconds = habit.counts[dateKey] ?? 0
        if let timer = habit.timer, timer.dateKey == dateKey {
            seconds += max(0, ((now.timeIntervalSince1970 * 1000 - timer.startedAt) / 1000).rounded(.down))
        }
        return min(seconds, habit.dayTarget)
    }

    public static func isTimerRunning(_ habit: Habit, _ dateKey: String? = nil) -> Bool {
        guard let timer = habit.timer else { return false }
        return dateKey == nil || timer.dateKey == dateKey
    }

    /// Check-off habits with several times of day get one check per time of day.
    public static func usesSlots(_ habit: Habit) -> Bool {
        habit.goalType == .count && habit.parts.count > 1
    }

    /// When a running countdown will reach the day's target.
    public static func timerEnd(_ habit: Habit) -> Date? {
        guard let timer = habit.timer else { return nil }
        let logged = habit.counts[timer.dateKey] ?? 0
        let left = habit.dayTarget - logged
        guard left > 0 else { return nil }
        return Date(timeIntervalSince1970: timer.startedAt / 1000 + left)
    }

    /// Play: starts the countdown for today. No-op once today's time is in.
    public static func play(_ habit: Habit, now: Date = Date(), math: DayMath = .current) -> CheckInResult {
        let dateKey = math.key(now)
        if habit.timer != nil || dayCount(habit, dateKey) >= habit.dayTarget { return .nothing }
        return CheckInResult([.startTimer(RunningTimer(startedAt: (now.timeIntervalSince1970 * 1000).rounded(), dateKey: dateKey))], .light)
    }

    /// Pause: banks the time run so far against the timer's day.
    public static func pause(_ habit: Habit, now: Date = Date()) -> CheckInResult {
        guard let timer = habit.timer else { return .nothing }
        let seconds = elapsedSeconds(habit, timer.dateKey, now: now)
        let done = seconds >= habit.dayTarget
        return CheckInResult(
            [.stopTimer(dateKey: timer.dateKey, seconds: seconds, completed: done)],
            done ? .celebrate(dateKey: timer.dateKey) : .light
        )
    }

    /// Clears a day (and stops the countdown if it was running for that day).
    public static func clearDay(_ habit: Habit, _ dateKey: String) -> CheckInResult {
        if habit.timer?.dateKey == dateKey {
            return CheckInResult([.stopTimer(dateKey: dateKey, seconds: 0, completed: false)], .light)
        }
        return CheckInResult([.day(dateKey, count: 0, completed: false)], .light)
    }

    /// Marks a day fully done (time goals: fills the remaining time).
    public static func completeDay(_ habit: Habit, _ dateKey: String) -> CheckInResult {
        let target = habit.dayTarget
        if habit.timer?.dateKey == dateKey {
            return CheckInResult([.stopTimer(dateKey: dateKey, seconds: target, completed: true)], .celebrate(dateKey: dateKey))
        }
        return CheckInResult(
            [.day(dateKey, count: target, completed: true, slots: usesSlots(habit) ? habit.parts : nil)],
            .celebrate(dateKey: dateKey)
        )
    }

    /// Sets a day's logged amount (amount, limit and count goals). Celebrates
    /// when an amount goal is reached; a limit gets a gentle tap instead.
    public static func setAmount(_ habit: Habit, _ dateKey: String, _ value: Double) -> CheckInResult {
        let next = max(0, (value * 100).rounded() / 100)
        let before = habit.counts[dateKey] ?? 0
        let met = habit.isDayMet(next)
        let celebrate = habit.goalType != .limit && met && !habit.isDayMet(before)
        return CheckInResult([.day(dateKey, count: next, completed: met)], celebrate ? .celebrate(dateKey: dateKey) : .light)
    }

    /// Ticks one time of day on or off (check-off habits with several times of day).
    public static func toggleSlot(_ habit: Habit, _ dateKey: String, _ part: DayPart) -> CheckInResult {
        var done = Set(habit.slots[dateKey] ?? [])
        if done.contains(part) { done.remove(part) } else { done.insert(part) }
        let slots = habit.parts.filter { done.contains($0) }
        let complete = slots.count >= habit.parts.count
        return CheckInResult(
            [.day(dateKey, count: Double(slots.count), completed: complete, slots: slots)],
            complete ? .celebrate(dateKey: dateKey) : .light
        )
    }

    /// Skipping replaces anything logged that day; skipping again undoes it.
    public static func toggleSkip(_ habit: Habit, _ dateKey: String) -> CheckInResult {
        let skip = !habit.skipped.contains(dateKey)
        if skip, habit.timer?.dateKey == dateKey {
            return CheckInResult([.stopTimer(dateKey: dateKey, seconds: 0, completed: false), .skipDay(dateKey: dateKey)], .light)
        }
        return CheckInResult([skip ? .skipDay(dateKey: dateKey) : .deleteDay(dateKey: dateKey)], .light)
    }

    /// One quick tap on a day (the round toggles on the main screen).
    /// - Check-off goals: adds a tap until the target is met; a tap on a finished
    ///   day clears it. With several times of day, `part` picks which check to toggle.
    /// - Amount / limit goals: adds one step.
    /// - Time goals, today: play / pause the countdown (`useTimer: false` makes
    ///   it a plain done / not-done toggle).
    /// - Time goals, other days: done / not done.
    public static func tap(
        _ habit: Habit,
        _ dateKey: String,
        part: DayPart? = nil,
        useTimer: Bool = true,
        now: Date = Date(),
        math: DayMath = .current
    ) -> CheckInResult {
        let target = habit.dayTarget

        switch habit.goalType {
        case .amount, .limit:
            return setAmount(habit, dateKey, (habit.counts[dateKey] ?? 0) + habit.amountStep)

        case .time:
            if elapsedSeconds(habit, dateKey, now: now) >= target { return clearDay(habit, dateKey) }
            if useTimer, dateKey == math.key(now) {
                return habit.timer != nil ? pause(habit, now: now) : play(habit, now: now, math: math)
            }
            return completeDay(habit, dateKey)

        case .count:
            if usesSlots(habit) {
                if let part { return toggleSlot(habit, dateKey, part) }
                // No specific time of day (e.g. the 5-day list): fill the next one, or clear.
                let done = Set(habit.slots[dateKey] ?? [])
                if done.count >= habit.parts.count { return clearDay(habit, dateKey) }
                guard let next = habit.parts.first(where: { !done.contains($0) }) else { return clearDay(habit, dateKey) }
                return toggleSlot(habit, dateKey, next)
            }
            let current = dayCount(habit, dateKey)
            let next = current >= target ? 0 : current + 1
            let feedback: Feedback = next >= target ? .celebrate(dateKey: dateKey) : (next > 0 ? .light : .none)
            return CheckInResult([.day(dateKey, count: next, completed: next >= target)], feedback)
        }
    }

    /// Switching a habit's goal type changes what a day's `count` means (taps,
    /// seconds, units). Finished days stay finished at the new target and
    /// part-done days are cleared; to or from a limit, logged days are cleared.
    /// Skipped days are left alone. A running timer is stopped without logging.
    public static func goalTypeChange(from old: Habit, to draft: HabitDraft) -> [HabitWrite] {
        guard old.goalType != draft.goalType else { return [] }
        let fromLimit = old.goalType == .limit
        let days: [String: Bool] = fromLimit
            ? Dictionary(uniqueKeysWithValues: old.counts.keys.map { ($0, false) })
            : old.history
        let keep = !fromLimit && draft.goalType != .limit
        let target = draft.dayTarget
        var writes: [HabitWrite] = days.keys.sorted().map { key in
            days[key] == true && keep && target > 0
                ? .mergeDay(dateKey: key, count: target, completed: true)
                : .deleteDay(dateKey: key)
        }
        if old.timer != nil { writes.append(.clearTimer) }
        return writes
    }
}

public extension Habit {
    /// The habit as it will look once `writes` are applied locally. Used to
    /// word the "done" toast with the new streak.
    func applying(_ result: CheckInResult) -> Habit {
        var habit = self
        for write in result.writes {
            switch write {
            case .setDay(let key, let count, _, _), .mergeDay(let key, let count, _):
                habit.counts[key] = count
                habit.history[key] = habit.isDayMet(count)
                habit.skipped.remove(key)
            case .deleteDay(let key):
                habit.counts.removeValue(forKey: key)
                habit.history.removeValue(forKey: key)
                habit.skipped.remove(key)
            case .skipDay(let key):
                habit.skipped.insert(key)
                habit.history.removeValue(forKey: key)
            case .stopTimer(let key, let seconds, _):
                habit.timer = nil
                if seconds > 0 {
                    habit.counts[key] = seconds
                    habit.history[key] = habit.isDayMet(seconds)
                } else {
                    habit.counts.removeValue(forKey: key)
                    habit.history.removeValue(forKey: key)
                }
            case .startTimer(let timer):
                habit.timer = timer
            case .clearTimer:
                habit.timer = nil
            }
        }
        return habit
    }
}
