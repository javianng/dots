import DotsCore
import SwiftUI

/// GitHub-style heatmap: 7 rows (Mon–Sun) × `weeks` columns, today in the
/// rightmost column. Done days are filled with the habit colour; this month's
/// empty days are tinted faintly; skipped days are outlined; today has a
/// persimmon ring (components/heatmap.tsx).
struct HeatmapView: View {
    let habit: Habit
    var weeks = 26
    var showLabels = false

    private let gapRatio: CGFloat = 0.3

    var body: some View {
        let math = DayMath.current
        let columns = math.heatmapWeeks(weeks)
        let labelTop: CGFloat = showLabels ? 16 : 0
        let labelLeft: CGFloat = showLabels ? 26 : 0
        let units = CGFloat(weeks) + gapRatio * CGFloat(weeks - 1)
        let rowsUnits = 7 + gapRatio * 6

        GeometryReader { geo in
            let cell = (geo.size.width - labelLeft) / units
            Canvas { context, _ in
                draw(context: context, columns: columns, cell: cell, left: labelLeft, top: labelTop, math: math)
            }
        }
        .modifier(HeatmapHeight(units: units, rowsUnits: rowsUnits, labelTop: labelTop, labelLeft: labelLeft))
        .accessibilityElement()
        .accessibilityLabel("\(habit.name), last \(weeks / 4) months: \(doneCount(columns, math: math)) days done")
    }

    private func doneCount(_ columns: [[Date]], math: DayMath) -> Int {
        columns.joined().filter { habit.history[math.key($0)] == true }.count
    }

    private func draw(context: GraphicsContext, columns: [[Date]], cell: CGFloat, left: CGFloat, top: CGFloat, math: DayMath) {
        let gap = cell * gapRatio
        let now = Date()
        let todayKey = math.key(now)
        let month = math.calendar.component(.month, from: now)
        let year = math.calendar.component(.year, from: now)
        let tint = Theme.tint(habit.colorHex)

        if showLabels {
            var lastMonth = -1
            for (i, week) in columns.enumerated() {
                let m = math.calendar.component(.month, from: week[0])
                if m != lastMonth && i < columns.count - 1 {
                    let name = math.calendar.shortMonthSymbols[m - 1]
                    context.draw(
                        Text(name).font(.system(size: 10)).foregroundStyle(Theme.mutedText),
                        at: CGPoint(x: left + CGFloat(i) * (cell + gap), y: 0),
                        anchor: .topLeading
                    )
                }
                lastMonth = m
            }
            for (row, label) in [(1, "Tue"), (3, "Thu"), (5, "Sat")] {
                context.draw(
                    Text(label).font(.system(size: 10)).foregroundStyle(Theme.mutedText),
                    at: CGPoint(x: 0, y: top + CGFloat(row) * (cell + gap) + cell / 2),
                    anchor: .leading
                )
            }
        }

        for (i, week) in columns.enumerated() {
            for (row, day) in week.enumerated() {
                let key = math.key(day)
                let rect = CGRect(x: left + CGFloat(i) * (cell + gap), y: top + CGFloat(row) * (cell + gap), width: cell, height: cell)
                let shape = Squircle().path(in: rect)
                let isFuture = key > todayKey
                let done = !isFuture && habit.history[key] == true
                let skipped = !done && habit.skipped.contains(key)
                let rest = !done && !skipped && !habit.schedule.isScheduledDay(day, math: math)
                let inMonth = math.calendar.component(.month, from: day) == month && math.calendar.component(.year, from: day) == year

                var opacity: Double = 1
                if isFuture { opacity = 0.4 }
                if rest { opacity = 0.35 }
                var layer = context
                layer.opacity = opacity

                if done {
                    layer.fill(shape, with: .color(tint))
                } else if skipped {
                    layer.stroke(shape, with: .color(Theme.ink.opacity(0.3)), style: StrokeStyle(lineWidth: 1, dash: [2, 2]))
                } else if inMonth {
                    layer.fill(shape, with: .color(tint.opacity(0.16)))
                } else {
                    layer.fill(shape, with: .color(Theme.muted))
                }

                if key == todayKey {
                    // Persimmon marks "now".
                    let ring = Squircle().path(in: rect.insetBy(dx: -2, dy: -2))
                    context.stroke(ring, with: .color(Theme.accent), lineWidth: 1.5)
                }
            }
        }
    }
}

/// Sizes the heatmap to its width: the height follows from the cell size.
private struct HeatmapHeight: ViewModifier {
    let units: CGFloat
    let rowsUnits: CGFloat
    let labelTop: CGFloat
    let labelLeft: CGFloat
    @State private var width: CGFloat = 320

    func body(content: Content) -> some View {
        content
            .frame(height: (width - labelLeft) / units * rowsUnits + labelTop + 2)
            .background(GeometryReader { geo in
                Color.clear
                    .onAppear { width = geo.size.width }
                    .onChange(of: geo.size.width) { _, new in width = new }
            })
    }
}
