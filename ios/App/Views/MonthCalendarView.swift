import DotsCore
import SwiftUI

/// Full month (Mon–Sun). Done days are filled with the habit colour, skipped
/// days outlined, today ringed in persimmon. Tapping a past day or today picks
/// it for the day panel; future days are disabled.
struct MonthCalendarView: View {
    let habit: Habit
    let selectedKey: String
    let onSelect: (String) -> Void
    @State private var monthOffset = 0

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 4), count: 7)

    var body: some View {
        let math = DayMath.current
        let now = Date()
        let month = math.calendar.date(byAdding: .month, value: monthOffset, to: math.periodStart(now, .month)) ?? now
        let todayKey = math.key(now)
        let tint = Theme.tint(habit.colorHex)

        VStack(spacing: 12) {
            HStack {
                Text(month.formatted(.dateTime.month(.wide).year()))
                    .font(.system(size: 17, weight: .semibold))
                Spacer()
                Button { monthOffset -= 1 } label: { Image(systemName: "chevron.left") }
                    .accessibilityLabel("Previous month")
                    .padding(.trailing, 12)
                Button { monthOffset += 1 } label: { Image(systemName: "chevron.right") }
                    .disabled(monthOffset >= 0)
                    .accessibilityLabel("Next month")
            }
            .fontWeight(.semibold)

            LazyVGrid(columns: columns, spacing: 6) {
                ForEach(Weekday.all) { day in
                    Text(day.short)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(Theme.mutedText)
                }
                ForEach(Array(math.monthGrid(month).enumerated()), id: \.offset) { _, day in
                    if let day {
                        let key = math.key(day)
                        let done = habit.history[key] == true
                        let future = key > todayKey
                        Button {
                            Haptics.selection()
                            onSelect(key)
                        } label: {
                            Text(day.formatted(.dateTime.day()))
                                .font(.system(size: 15, weight: done || key == todayKey ? .bold : .regular))
                                .foregroundStyle(done ? Theme.onTint : Theme.ink)
                                .frame(width: 40, height: 40)
                                .background {
                                    if done { Circle().fill(tint) }
                                }
                                .overlay {
                                    if habit.skipped.contains(key) {
                                        Circle().strokeBorder(Theme.ink.opacity(0.3), style: StrokeStyle(lineWidth: 1, dash: [3, 3]))
                                    }
                                    if key == todayKey {
                                        Circle().strokeBorder(Theme.accent, lineWidth: 2)
                                    }
                                    if key == selectedKey {
                                        Circle().stroke(Theme.ink, lineWidth: 2).padding(-3)
                                    }
                                }
                        }
                        .buttonStyle(PressableStyle())
                        .disabled(future)
                        .opacity(future ? 0.3 : 1)
                        .accessibilityLabel(day.formatted(date: .complete, time: .omitted) + (done ? ", done" : ""))
                    } else {
                        Color.clear.frame(height: 40)
                    }
                }
            }
        }
    }
}
