import Foundation

/// Local-calendar date helpers. Day keys are 'YYYY-MM-DD' in the device's time
/// zone, exactly like lib/dates.ts, so a day logged on the phone is the same
/// day on the web.
public struct DayMath: Sendable {
    public var calendar: Calendar

    public init(calendar: Calendar = .current) {
        var gregorian = Calendar(identifier: .gregorian)
        gregorian.timeZone = calendar.timeZone
        gregorian.locale = calendar.locale
        self.calendar = gregorian
    }

    /// The device's calendar right now (picks up time zone changes).
    public static var current: DayMath { DayMath(calendar: .current) }

    public func key(_ date: Date) -> String {
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    /// Local midnight of a 'YYYY-MM-DD' key, or nil if it isn't a real date.
    public func date(_ key: String) -> Date? {
        let parts = key.split(separator: "-")
        guard parts.count == 3,
              let y = Int(parts[0]), let m = Int(parts[1]), let d = Int(parts[2]),
              parts[0].count == 4, parts[1].count == 2, parts[2].count == 2
        else { return nil }
        let components = DateComponents(year: y, month: m, day: d)
        guard let date = calendar.date(from: components) else { return nil }
        let check = calendar.dateComponents([.year, .month, .day], from: date)
        return check.year == y && check.month == m && check.day == d ? date : nil
    }

    public func startOfDay(_ date: Date) -> Date { calendar.startOfDay(for: date) }

    public func addDays(_ date: Date, _ days: Int) -> Date {
        calendar.date(byAdding: .day, value: days, to: date) ?? date
    }

    /// 0 = Sunday … 6 = Saturday, like JS `getDay()`.
    public func weekday(_ date: Date) -> Int {
        calendar.component(.weekday, from: date) - 1
    }

    public func hour(_ date: Date) -> Int { calendar.component(.hour, from: date) }

    /// Whole calendar days from the day `fromKey` to the day containing `to`.
    public func daysBetween(_ fromKey: String, _ to: Date) -> Int {
        guard let from = date(fromKey) else { return 0 }
        return calendar.dateComponents([.day], from: from, to: startOfDay(to)).day ?? 0
    }

    /// First day of the week (Monday) or month containing `date`.
    public func periodStart(_ date: Date, _ period: Period) -> Date {
        let day = startOfDay(date)
        switch period {
        case .month:
            let c = calendar.dateComponents([.year, .month], from: day)
            return calendar.date(from: DateComponents(year: c.year, month: c.month, day: 1)) ?? day
        case .week:
            return addDays(day, -((weekday(day) + 6) % 7))
        }
    }

    public func nextPeriodStart(_ start: Date, _ period: Period) -> Date {
        switch period {
        case .month: calendar.date(byAdding: .month, value: 1, to: start) ?? start
        case .week: addDays(start, 7)
        }
    }

    /// The last `n` days, oldest first, ending today.
    public func lastNDays(_ n: Int, now: Date = Date()) -> [Date] {
        (0..<n).map { addDays(startOfDay(now), $0 - (n - 1)) }
    }

    /// Columns for a GitHub-style heatmap: `weeks` columns of 7 days each
    /// (Monday-first), with today in the final column.
    public func heatmapWeeks(_ weeks: Int, now: Date = Date()) -> [[Date]] {
        let today = startOfDay(now)
        let lastMonday = addDays(today, -((weekday(today) + 6) % 7))
        return (0..<weeks).map { w in
            let weekStart = addDays(lastMonday, (w - (weeks - 1)) * 7)
            return (0..<7).map { addDays(weekStart, $0) }
        }
    }

    /// Days of the month containing `month`, padded to whole Monday-first weeks
    /// (nil = a padding cell).
    public func monthGrid(_ month: Date) -> [Date?] {
        let first = periodStart(month, .month)
        let next = nextPeriodStart(first, .month)
        let lead = (weekday(first) + 6) % 7
        var cells: [Date?] = Array(repeating: nil, count: lead)
        var day = first
        while day < next {
            cells.append(day)
            day = addDays(day, 1)
        }
        while cells.count % 7 != 0 { cells.append(nil) }
        return cells
    }

    /// `date` at a time of day given as minutes since midnight.
    public func at(_ date: Date, minutes: Int) -> Date {
        calendar.date(
            bySettingHour: minutes / 60, minute: minutes % 60, second: 0, of: startOfDay(date)
        ) ?? date
    }
}
