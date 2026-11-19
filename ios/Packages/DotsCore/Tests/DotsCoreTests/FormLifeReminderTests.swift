import XCTest
@testable import DotsCore

final class HabitFormTests: XCTestCase {
    func testNewFormNeedsAName() {
        var form = HabitForm()
        XCTAssertEqual(form.problem, "Give it a name.")
        form.name = "  Read  "
        XCTAssertNil(form.problem)
        XCTAssertEqual(form.draft.name, "Read")
    }

    func testSeveralTimesOfDayMeanOneCheckEach() {
        var form = HabitForm(HabitDraft(name: "Teeth"))
        form.togglePart(.evening)
        form.togglePart(.morning)
        XCTAssertEqual(form.parts, [.morning, .evening])
        XCTAssertEqual(form.draft.completionsPerDay, 2)
        form.changeGoalType(.time)
        XCTAssertEqual(form.parts, [.morning])
        form.togglePart(.evening)
        XCTAssertEqual(form.parts, [.evening])
    }

    func testAmountValidation() {
        var form = HabitForm(HabitDraft(name: "Water"))
        form.changeGoalType(.amount)
        XCTAssertEqual(form.amountTarget, "10")
        form.amountTarget = "0"
        XCTAssertEqual(form.problem, "Set a daily target above 0.")
        form.amountTarget = "2,5"
        XCTAssertNil(form.problem)
        XCTAssertEqual(form.draft.amountTarget, 2.5)
        form.changeGoalType(.limit)
        form.amountTarget = "0"
        XCTAssertNil(form.problem)
        form.amountStep = "0"
        XCTAssertEqual(form.problem, "Each tap needs to add more than 0.")
    }

    func testSchedules() {
        var form = HabitForm(HabitDraft(name: "Gym"))
        form.repeatKind = .days
        form.days = []
        XCTAssertEqual(form.problem, "Pick at least one day.")
        form.days = [5, 1]
        XCTAssertEqual(form.draft.schedule, .days([1, 5]))
        form.repeatKind = .week
        form.times = 9
        XCTAssertEqual(form.draft.schedule, .period(.week, times: 6))
        XCTAssertEqual(HabitForm(HabitDraft(name: "a", schedule: .interval(every: 4))).repeatKind, .interval)
    }

    func testDurationSteps() {
        var form = HabitForm(HabitDraft(name: "Read", goalType: .time, durationMinutes: 15))
        form.longer()
        XCTAssertEqual(form.durationMinutes, 20)
        form.shorter()
        form.shorter()
        XCTAssertEqual(form.durationMinutes, 10)
    }

    func testRoundTripFromHabit() {
        let draft = HabitDraft(name: "Walk", icon: "footprints", goalType: .amount, amountTarget: 8000, amountUnit: "steps", amountStep: 1000, schedule: .days([1, 3]))
        XCTAssertEqual(HabitForm(draft).draft, draft)
    }
}

final class LifeTests: XCTestCase {
    let math = Fixture.math

    func testStats() {
        let stats = Life.stats(LifeProfile(birthDate: "1998-03-10", lifeExpectancy: 90), today: Fixture.now, math: math)
        XCTAssertEqual(stats.ageYears, 28)
        XCTAssertEqual(stats.weekOfYear, 36)
        XCTAssertEqual(stats.currentWeek, 28 * 52 + 36)
        XCTAssertEqual(stats.totalWeeks, 4680)
    }

    func testValidation() {
        XCTAssertEqual(Life.validate(LifeProfile(birthDate: "2030-01-01", lifeExpectancy: 90), today: Fixture.now, math: math), "Your birthday can't be in the future.")
        XCTAssertEqual(Life.validate(LifeProfile(birthDate: "1998-03-10", lifeExpectancy: 20), today: Fixture.now, math: math), "You're already 28 — set a life expectancy above that.")
        XCTAssertNil(Life.validate(LifeProfile(birthDate: "1998-03-10", lifeExpectancy: 90), today: Fixture.now, math: math))
    }

    func testParse() {
        XCTAssertEqual(LifeProfile(userData: ["life": Fixture.dict(["birthDate": "1998-03-10", "lifeExpectancy": 85])], math: math)?.lifeExpectancy, 85)
        XCTAssertNil(LifeProfile(userData: ["life": Fixture.dict(["birthDate": "nope", "lifeExpectancy": 85])], math: math))
    }
}

final class ReminderPlannerTests: XCTestCase {
    let math = Fixture.math
    let settings = ReminderPlanner.Settings(enabled: true, time: 20 * 60, morningEnabled: true, morningTime: 7 * 60 + 30)

    func testTodayCountsWhatsLeft() {
        let habits = [Fixture.habit(), Fixture.habit(done: ["2026-11-19"])]
        let plan = ReminderPlanner.plan(habits: habits, settings: settings, now: Fixture.now, days: 1, math: math)
        XCTAssertEqual(plan.count, 1) // the morning reminder has passed
        XCTAssertEqual(plan[0].id, "dots-reminder-daily-2026-11-19")
        XCTAssertEqual(plan[0].body, "One habit left to fill in today.")
        XCTAssertEqual(plan[0].fireDate, Fixture.date("2026-11-19", 20))
    }

    func testNothingLeftMeansNoReminder() {
        let plan = ReminderPlanner.plan(habits: [Fixture.habit(done: ["2026-11-19"])], settings: settings, now: Fixture.now, days: 2, math: math)
        XCTAssertEqual(plan.map(\.id), ["dots-reminder-daily-2026-11-20"])
    }

    func testMorningOnlyForMorningHabits() {
        var morning = Fixture.habit()
        morning.parts = [.morning]
        let plan = ReminderPlanner.plan(habits: [morning], settings: settings, now: Fixture.date("2026-11-19", 6), days: 1, math: math)
        XCTAssertEqual(plan.map(\.body), ["One morning habit to fill in.", "Your habit is still waiting for today's dot."])
    }

    func testRestDaysAndLimitsDontNag() {
        let rest = Fixture.habit(schedule: .days([1])) // Mondays only; 19 Nov is a Thursday
        let limit = Fixture.habit(goalType: .limit)
        let plan = ReminderPlanner.plan(habits: [rest, limit], settings: settings, now: Fixture.now, days: 1, math: math)
        XCTAssertTrue(plan.isEmpty)
    }

    func testOff() {
        XCTAssertTrue(ReminderPlanner.plan(habits: [Fixture.habit()], settings: .init(enabled: false), now: Fixture.now, math: math).isEmpty)
    }
}
