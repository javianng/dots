import XCTest
@testable import DotsCore

final class CheckInTests: XCTestCase {
    let math = Fixture.math
    let now = Fixture.now
    let today = "2026-11-19"

    func testCheckOffAndUndo() {
        var habit = Fixture.habit()
        let tap = CheckIn.tap(habit, today, now: now, math: math)
        XCTAssertEqual(tap.writes, [.setDay(dateKey: today, count: 1, completed: true, slots: nil)])
        XCTAssertEqual(tap.feedback, .celebrate(dateKey: today))

        habit = habit.applying(tap)
        XCTAssertEqual(habit.history[today], true)
        let undo = CheckIn.tap(habit, today, now: now, math: math)
        XCTAssertEqual(undo.writes, [.deleteDay(dateKey: today)])
    }

    func testCountedTaps() {
        let habit = Fixture.habit { $0.completionsPerDay = 3 }
        let first = CheckIn.tap(habit, today, now: now, math: math)
        XCTAssertEqual(first.writes, [.setDay(dateKey: today, count: 1, completed: false, slots: nil)])
        XCTAssertEqual(first.feedback, .light)
    }

    func testAmountSteps() {
        let habit = Fixture.habit(goalType: .amount, counts: [today: 1750]) {
            $0.amountTarget = 2000
            $0.amountStep = 250
        }
        let tap = CheckIn.tap(habit, today, now: now, math: math)
        XCTAssertEqual(tap.writes, [.setDay(dateKey: today, count: 2000, completed: true, slots: nil)])
        XCTAssertEqual(tap.feedback, .celebrate(dateKey: today))
        XCTAssertEqual(CheckIn.setAmount(habit, today, -5).writes, [.deleteDay(dateKey: today)])
    }

    func testLimitNeverCelebrates() {
        let habit = Fixture.habit(goalType: .limit) { $0.amountTarget = 2 }
        let tap = CheckIn.tap(habit, today, now: now, math: math)
        XCTAssertEqual(tap.writes, [.setDay(dateKey: today, count: 1, completed: true, slots: nil)])
        XCTAssertEqual(tap.feedback, .light)
    }

    func testTimerPlayPauseAndOtherDays() {
        let habit = Fixture.habit(goalType: .time) { $0.durationMinutes = 10 }
        let play = CheckIn.tap(habit, today, now: now, math: math)
        let started = (now.timeIntervalSince1970 * 1000).rounded()
        XCTAssertEqual(play.writes, [.startTimer(RunningTimer(startedAt: started, dateKey: today))])

        let running = habit.applying(play)
        let later = now.addingTimeInterval(4 * 60)
        XCTAssertEqual(CheckIn.elapsedSeconds(running, today, now: later), 240)
        XCTAssertEqual(CheckIn.timerEnd(running), now.addingTimeInterval(600))
        let pause = CheckIn.tap(running, today, now: later, math: math)
        XCTAssertEqual(pause.writes, [.stopTimer(dateKey: today, seconds: 240, completed: false)])

        let finished = CheckIn.pause(running, now: now.addingTimeInterval(900))
        XCTAssertEqual(finished.writes, [.stopTimer(dateKey: today, seconds: 600, completed: true)])
        XCTAssertEqual(finished.feedback, .celebrate(dateKey: today))

        let yesterday = CheckIn.tap(habit, "2026-11-18", now: now, math: math)
        XCTAssertEqual(yesterday.writes, [.setDay(dateKey: "2026-11-18", count: 600, completed: true, slots: nil)])
    }

    func testSlots() {
        let habit = Fixture.habit { $0.parts = [.morning, .evening]; $0.completionsPerDay = 2 }
        XCTAssertTrue(CheckIn.usesSlots(habit))
        let morning = CheckIn.tap(habit, today, part: .morning, now: now, math: math)
        XCTAssertEqual(morning.writes, [.setDay(dateKey: today, count: 1, completed: false, slots: [.morning])])

        var both = habit
        both.slots[today] = [.morning]
        both.counts[today] = 1
        let evening = CheckIn.tap(both, today, now: now, math: math)
        XCTAssertEqual(evening.writes, [.setDay(dateKey: today, count: 2, completed: true, slots: [.morning, .evening])])
        XCTAssertEqual(evening.feedback, .celebrate(dateKey: today))
    }

