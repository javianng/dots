import XCTest
@testable import DotsCore

/// Expected values were produced by running the web app's lib/schedule.ts on
/// the same habits (TZ=Asia/Singapore, now = 2026-11-19 10:00).
final class ScheduleRulesTests: XCTestCase {
    let math = Fixture.math
    let now = Fixture.now

    private func check(
        _ habit: Habit,
        status: DayStatus,
        streak: Int,
        unit: StreakUnit,
        progress: String,
        due: Int = 0,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        XCTAssertEqual(Rules.todayStatus(habit, now: now, math: math), status, "status", file: file, line: line)
        let s = Rules.streak(habit, now: now, math: math)
        XCTAssertEqual(s.value, streak, "streak", file: file, line: line)
        XCTAssertEqual(s.unit, unit, "unit", file: file, line: line)
        XCTAssertEqual(Labels.progress(habit, now: now, math: math, locale: Fixture.en), progress, "progress", file: file, line: line)
        XCTAssertEqual(Rules.daysUntilDue(habit, now: now, math: math), due, "due", file: file, line: line)
    }

    func testDaily() {
        check(Fixture.habit(done: ["2026-11-16", "2026-11-17", "2026-11-18"]),
              status: .due, streak: 3, unit: .day, progress: "3-day streak")
    }

    func testFixedWeekdaysSkipRestDays() {
        check(Fixture.habit(schedule: .days([1, 3, 5]),
                            done: ["2026-11-09", "2026-11-11", "2026-11-13", "2026-11-16", "2026-11-18"]),
              status: .rest, streak: 5, unit: .day, progress: "Rest day · 5-day streak")
    }

    func testWeeklyQuota() {
        check(Fixture.habit(schedule: .period(.week, times: 3),
                            done: ["2026-11-03", "2026-11-05", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-16", "2026-11-18"]),
              status: .due, streak: 1, unit: .week, progress: "2/3 this week · 1-week streak")
    }

    func testMonthlyQuota() {
        check(Fixture.habit(schedule: .period(.month, times: 2), done: ["2026-10-02", "2026-10-20", "2026-11-03"]),
              status: .due, streak: 1, unit: .month, progress: "1/2 this month · 1-month streak")
    }

    func testInterval() {
        check(Fixture.habit(schedule: .interval(every: 3), done: ["2026-11-12", "2026-11-15", "2026-11-17"]),
              status: .rest, streak: 3, unit: .time, progress: "Due tomorrow · 3 in a row", due: 1)
    }

    func testSkippedDayNeitherCountsNorBreaks() {
        check(Fixture.habit(done: ["2026-11-15", "2026-11-17", "2026-11-18"], skipped: ["2026-11-16"]),
              status: .due, streak: 3, unit: .day, progress: "3-day streak")
    }

    func testDoneToday() {
        check(Fixture.habit(done: ["2026-11-18", "2026-11-19"]),
              status: .done, streak: 2, unit: .day, progress: "2-day streak")
    }

    func testLimit() {
        let habit = Fixture.habit(goalType: .limit, done: ["2026-11-17", "2026-11-18", "2026-11-19"], counts: ["2026-11-19": 1]) {
            $0.amountTarget = 2
            $0.amountUnit = "cups"
        }
        check(habit, status: .done, streak: 3, unit: .day, progress: "1 cups left today · 3-day streak")
    }

    func testNotStarted() {
        XCTAssertEqual(Labels.progress(Fixture.habit(), now: now, math: math), "Not started")
    }

    func testDayTargets() {
        var habit = Fixture.habit(goalType: .time) { $0.durationMinutes = 20 }
        XCTAssertEqual(habit.dayTarget, 1200)
        habit.goalType = .limit
        habit.amountTarget = 0
        XCTAssertTrue(habit.isDayMet(0))
        XCTAssertFalse(habit.isDayMet(1))
    }

    func testScheduleLabels() {
        XCTAssertEqual(Schedule.daily.label, "Every day")
        XCTAssertEqual(Schedule.days([1, 2, 3, 4, 5]).label, "Weekdays")
        XCTAssertEqual(Schedule.days([0, 6]).label, "Weekends")
        XCTAssertEqual(Schedule.days([1, 3, 5]).label, "Mon, Wed, Fri")
        XCTAssertEqual(Schedule.period(.week, times: 3).label, "3× a week")
        XCTAssertEqual(Schedule.interval(every: 4).label, "Every 4 days")
    }

    func testCurrentPart() {
        XCTAssertEqual(DayPart.current(Fixture.date("2026-11-19", 11, 59), math: math), .morning)
        XCTAssertEqual(DayPart.current(Fixture.date("2026-11-19", 12), math: math), .afternoon)
        XCTAssertEqual(DayPart.current(Fixture.date("2026-11-19", 17), math: math), .evening)
    }
}
