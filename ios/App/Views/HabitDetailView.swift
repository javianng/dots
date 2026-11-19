import DotsCore
import SwiftUI

struct HabitDetailView: View {
    let habitID: String
    @Environment(HabitStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var selectedKey = DayMath.current.key(Date())
    @State private var showEdit = false

    var body: some View {
        Group {
            if let habit = store.habit(habitID) {
                content(habit)
            } else {
                Color.clear.onAppear { dismiss() }
            }
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Theme.background, for: .navigationBar)
    }

    private func content(_ habit: Habit) -> some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(spacing: 16) {
                    header(habit)
                    DayPanel(habit: habit, dateKey: selectedKey) {
                        selectedKey = DayMath.current.key(Date())
                    }
                    .id("panel")
                    StatsRow(habit: habit)
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Last 6 months").sectionTitleStyle()
                        HeatmapView(habit: habit, weeks: 26, showLabels: true)
                    }
                    .card()
                    MonthCalendarView(habit: habit, selectedKey: selectedKey) { key in
                        selectedKey = key
                        withAnimation { proxy.scrollTo("panel", anchor: .top) }
                    }
                    .card()
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 32)
                .frame(maxWidth: 720)
                .frame(maxWidth: .infinity)
            }
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Edit") { showEdit = true }
            }
        }
        .sheet(isPresented: $showEdit) { HabitFormView(habit: habit) }
    }

    private func header(_ habit: Habit) -> some View {
        HStack(spacing: 16) {
            HabitIconView(habit: habit, size: 64)
            VStack(alignment: .leading, spacing: 2) {
                Text(habit.name)
                    .font(.system(size: 28, weight: .bold))
                    .tracking(-0.4)
                    .lineLimit(2)
                Text([Labels.goal(habit), habit.schedule.label, habit.parts.isEmpty ? nil : Labels.parts(habit.parts)]
                    .compactMap { $0 }
                    .joined(separator: " · "))
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Theme.mutedText)
                if !habit.description.isEmpty {
                    Text(habit.description)
                        .font(.system(size: 15))
                        .foregroundStyle(Theme.mutedText)
                        .lineLimit(2)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.top, 4)
    }
}

/// Logs one day: today by default, or the day picked in the calendar. Shows
/// only the controls the habit's goal needs, plus "Skip this day".
struct DayPanel: View {
    @Environment(HabitStore.self) private var store
    let habit: Habit
    let dateKey: String
    let backToToday: () -> Void

    private var isToday: Bool { dateKey == DayMath.current.key(Date()) }

    var body: some View {
        VStack(spacing: 16) {
            HStack {
                Text(title).sectionTitleStyle()
                Spacer()
                if !isToday {
                    Button("Back to today", action: backToToday)
                        .font(.system(size: 13, weight: .medium))
                }
            }

            if habit.skipped.contains(dateKey) {
                Text("Skipped. This day won't count or break your streak.")
                    .font(.system(size: 15))
                    .foregroundStyle(Theme.mutedText)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
            } else {
                controls
            }

            if habit.goalType != .limit {
                Button(habit.skipped.contains(dateKey) ? "Undo skip" : "Skip this day") {
                    store.run(habit, CheckIn.toggleSkip(habit, dateKey))
                }
                .font(.system(size: 13))
                .foregroundStyle(Theme.mutedText)
            }
        }
        .card()
    }

    private var title: String {
        guard !isToday, let day = DayMath.current.date(dateKey) else { return "Today" }
        return day.formatted(.dateTime.weekday(.wide).day().month(.wide))
    }

    @ViewBuilder
    private var controls: some View {
        let target = habit.dayTarget
        let logged = habit.counts[dateKey] ?? 0
        let done = habit.history[dateKey] == true
        let tint = Theme.tint(habit.colorHex)

        if habit.goalType == .time {
            if isToday {
                TimerControls(habit: habit)
            } else {
                VStack(spacing: 12) {
                    BigNumber(value: done ? Labels.minutes(habit.durationMinutes) : "\(Int(min(logged, target) / 60)) min",
                              sub: "of \(Labels.minutes(habit.durationMinutes))")
                    BigCheck(done: done, tint: tint) {
                        store.run(habit, done ? CheckIn.clearDay(habit, dateKey) : CheckIn.completeDay(habit, dateKey))
                    }
                }
            }
        } else if CheckIn.usesSlots(habit) {
            let slots = habit.slots[dateKey] ?? []
            HStack(spacing: 8) {
                ForEach(habit.parts, id: \.self) { part in
                    let on = slots.contains(part)
                    Button {
                        store.run(habit, CheckIn.toggleSlot(habit, dateKey, part))
                    } label: {
                        HStack(spacing: 6) {
                            if on { Image(systemName: "checkmark").fontWeight(.bold) }
                            Text(part.label)
                        }
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(on ? Theme.onTint : Theme.mutedText)
                        .frame(maxWidth: .infinity, minHeight: 48)
                        .background(on ? tint : Theme.ink.opacity(0.07), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }
                    .buttonStyle(PressableStyle())
                    .accessibilityAddTraits(on ? .isSelected : [])
                }
            }
        } else if habit.goalType == .count && target == 1 {
            BigCheck(done: done, tint: tint) {
                store.run(habit, done ? CheckIn.clearDay(habit, dateKey) : CheckIn.completeDay(habit, dateKey))
            }
            .frame(maxWidth: .infinity)
        } else {
            AmountControls(habit: habit, dateKey: dateKey, logged: logged, done: done, tint: tint)
        }
    }
}

/// Counted check-ins, amounts and limits: a number with − / + and (for
/// amounts and limits) a field to type an exact value.
private struct AmountControls: View {
    @Environment(HabitStore.self) private var store
    let habit: Habit
    let dateKey: String
    let logged: Double
    let done: Bool
    let tint: Color
    @State private var editing = false
    @State private var exact = ""

