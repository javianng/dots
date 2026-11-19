import Foundation

/// "Your life in weeks" (after Wait But Why): one dot per week, one row per
/// year of life, 52 dots to a row. Port of lib/life.ts.
///
/// Firestore: `users/{uid}.life` → { birthDate: "YYYY-MM-DD", lifeExpectancy: number }
public struct LifeProfile: Equatable, Sendable {
    /// Local 'YYYY-MM-DD'.
    public var birthDate: String
    /// Expected lifespan in whole years.
    public var lifeExpectancy: Int

    public init(birthDate: String, lifeExpectancy: Int) {
        self.birthDate = birthDate
        self.lifeExpectancy = lifeExpectancy
    }

    public static let weeksPerYear = 52
    public static let defaultLifeExpectancy = 90
    public static let minLifeExpectancy = 1
    public static let maxLifeExpectancy = 120

    /// `users/{uid}.life` from a user doc's data, if it's well-formed.
    public init?(userData: [String: Any]?, math: DayMath = .current) {
        guard let life = userData?["life"] as? [String: Any],
              let birth = life["birthDate"] as? String, math.date(birth) != nil,
              let expectancy = Parse.number(life["lifeExpectancy"])
        else { return nil }
        self.init(birthDate: birth, lifeExpectancy: Int(expectancy.rounded()))
    }

    public var fields: [String: Any] {
        ["birthDate": birthDate, "lifeExpectancy": lifeExpectancy]
    }
}

public struct LifeStats: Equatable, Sendable {
    public var ageYears: Int
    /// Week of the current year of life, 0-based, capped at 51.
    public var weekOfYear: Int
    /// Index of the current dot in the grid (ageYears * 52 + weekOfYear).
    public var currentWeek: Int
    public var totalWeeks: Int
    public var weeksLived: Int
    public var weeksLeft: Int
    /// 0–1.
    public var fractionLived: Double
}

public enum Life {
    /// Calendar-safe "the same date `years` later" (29 Feb → 28 Feb).
    static func addYears(_ date: Date, _ years: Int, math: DayMath) -> Date {
        math.calendar.date(byAdding: .year, value: years, to: date) ?? date
    }

    static func daysBetween(_ a: Date, _ b: Date, math: DayMath) -> Int {
        math.calendar.dateComponents([.day], from: math.startOfDay(a), to: math.startOfDay(b)).day ?? 0
    }

    /// Rows follow birthdays, so each row really is one year of life; the last
    /// day or so of a 365/366-day year folds into dot 52.
    public static func stats(_ profile: LifeProfile, today: Date = Date(), math: DayMath = .current) -> LifeStats {
        let birth = math.date(profile.birthDate) ?? math.startOfDay(today)
        let day = math.startOfDay(today)
        let totalWeeks = profile.lifeExpectancy * LifeProfile.weeksPerYear

        var ageYears = math.calendar.component(.year, from: day) - math.calendar.component(.year, from: birth)
        if addYears(birth, ageYears, math: math) > day { ageYears -= 1 }
        ageYears = max(0, ageYears)

        let lastBirthday = addYears(birth, ageYears, math: math)
        let weekOfYear = min(LifeProfile.weeksPerYear - 1, max(0, daysBetween(lastBirthday, day, math: math) / 7))
        let currentWeek = min(totalWeeks, ageYears * LifeProfile.weeksPerYear + weekOfYear)
        return LifeStats(
            ageYears: ageYears,
            weekOfYear: weekOfYear,
            currentWeek: currentWeek,
            totalWeeks: totalWeeks,
            weeksLived: currentWeek,
            weeksLeft: max(0, totalWeeks - currentWeek),
            fractionLived: totalWeeks > 0 ? min(1, Double(currentWeek) / Double(totalWeeks)) : 0
        )
    }

    /// An error message, or nil if the profile is valid.
    public static func validate(_ profile: LifeProfile, today: Date = Date(), math: DayMath = .current) -> String? {
        guard let birth = math.date(profile.birthDate) else { return "Enter your date of birth." }
        if birth > math.startOfDay(today) { return "Your birthday can't be in the future." }
        if profile.lifeExpectancy < LifeProfile.minLifeExpectancy || profile.lifeExpectancy > LifeProfile.maxLifeExpectancy {
            return "Life expectancy should be between \(LifeProfile.minLifeExpectancy) and \(LifeProfile.maxLifeExpectancy) years."
        }
        let age = stats(profile, today: today, math: math).ageYears
        if age >= profile.lifeExpectancy { return "You're already \(age) — set a life expectancy above that." }
        return nil
    }
}