    func testSkipStopsARunningTimer() {
        let habit = Fixture.habit(goalType: .time) { $0.timer = RunningTimer(startedAt: 0, dateKey: "2026-11-19") }
        let skip = CheckIn.toggleSkip(habit, today)
        XCTAssertEqual(skip.writes, [.stopTimer(dateKey: today, seconds: 0, completed: false), .skipDay(dateKey: today)])
        let unskip = CheckIn.toggleSkip(Fixture.habit(skipped: [today]), today)
        XCTAssertEqual(unskip.writes, [.deleteDay(dateKey: today)])
    }

    func testGoalTypeChangeKeepsFinishedDays() {
        let habit = Fixture.habit(done: ["2026-11-17"], counts: ["2026-11-17": 1]) {
            $0.history["2026-11-18"] = false
        }
        var draft = habit.draft
        draft.goalType = .time
        draft.durationMinutes = 20
        XCTAssertEqual(CheckIn.goalTypeChange(from: habit, to: draft), [
            .mergeDay(dateKey: "2026-11-17", count: 1200, completed: true),
            .deleteDay(dateKey: "2026-11-18"),
        ])
        draft.goalType = .limit
        XCTAssertEqual(CheckIn.goalTypeChange(from: habit, to: draft), [
            .deleteDay(dateKey: "2026-11-17"),
            .deleteDay(dateKey: "2026-11-18"),
        ])
    }

    func testCelebrationText() {
        let habit = Fixture.habit(done: ["2026-11-17", "2026-11-18"])
        let text = Labels.celebration(habit, dateKey: today, now: now, math: math)
        XCTAssertEqual(text.subtitle, "Done for today · 3-day streak")
        var goal = habit
        goal.streakGoal = 3
        XCTAssertEqual(Labels.celebration(goal, dateKey: today, now: now, math: math).title, "Goal reached!")
    }

    func testLabels() {
        XCTAssertEqual(Labels.goal(HabitDraft(goalType: .amount, amountTarget: 2000, amountUnit: "ml"), locale: Fixture.en), "2,000 ml")
        XCTAssertEqual(Labels.goal(HabitDraft(goalType: .time, durationMinutes: 90)), "1 h 30 min")
        XCTAssertEqual(Labels.goal(HabitDraft(goalType: .limit, amountTarget: 0, amountUnit: "snacks")), "No snacks")
        XCTAssertEqual(Labels.parts([.morning, .afternoon, .evening]), "Morning, afternoon & evening")
        XCTAssertEqual(Labels.parts([]), "Any time")
        XCTAssertEqual(Labels.clock(3930), "1:05:30")
        XCTAssertEqual(Labels.clock(1500), "25:00")
        XCTAssertEqual(Labels.compact(1500), "1.5k")
        XCTAssertEqual(Labels.compact(12_400), "12k")
        XCTAssertEqual(Labels.amount(2.5, locale: Fixture.en), "2.5")
    }
}

final class TodayTests: XCTestCase {
    func testSectionsByTimeOfDay() {
        var teeth = Fixture.habit { $0.parts = [.morning, .evening]; $0.completionsPerDay = 2 }
        teeth.id = "teeth"
        var read = Fixture.habit { $0.parts = [.evening] }
        read.id = "read"
        var any = Fixture.habit()
        any.id = "any"
        let sections = Today.sections([teeth, read, any], now: Fixture.now, math: Fixture.math)
        XCTAssertEqual(sections.map(\.key), ["morning", "evening", "any"])
        XCTAssertTrue(sections[0].isNow)
        XCTAssertEqual(sections[0].items.first?.part, .morning)

        teeth.slots["2026-11-19"] = [.morning]
        let later = Today.sections([teeth, read], now: Fixture.now, math: Fixture.math)
        XCTAssertEqual(later.map(\.key), ["evening"])
        XCTAssertEqual(later[0].items.map(\.id), ["teeth", "read"])
    }

    func testNoTimesOfDayMeansOneSection() {
        let sections = Today.sections([Fixture.habit()], now: Fixture.now, math: Fixture.math)
        XCTAssertEqual(sections.count, 1)
        XCTAssertNil(sections[0].label)
    }

    func testSummarySkipsRestDays() {
        let habits = [Fixture.habit(done: ["2026-11-19"]), Fixture.habit(), Fixture.habit(schedule: .days([1]))]
        let s = Today.summary(habits, now: Fixture.now, math: Fixture.math)
        XCTAssertEqual(s.done, 1)
        XCTAssertEqual(s.total, 2)
    }
}