    var body: some View {
        let target = habit.dayTarget
        let isLimit = habit.goalType == .limit
        let step = habit.goalType == .count ? 1 : habit.amountStep
        let unit = habit.goalType == .count ? "" : habit.amountUnit
        let over = isLimit && logged > target
        let sub = isLimit
            ? (over ? "over your limit of \(Labels.withUnit(target, unit))"
               : target == 0 ? "none is the goal" : "at most \(Labels.withUnit(target, unit))")
            : "of \(Labels.withUnit(target, unit))\(done ? " · done" : "")"

        VStack(spacing: 16) {
            BigNumber(value: Labels.withUnit(logged, unit), sub: sub)
            if !isLimit && target > 0 {
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Theme.ink.opacity(0.1))
                        Capsule()
                            .fill(done ? Theme.accent : tint)
                            .frame(width: geo.size.width * min(1, logged / target))
                    }
                }
                .frame(height: 6)
                .animation(.easeOut(duration: 0.3), value: logged)
            }
            HStack(spacing: 16) {
                RoundIconButton(systemImage: "minus", label: "Remove \(Labels.withUnit(step, unit))", disabled: logged <= 0) {
                    store.run(habit, CheckIn.setAmount(habit, dateKey, logged - step))
                }
                Button {
                    store.run(habit, CheckIn.setAmount(habit, dateKey, logged + step))
                } label: {
                    Label(Labels.withUnit(step, unit), systemImage: "plus")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(tint)
                        .padding(.horizontal, 20)
                        .frame(minWidth: 144, minHeight: 48)
                        .background(tint.opacity(0.16), in: Capsule())
                }
                .buttonStyle(PressableStyle())
                if habit.goalType != .count {
                    RoundIconButton(systemImage: "pencil", label: "Enter an exact amount") {
                        exact = Labels.amount(logged)
                        editing = true
                    }
                } else {
                    Color.clear.frame(width: 48, height: 48)
                }
            }
        }
        .alert("Amount for this day", isPresented: $editing) {
            TextField(unit.isEmpty ? "Amount" : unit, text: $exact)
                .keyboardType(.decimalPad)
            Button("Cancel", role: .cancel) {}
            Button("Save") {
                let value = Double(exact.replacingOccurrences(of: ",", with: ".").filter { "0123456789.".contains($0) })
                if let value { store.run(habit, CheckIn.setAmount(habit, dateKey, value)) }
            }
        }
    }
}

private struct BigNumber: View {
    let value: String
    let sub: String

    var body: some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.system(size: 40, weight: .bold).monospacedDigit())
                .tracking(-0.5)
                .contentTransition(.numericText())
                .animation(.snappy, value: value)
            Text(sub)
                .font(.system(size: 13))
                .foregroundStyle(Theme.mutedText)
        }
        .frame(maxWidth: .infinity)
    }
}

private struct BigCheck: View {
    let done: Bool
    let tint: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                Circle().fill(done ? tint : Theme.ink.opacity(0.07))
                Image(systemName: "checkmark")
                    .font(.system(size: 34, weight: .heavy))
                    .foregroundStyle(done ? Theme.onTint : Theme.mutedText)
            }
            .frame(width: 96, height: 96)
            .animation(.spring(response: 0.3, dampingFraction: 0.6), value: done)
        }
        .buttonStyle(PressableStyle())
        .accessibilityLabel(done ? "Done. Tap to undo" : "Mark done")
    }
}

/// Today's countdown for time goals: ring, play / pause, reset and done.
struct TimerControls: View {
    @Environment(HabitStore.self) private var store
    let habit: Habit

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            let today = DayMath.current.key(context.date)
            let running = CheckIn.isTimerRunning(habit, today)
            let target = habit.dayTarget
            let seconds = CheckIn.elapsedSeconds(habit, today, now: context.date)
            let left = target - seconds
            let done = left <= 0
            let tint = Theme.tint(habit.colorHex)
            let otherDayRunning = habit.timer != nil && !running

