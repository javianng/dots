import DotsCore
import SwiftUI

/// The toggle for one habit on one day, wired to the habit's goal
/// (components/day-toggle.tsx):
/// - check off: a round check, or a segmented ring when several taps are needed.
/// - amount: a ring filling in steps; each tap adds one step.
/// - limit: a ring filling towards the limit; it turns ink once you're over.
/// - timer, today: a countdown ring with play / pause in the middle.
/// - timer, other days: a ring showing minutes logged; tap = done.
/// Rest days are drawn quieter but can still be logged; skipped days show a dash.
struct DayToggle: View {
    @Environment(HabitStore.self) private var store
    let habit: Habit
    let dateKey: String
    var part: DayPart?
    var size: CGFloat = 36

    var body: some View {
        Group {
            if CheckIn.isTimerRunning(habit, dateKey) {
                TimelineView(.periodic(from: .now, by: 1)) { context in
                    content(now: context.date)
                }
            } else {
                content(now: Date())
            }
        }
        .frame(width: size, height: size)
    }

    private var math: DayMath { .current }
    private var isToday: Bool { dateKey == math.key(Date()) }
    private var tint: Color { Theme.tint(habit.colorHex) }

    private var isRest: Bool {
        guard habit.history[dateKey] != true, let day = math.date(dateKey) else { return false }
        return !habit.schedule.isScheduledDay(day, math: math) || (isToday && Rules.todayStatus(habit) == .rest)
    }

    private func tap() {
        store.tap(habit, dateKey: dateKey, part: part)
    }

    @ViewBuilder
    private func content(now: Date) -> some View {
        let target = habit.dayTarget
        let logged = habit.counts[dateKey] ?? 0
        let completed = habit.history[dateKey] == true

        if habit.skipped.contains(dateKey) {
            Button(action: tap) {
                Circle()
                    .strokeBorder(Theme.ink.opacity(0.25), style: StrokeStyle(lineWidth: 1.5, dash: [3, 3]))
                    .overlay(Image(systemName: "minus").font(.system(size: size * 0.4, weight: .semibold)).foregroundStyle(Theme.mutedText))
            }
            .buttonStyle(PressableStyle())
            .accessibilityLabel("\(habit.name), skipped")
        } else if let part, CheckIn.usesSlots(habit) {
            CheckCircle(done: (habit.slots[dateKey] ?? []).contains(part), tint: tint, size: size, action: tap)
                .opacity(isRest ? 0.4 : 1)
                .accessibilityLabel("Mark \(habit.name) done this \(part.label.lowercased())")
        } else if habit.goalType == .limit {
            let over = logged > target
            SegmentRing(
                count: over || target == 0 ? (logged > 0 ? 1 : 0) : logged,
                target: over || target == 0 ? 1 : target,
                tint: over ? Theme.ink : tint,
                size: size,
                center: Text(Labels.compact(logged)).foregroundStyle(over ? Theme.ink : Theme.mutedText),
                action: tap
            )
            .accessibilityLabel("\(habit.name): log one, \(Labels.amount(logged)) of at most \(Labels.amount(target))")
        } else if habit.goalType == .amount && !completed {
            let steps = max(1, (target / habit.amountStep).rounded(.up))
            SegmentRing(
                count: min(steps, (logged / habit.amountStep).rounded(.down)),
                target: steps,
                tint: tint,
                size: size,
                center: Text(Labels.compact(logged)).foregroundStyle(Theme.mutedText),
                action: tap
            )
            .opacity(isRest ? 0.4 : 1)
            .accessibilityLabel("\(habit.name): add \(Labels.withUnit(habit.amountStep, habit.amountUnit)), \(Labels.amount(logged)) of \(Labels.amount(target))")
        } else if habit.goalType != .time || completed {
            let count = min(logged, target)
            if habit.goalType == .count && target > 1 && !completed {
                SegmentRing(count: count, target: target, tint: tint, size: size,
                            center: Text("\(Int(count))").foregroundStyle(Theme.mutedText), action: tap)
                    .opacity(isRest ? 0.4 : 1)
                    .accessibilityLabel("Mark \(habit.name) done, \(Int(count)) of \(Int(target))")
            } else {
                CheckCircle(done: completed, tint: tint, size: size, action: tap)
                    .opacity(isRest ? 0.4 : 1)
                    .accessibilityLabel(isRest ? "Mark \(habit.name) done (rest day)" : "Mark \(habit.name) done")
            }
        } else {
            let seconds = CheckIn.elapsedSeconds(habit, dateKey, now: now)
            let running = CheckIn.isTimerRunning(habit, dateKey)
            SegmentRing(
                count: seconds,
                target: target,
                tint: tint,
                size: size,
                center: isToday
                    ? Text(Image(systemName: running ? "pause.fill" : "play.fill")).foregroundStyle(running ? tint : Theme.mutedText)
                    : Text(seconds > 0 ? "\(Int(seconds / 60))′" : "").foregroundStyle(Theme.mutedText),
                action: tap
            )
            .opacity(isRest ? 0.4 : 1)
            .accessibilityLabel(isToday
                ? "\(running ? "Pause" : "Start") \(habit.name) timer, \(Labels.clock(target - seconds)) left"
                : "Mark \(habit.name) done, \(Int(seconds / 60)) of \(Int(target / 60)) minutes")
        }
    }
}

