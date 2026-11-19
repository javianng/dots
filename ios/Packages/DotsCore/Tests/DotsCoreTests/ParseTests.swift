import XCTest
@testable import DotsCore

final class ParseTests: XCTestCase {
    let math = Fixture.math

    func testDayKeys() {
        XCTAssertEqual(math.key(Fixture.now), "2026-11-19")
        XCTAssertEqual(math.weekday(Fixture.now), 4) // Thursday
        XCTAssertNil(math.date("2026-02-30"))
        XCTAssertNil(math.date("2026-2-3"))
        XCTAssertEqual(math.key(math.periodStart(Fixture.now, .week)), "2026-11-16")
        XCTAssertEqual(math.key(math.periodStart(Fixture.now, .month)), "2026-11-01")
        XCTAssertEqual(math.daysBetween("2026-11-12", Fixture.now), 7)
    }

    func testHeatmapEndsOnTodaysWeek() {
        let weeks = math.heatmapWeeks(26, now: Fixture.now)
        XCTAssertEqual(weeks.count, 26)
        XCTAssertEqual(math.key(weeks.last![0]), "2026-11-16")
        XCTAssertTrue(weeks.last!.map(math.key).contains("2026-11-19"))
    }

    func testMonthGridPadsToMonday() {
        let cells = math.monthGrid(Fixture.now)
        XCTAssertEqual(cells.count % 7, 0)
        // 1 Nov 2026 is a Sunday: six blank cells first.
        XCTAssertNil(cells[5])
        XCTAssertEqual(math.key(cells[6]!), "2026-11-01")
    }

    func testSchedules() {
        XCTAssertEqual(Rules.parseSchedule(nil), .daily)
        XCTAssertEqual(Rules.parseSchedule(Fixture.dict(["type": "days", "days": [5, 1, 3, 3, 9]])), .days([1, 3, 5]))
        XCTAssertEqual(Rules.parseSchedule(Fixture.dict(["type": "days", "days": [0, 1, 2, 3, 4, 5, 6]])), .daily)
        XCTAssertEqual(Rules.parseSchedule(Fixture.dict(["type": "period", "period": "week", "times": 9])), .period(.week, times: 6))
        XCTAssertEqual(Rules.parseSchedule(Fixture.dict(["type": "interval", "every": 1])), .daily)
        XCTAssertEqual(Rules.parseSchedule(Fixture.dict(["type": "interval", "every": 3.0])), .interval(every: 3))
    }

    func testPartsAndNumbers() {
        XCTAssertEqual(Rules.parseParts(["evening", "morning", "noon"]), [.morning, .evening])
        XCTAssertNil(Parse.number(true))
        XCTAssertEqual(Parse.number(3), 3)
        XCTAssertEqual(Parse.number(2.5), 2.5)
        XCTAssertNil(Parse.number("3"))
    }

    func testMetaDefaults() {
        let habit = HabitParser.meta(id: "a", data: ["name": "Read", "goalType": "nope", "streakGoal": NSNull()], createdAt: nil)
        XCTAssertEqual(habit.goalType, .count)
        XCTAssertEqual(habit.completionsPerDay, 1)
        XCTAssertEqual(habit.durationMinutes, 15)
        XCTAssertNil(habit.streakGoal)
        XCTAssertNil(habit.timer)
    }

    func testMergeCompletions() {
        let meta = HabitParser.meta(id: "a", data: ["name": "Water", "goalType": "amount", "amountTarget": 2000, "amountStep": 250], createdAt: Fixture.date("2026-11-01"))
        let habit = HabitParser.habit(meta, days: [
            "2026-11-17": DayDoc(count: 2000),
            "2026-11-18": DayDoc(count: 500),
            "2026-11-19": DayDoc(count: 0, skipped: true),
            "2026-10-01": DayDoc(count: nil), // legacy check-off
        ], now: Fixture.now, math: math)
        XCTAssertEqual(habit.history["2026-11-17"], true)
        XCTAssertEqual(habit.history["2026-11-18"], false)
        XCTAssertEqual(habit.counts["2026-11-18"], 500)
        XCTAssertTrue(habit.skipped.contains("2026-11-19"))
        XCTAssertNil(habit.history["2026-11-19"])
        XCTAssertEqual(habit.history["2026-10-01"], true)
    }

    func testLimitKeptOnEmptyDays() {
        let meta = HabitParser.meta(id: "a", data: ["name": "Coffee", "goalType": "limit", "amountTarget": 2], createdAt: Fixture.date("2026-11-17", 9))
        let habit = HabitParser.habit(meta, days: ["2026-11-18": DayDoc(count: 3)], now: Fixture.now, math: math)
        XCTAssertEqual(habit.history["2026-11-17"], true)
        XCTAssertEqual(habit.history["2026-11-18"], false)
        XCTAssertEqual(habit.history["2026-11-19"], true)
        XCTAssertNil(habit.history["2026-11-16"])
    }

    func testDayDocFromData() {
        let doc = DayDoc(data: ["count": 2, "completed": true, "slots": ["evening", "morning"]])
        XCTAssertEqual(doc.count, 2)
        XCTAssertEqual(doc.slots, [.morning, .evening])
        XCTAssertFalse(doc.skipped)
    }

    func testEncodeDraft() {
        let fields = Encode.draft(HabitDraft(name: "Run", amountTarget: 2.5, schedule: .period(.week, times: 3), parts: [.morning]))
        XCTAssertEqual(fields["name"] as? String, "Run")
        XCTAssertTrue(fields["streakGoal"] is NSNull)
        XCTAssertEqual(fields["amountTarget"] as? Double, 2.5)
        XCTAssertEqual(fields["amountStep"] as? Int, 1)
        XCTAssertEqual(fields["parts"] as? [String], ["morning"])
        let schedule = fields["schedule"] as? [String: Any]
        XCTAssertEqual(schedule?["type"] as? String, "period")
        XCTAssertEqual(schedule?["period"] as? String, "week")
        XCTAssertEqual(schedule?["times"] as? Int, 3)
        // Round trip.
        XCTAssertEqual(Rules.parseSchedule(schedule), .period(.week, times: 3))
    }

    func testIconsMatchTheWebApp() {
        // Values from lib/habit-icons.ts hashString.
        XCTAssertEqual(HabitIcons.hashString("abc"), 96354)
        XCTAssertEqual(HabitIcons.hashString("Zx0zYTFJuMpJx1c4"), 966453693)
        XCTAssertEqual(HabitIcons.hashString("habit-123"), 1847166375)
        XCTAssertEqual(HabitIcons.keys.count, 30)
        XCTAssertEqual(HabitIcons.resolve(nil, habitID: "habit-123"), HabitIcons.keys[15])
        XCTAssertEqual(HabitIcons.resolve("book", habitID: "habit-123"), "book")
        XCTAssertEqual(HabitIcons.resolve("unknown", habitID: "abc"), HabitIcons.keys[24])
    }

    func testPalette() {
        XCTAssertEqual(Palette.tint("#4A58A8").dark, "#8e9be6")
        XCTAssertEqual(Palette.tint("#123456").dark, "#123456")
        XCTAssertEqual(Palette.rgb("#ffffff")?.r, 1)
    }
}
