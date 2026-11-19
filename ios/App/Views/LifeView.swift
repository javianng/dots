import DotsCore
import SwiftUI

/// "Your life in weeks": one row per year of life, one dot per week. Weeks
/// lived are ink, this week is persimmon (the brand's "now"), the rest faint.
struct LifeView: View {
    @Environment(HabitStore.self) private var store

    var body: some View {
        if !store.lifeLoaded {
            ProgressView().frame(maxWidth: .infinity, minHeight: 300)
        } else if let life = store.life {
            let stats = Life.stats(life)
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Life in weeks").sectionTitleStyle()
                    Text("Week \(stats.currentWeek + 1)")
                        .font(.system(size: 34, weight: .bold))
                        .tracking(-0.5)
                    Text("\(stats.weeksLived.formatted()) lived · \(stats.weeksLeft.formatted()) to go · \(Int((stats.fractionLived * 100).rounded()))%")
                        .font(.system(size: 15))
                        .foregroundStyle(Theme.mutedText)
                }
                .padding(.top, 4)
                LifeGrid(stats: stats, years: life.lifeExpectancy)
                    .card(padding: 12)
                Text("Age \(stats.ageYears), week \(stats.weekOfYear + 1) of 52. Change your birthday or life expectancy in Settings.")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.mutedText)
            }
        } else {
            VStack(alignment: .leading, spacing: 12) {
                Text("Life in weeks").font(.title3.bold())
                Text("See your whole life as dots: one per week, one row per year. Add your date of birth in Settings to start.")
                    .font(.system(size: 15))
                    .foregroundStyle(Theme.mutedText)
            }
            .card()
            .padding(.top, 8)
        }
    }
}

private struct LifeGrid: View {
    let stats: LifeStats
    let years: Int

    var body: some View {
        let weeks = LifeProfile.weeksPerYear
        let left: CGFloat = 20
        GeometryReader { geo in
            let cell = (geo.size.width - left) / CGFloat(weeks)
            Canvas { context, _ in
                let r = cell * 0.36
                var lived = Path()
                var ahead = Path()
                for year in 0..<years {
                    if year % 5 == 0 {
                        context.draw(
                            Text("\(year)").font(.system(size: 8)).foregroundStyle(Theme.mutedText),
                            at: CGPoint(x: 0, y: CGFloat(year) * cell + cell / 2),
                            anchor: .leading
                        )
                    }
                    for week in 0..<weeks {
                        let index = year * weeks + week
                        guard index != stats.currentWeek else { continue }
                        let center = CGPoint(x: left + CGFloat(week) * cell + cell / 2, y: CGFloat(year) * cell + cell / 2)
                        let dot = Path(ellipseIn: CGRect(x: center.x - r, y: center.y - r, width: r * 2, height: r * 2))
                        if index < stats.currentWeek { lived.addPath(dot) } else { ahead.addPath(dot) }
                    }
                }
                context.fill(lived, with: .color(Theme.ink))
                context.fill(ahead, with: .color(Theme.ink.opacity(0.12)))
                if stats.currentWeek < years * weeks {
                    let c = CGPoint(x: left + CGFloat(stats.weekOfYear) * cell + cell / 2, y: CGFloat(stats.ageYears) * cell + cell / 2)
                    let nr = r * 1.4
                    context.fill(Path(ellipseIn: CGRect(x: c.x - nr, y: c.y - nr, width: nr * 2, height: nr * 2)), with: .color(Theme.accent))
                }
            }
        }
        .aspectRatio(CGFloat(weeks) / CGFloat(max(1, years)) * 1.04, contentMode: .fit)
        .accessibilityElement()
        .accessibilityLabel("Life in weeks: \(stats.weeksLived) weeks lived, \(stats.weeksLeft) to go.")
    }
}