/// Round, Reminders-style check filled with the habit colour when done.
struct CheckCircle: View {
    let done: Bool
    let tint: Color
    var size: CGFloat = 36
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                Circle().strokeBorder(Theme.ink.opacity(0.2), lineWidth: 1.5).opacity(done ? 0 : 1)
                Circle().fill(tint).scaleEffect(done ? 1 : 0.4).opacity(done ? 1 : 0)
                Image(systemName: "checkmark")
                    .font(.system(size: size * 0.45, weight: .heavy))
                    .foregroundStyle(Theme.onTint)
                    .scaleEffect(done ? 1 : 0.4)
                    .opacity(done ? 1 : 0)
            }
            .frame(width: size, height: size)
            .animation(.spring(response: 0.3, dampingFraction: 0.55), value: done)
        }
        .buttonStyle(PressableStyle())
        .accessibilityAddTraits(done ? .isSelected : [])
    }
}

/// Progress ring split into segments (one per tap) when there are few enough
/// to read, otherwise a plain arc.
struct SegmentRing: View {
    let count: Double
    let target: Double
    let tint: Color
    var size: CGFloat = 36
    let center: Text
    let action: () -> Void

    private let lineWidth: CGFloat = 3

    var body: some View {
        Button(action: action) {
            ZStack {
                ring
                center.font(.system(size: size * 0.33, weight: .semibold).monospacedDigit())
                    .minimumScaleFactor(0.6)
                    .lineLimit(1)
                    .padding(4)
            }
            .frame(width: size, height: size)
        }
        .buttonStyle(PressableStyle())
    }

    @ViewBuilder
    private var ring: some View {
        let segments = Int(target)
        if target >= 1, target <= 12, target == target.rounded() {
            let gap = 0.03
            ZStack {
                ForEach(0..<segments, id: \.self) { i in
                    let from = Double(i) / target + gap / 2
                    let to = Double(i + 1) / target - gap / 2
                    Circle()
                        .trim(from: from, to: max(from, to))
                        .stroke(Double(i) < count ? tint : Theme.ink.opacity(0.15), lineWidth: lineWidth)
                }
            }
            .rotationEffect(.degrees(-90))
            .padding(lineWidth / 2)
            .animation(.easeOut(duration: 0.3), value: count)
        } else {
            ZStack {
                Circle().stroke(Theme.ink.opacity(0.15), lineWidth: lineWidth)
                Circle()
                    .trim(from: 0, to: target > 0 ? min(1, count / target) : 0)
                    .stroke(tint, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                    .rotationEffect(.degrees(-90))
            }
            .padding(lineWidth / 2)
            .animation(.easeOut(duration: 0.3), value: count)
        }
    }
}
