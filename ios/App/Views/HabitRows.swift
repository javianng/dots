import DotsCore
import SwiftUI

/// Section label (Morning / Afternoon / …) with a persimmon dot on "now".
struct SectionLabel: View {
    let section: Today.Section

    var body: some View {
        if let label = section.label {
            HStack(spacing: 8) {
                Text(label).sectionTitleStyle()
                if section.isNow {
                    Circle().fill(Theme.accent).frame(width: 6, height: 6).accessibilityLabel("now")
                }
            }
            .padding(.horizontal, 4)
            .padding(.top, 8)
        }
    }
}

/// Streak / schedule line, or the live countdown while a timer runs.
struct HabitSubtitle: View {
    let habit: Habit

    var body: some View {
        if let timer = habit.timer {
            TimelineView(.periodic(from: .now, by: 1)) { context in
                let left = habit.dayTarget - CheckIn.elapsedSeconds(habit, timer.dateKey, now: context.date)
                Text("\(Labels.clock(left)) left")
                    .font(.system(size: 12, weight: .medium).monospacedDigit())
                    .foregroundStyle(Theme.mutedText)
            }
        } else {
            Text(text)
                .font(.system(size: 12))
                .foregroundStyle(Theme.mutedText)
                .lineLimit(1)
        }
    }

    private var text: String {
        let today = DayMath.current.key(Date())
        if CheckIn.usesSlots(habit), habit.history[today] != true, !habit.skipped.contains(today) {
            let done = habit.slots[today] ?? []
            return habit.parts.map { "\($0.label)\(done.contains($0) ? " ✓" : "")" }.joined(separator: " · ")
        }
        return Labels.progress(habit)
    }
}

/// Icon + name, tapping through to the habit.
struct HabitLinkLabel: View {
    let habit: Habit
    var iconSize: CGFloat = 40
    var showSubtitle = true

    var body: some View {
        NavigationLink(value: habit.id) {
            HStack(spacing: 12) {
                HabitIconView(habit: habit, size: iconSize)
                VStack(alignment: .leading, spacing: 2) {
                    Text(habit.name)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.ink)
                        .lineLimit(1)
                    if showSubtitle { HabitSubtitle(habit: habit) }
                }
                Spacer(minLength: 0)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

/// Grid: a card per habit with its last six months.
struct GridSections: View {
    let habits: [Habit]

    var body: some View {
        let today = DayMath.current.key(Date())
        ForEach(Today.sections(habits)) { section in
            SectionLabel(section: section)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 300), spacing: 12)], spacing: 12) {
                ForEach(section.items) { item in
                    VStack(spacing: 14) {
                        HStack(spacing: 12) {
                            HabitLinkLabel(habit: item.habit)
                            DayToggle(habit: item.habit, dateKey: today, part: item.part)
                        }
                        HeatmapView(habit: item.habit, weeks: 26)
                    }
                    .card()
                }
            }
        }
    }
}

/// Compact: one grouped card per section.
struct CompactSections: View {
    let habits: [Habit]

    var body: some View {
        let today = DayMath.current.key(Date())
        ForEach(Today.sections(habits)) { section in
            SectionLabel(section: section)
            VStack(spacing: 0) {
                ForEach(Array(section.items.enumerated()), id: \.element.id) { index, item in
                    if index > 0 { Divider().padding(.leading, 60) }
                    HStack(spacing: 12) {
                        HabitLinkLabel(habit: item.habit, iconSize: 36)
                        DayToggle(habit: item.habit, dateKey: today, part: item.part)
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                }
            }
            .background(Theme.card, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        }
    }
}

/// List: the last five days, so missed days can be filled in.
struct LastDaysList: View {
    let habits: [Habit]

    var body: some View {
        let math = DayMath.current
        let days = math.lastNDays(5)
        let today = math.key(Date())
        VStack(spacing: 8) {
            HStack(spacing: 6) {
                Text("Last 5 days").sectionTitleStyle()
                Spacer()
                ForEach(days, id: \.self) { day in
                    let isToday = math.key(day) == today
                    VStack(spacing: 2) {
                        Text(day.formatted(.dateTime.weekday(.narrow)))
                        Text(day.formatted(.dateTime.day()))
                            .frame(width: 20, height: 20)
                            .background(isToday ? Theme.accent : .clear, in: Circle())
                            .foregroundStyle(isToday ? Theme.ink : Theme.mutedText)
                    }
                    .font(.system(size: 11, weight: isToday ? .bold : .regular))
                    .foregroundStyle(isToday ? Theme.ink : Theme.mutedText)
                    .frame(width: 32)
                }
            }
            .padding(.horizontal, 12)

            ForEach(habits) { habit in
                HStack(spacing: 6) {
                    HabitLinkLabel(habit: habit, iconSize: 36, showSubtitle: false)
                    ForEach(days, id: \.self) { day in
                        DayToggle(habit: habit, dateKey: math.key(day), size: 32)
                    }
                }
                .card(padding: 12)
            }
        }
    }
}
