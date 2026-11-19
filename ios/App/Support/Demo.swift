import DotsCore
import Foundation

/// Demo mode: launch with `-demo` to run on sample habits with no Firebase
/// (used by CI to screenshot the app; handy in the simulator too).
/// `-demoScreen auth|main|detail|form|settings` and `-demoTab grid|list|compact|life`
/// pick what opens first.
enum Demo {
    static let isOn = ProcessInfo.processInfo.arguments.contains("-demo")

    static var screen: String { value(after: "-demoScreen") ?? "main" }
    static var tab: String? { value(after: "-demoTab") }

    private static func value(after flag: String) -> String? {
        let args = ProcessInfo.processInfo.arguments
        guard let i = args.firstIndex(of: flag), i + 1 < args.count else { return nil }
        return args[i + 1]
    }

    static let life = LifeProfile(birthDate: "1998-03-10", lifeExpectancy: 90)

    /// Sample habits with a few months of believable history.
    static func habits(now: Date = Date(), math: DayMath = .current) -> [Habit] {
        var generator = SeededGenerator(seed: 7)
        func history(_ rate: Double, days: Int = 180, schedule: Schedule = .daily, skipToday: Bool = true) -> [String: Bool] {
            var result: [String: Bool] = [:]
            for back in 0..<days {
                if back == 0 && skipToday { continue }
                let day = math.addDays(now, -back)
                guard schedule.isScheduledDay(day, math: math) else { continue }
                if Double.random(in: 0..<1, using: &generator) < rate { result[math.key(day)] = true }
            }
            return result
        }
        func counts(_ history: [String: Bool], value: Double) -> [String: Double] {
            history.filter { $0.value }.mapValues { _ in value }
        }
        let today = math.key(now)
        let created = math.addDays(now, -200)

        var water = Habit(id: "water", name: "Drink water", icon: "droplets", colorHex: "#2e6f9e", goalType: .amount, amountTarget: 2000, amountUnit: "ml", amountStep: 250, createdAt: created)
        water.history = history(0.8)
        water.counts = counts(water.history, value: 2000)
        water.counts[today] = 1250
        water.history[today] = false

        var teeth = Habit(id: "teeth", name: "Brush teeth", icon: "smile", colorHex: "#2c7873", completionsPerDay: 2, parts: [.morning, .evening], createdAt: created)
        teeth.history = history(0.92)
        teeth.counts = counts(teeth.history, value: 2)
        teeth.slots[today] = [.morning]
        teeth.counts[today] = 1

        var read = Habit(id: "read", name: "Read", icon: "book", colorHex: "#4a58a8", goalType: .time, durationMinutes: 20, parts: [.evening], createdAt: created)
        read.history = history(0.7)
        read.counts = counts(read.history, value: 1200)

        var meditate = Habit(id: "meditate", name: "Meditate", icon: "brain", colorHex: "#7059ae", goalType: .time, durationMinutes: 10, parts: [.morning], createdAt: created)
        meditate.history = history(0.75, skipToday: false)
        meditate.counts = counts(meditate.history, value: 600)
        meditate.history[today] = true
        meditate.counts[today] = 600

        let gym = Schedule.period(.week, times: 3)
        var workout = Habit(id: "workout", name: "Work out", icon: "dumbbell", colorHex: "#b8502f", streakGoal: 12, schedule: gym, createdAt: created)
        workout.history = history(0.5)

        var plants = Habit(id: "plants", name: "Water plants", icon: "sprout", colorHex: "#69752a", schedule: .interval(every: 3), createdAt: created)
        for back in stride(from: 1, to: 180, by: 3) { plants.history[math.key(math.addDays(now, -back))] = true }

        var coffee = Habit(id: "coffee", name: "Coffee", icon: "coffee", colorHex: "#4f5d70", goalType: .limit, amountTarget: 2, amountUnit: "cups", createdAt: created)
        var coffeeDays: [String: DayDoc] = [:]
        for back in 0..<120 where Double.random(in: 0..<1, using: &generator) < 0.4 {
            coffeeDays[math.key(math.addDays(now, -back))] = DayDoc(count: Double(Int.random(in: 1...3, using: &generator)))
        }
        coffee = HabitParser.habit(coffee, days: coffeeDays, now: now, math: math)

        return [teeth, meditate, water, workout, read, plants, coffee]
    }
}

/// Deterministic random numbers, so demo screenshots don't change between runs.
struct SeededGenerator: RandomNumberGenerator {
    private var state: UInt64
    init(seed: UInt64) { state = seed &+ 0x9E37_79B9_7F4A_7C15 }

    mutating func next() -> UInt64 {
        state &+= 0x9E37_79B9_7F4A_7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58_476D_1CE4_E5B9
        z = (z ^ (z >> 27)) &* 0x94D0_49BB_1331_11EB
        return z ^ (z >> 31)
    }
}