            VStack(spacing: 20) {
                ZStack {
                    Circle().stroke(Theme.ink.opacity(0.1), lineWidth: 10)
                    Circle()
                        .trim(from: 0, to: target > 0 ? seconds / target : 0)
                        .stroke(done ? Theme.accent : tint, style: StrokeStyle(lineWidth: 10, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                        .opacity(seconds == 0 ? 0 : 1)
                        .animation(.linear(duration: 0.3), value: seconds)
                    VStack(spacing: 6) {
                        if done {
                            Image(systemName: "checkmark").font(.system(size: 44, weight: .heavy)).foregroundStyle(Theme.accent)
                        } else {
                            Text(Labels.clock(left))
                                .font(.system(size: 44, weight: .bold).monospacedDigit())
                                .tracking(-0.5)
                        }
                        Text(done ? "\(Labels.minutes(habit.durationMinutes)) done today"
                             : running ? "remaining"
                             : seconds > 0 ? "paused" : "of \(Labels.minutes(habit.durationMinutes))")
                            .font(.system(size: 13))
                            .foregroundStyle(Theme.mutedText)
                    }
                }
                .frame(width: 200, height: 200)

                HStack(spacing: 24) {
                    RoundIconButton(systemImage: "arrow.counterclockwise", label: "Reset today's time", disabled: seconds == 0 && !running) {
                        store.run(habit, CheckIn.clearDay(habit, today))
                    }
                    Button {
                        store.run(habit, running ? CheckIn.pause(habit) : CheckIn.play(habit))
                    } label: {
                        Image(systemName: running ? "pause.fill" : "play.fill")
                            .font(.system(size: 26))
                            .foregroundStyle(Theme.onTint)
                            .frame(width: 64, height: 64)
                            .background(tint, in: Circle())
                    }
                    .buttonStyle(PressableStyle())
                    .disabled(done || otherDayRunning)
                    .opacity(done || otherDayRunning ? 0.35 : 1)
                    .accessibilityLabel(running ? "Pause timer" : "Start timer")
                    RoundIconButton(systemImage: "checkmark", label: "Mark today done", foreground: tint, background: tint.opacity(0.16), disabled: done) {
                        store.run(habit, CheckIn.completeDay(habit, today))
                    }
                }
            }
            .frame(maxWidth: .infinity)
        }
    }
}

/// Streak, goal and total, like the web app's three stats.
private struct StatsRow: View {
    let habit: Habit

    var body: some View {
        let result = Rules.streak(habit)
        let streak = result.value
        let unit = result.unit
        let unitWord = unit == .time ? "in a row" : streak == 1 ? unit.rawValue : "\(unit.rawValue)s"
        let goalWord = unit == .time ? "in a row" : "\(unit.rawValue)s"
        let total = habit.history.values.filter { $0 }.count
        HStack(spacing: 12) {
            Stat(label: "Streak", value: "\(streak)", unit: unitWord)
            if let goal = habit.streakGoal {
                Stat(label: "Goal", value: "\(goal)", unit: goalWord, progress: min(1, Double(streak) / Double(goal)), tint: Theme.tint(habit.colorHex))
            } else {
                Stat(label: "Goal", value: "–", unit: "not set")
            }
            totalStat(total)
        }
    }

    private func totalStat(_ days: Int) -> Stat {
        switch habit.goalType {
        case .amount:
            let sum = habit.counts.values.reduce(0, +)
            return Stat(label: "Total", value: sum >= 10_000 ? "\(Int((sum / 1000).rounded()))k" : Labels.amount(sum), unit: habit.amountUnit.isEmpty ? "logged" : habit.amountUnit)
        case .limit:
            return Stat(label: "Kept", value: "\(days)", unit: days == 1 ? "day" : "days")
        case .time:
            let minutes = Int((habit.counts.values.reduce(0) { $0 + min($1, habit.dayTarget) } / 60).rounded())
            return minutes >= 120
                ? Stat(label: "Total", value: Labels.amount((Double(minutes) / 6).rounded() / 10), unit: "hours")
                : Stat(label: "Total", value: "\(minutes)", unit: "min")
        case .count:
            return Stat(label: "Total", value: "\(days)", unit: days == 1 ? "day" : "days")
        }
    }
}

private struct Stat: View {
    let label: String
    let value: String
    let unit: String
    var progress: Double?
    var tint: Color = Theme.ink

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).sectionTitleStyle()
            Text(value)
                .font(.system(size: 26, weight: .bold).monospacedDigit())
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            Text(unit)
                .font(.system(size: 13))
                .foregroundStyle(Theme.mutedText)
                .lineLimit(1)
            if let progress {
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Theme.ink.opacity(0.1))
                        Capsule().fill(progress >= 1 ? Theme.accent : tint).frame(width: geo.size.width * progress)
                    }
                }
                .frame(height: 4)
            }
        }
        .card(padding: 14)
        .accessibilityElement(children: .combine)
    }
}
