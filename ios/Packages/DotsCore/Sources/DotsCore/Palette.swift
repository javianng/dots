import Foundation

/// Kinari & Sumi: the javian ng brand colours, as hex strings (light, dark).
/// Mirrors app/globals.css and lib/palette.ts.
public enum Palette {
    public struct Pigment: Sendable, Identifiable, Equatable {
        public let key: String
        public let name: String
        /// The value habits store (the light pigment).
        public let hex: String
        /// The lighter value dark mode swaps in.
        public let darkHex: String
        public var id: String { key }
    }

    /// 12 muted pigments; habits store `hex`.
    public static let habitColors: [Pigment] = [
        Pigment(key: "ink", name: "Ink", hex: "#22242e", darkHex: "#e8e4de"),
        Pigment(key: "slate", name: "Slate", hex: "#4f5d70", darkHex: "#9aa8bb"),
        Pigment(key: "indigo", name: "Indigo", hex: "#4a58a8", darkHex: "#8e9be6"),
        Pigment(key: "violet", name: "Violet", hex: "#7059ae", darkHex: "#a995e3"),
        Pigment(key: "plum", name: "Plum", hex: "#97497f", darkHex: "#d58cbe"),
        Pigment(key: "rose", name: "Rose", hex: "#bc4560", darkHex: "#ee8ca0"),
        Pigment(key: "brick", name: "Brick", hex: "#b8502f", darkHex: "#ec8f6c"),
        Pigment(key: "ochre", name: "Ochre", hex: "#9c6b12", darkHex: "#ddae55"),
        Pigment(key: "olive", name: "Olive", hex: "#69752a", darkHex: "#aebb68"),
        Pigment(key: "moss", name: "Moss", hex: "#3b7a4b", darkHex: "#7fbe8e"),
        Pigment(key: "teal", name: "Teal", hex: "#2c7873", darkHex: "#6fbcb5"),
        Pigment(key: "sky", name: "Sky", hex: "#2e6f9e", darkHex: "#78b2dd"),
    ]

    /// New habits start in Ink, monochrome like the app icon.
    public static let defaultHex = "#22242e"

    /// (light, dark) for a stored habit colour. Older habits saved with another
    /// hex keep that exact colour in both themes.
    public static func tint(_ hex: String) -> (light: String, dark: String) {
        if let pigment = habitColors.first(where: { $0.hex.caseInsensitiveCompare(hex) == .orderedSame }) {
            return (pigment.hex, pigment.darkHex)
        }
        return (hex, hex)
    }

    public static func name(_ hex: String) -> String {
        habitColors.first { $0.hex.caseInsensitiveCompare(hex) == .orderedSame }?.name ?? hex
    }

    /// RGB 0–1 from "#rrggbb" (or "#rgb"); nil if unreadable.
    public static func rgb(_ hex: String) -> (r: Double, g: Double, b: Double)? {
        var s = hex.trimmingCharacters(in: .whitespaces)
        if s.hasPrefix("#") { s.removeFirst() }
        if s.count == 3 { s = s.map { "\($0)\($0)" }.joined() }
        guard s.count == 6, let v = UInt32(s, radix: 16) else { return nil }
        return (Double((v >> 16) & 0xff) / 255, Double((v >> 8) & 0xff) / 255, Double(v & 0xff) / 255)
    }
}

/// Habit icons: the web app stores lucide icon keys; the phone draws the
/// closest SF Symbol. Order matters (it's used for the legacy fallback pick).
public enum HabitIcons {
    public static let all: [(key: String, symbol: String)] = [
        ("dumbbell", "dumbbell.fill"),
        ("footprints", "figure.walk"),
        ("bike", "bicycle"),
        ("book", "book.fill"),
        ("pen", "pencil"),
        ("code", "chevron.left.forwardslash.chevron.right"),
        ("brain", "brain.head.profile"),
        ("graduation", "graduationcap.fill"),
        ("palette", "paintpalette.fill"),
        ("music", "music.note"),
        ("camera", "camera.fill"),
        ("heart", "heart.fill"),
        ("droplets", "drop.fill"),
        ("apple", "carrot.fill"),
        ("utensils", "fork.knife"),
        ("coffee", "cup.and.saucer.fill"),
        ("moon", "moon.fill"),
        ("bed", "bed.double.fill"),
        ("sun", "sun.max.fill"),
        ("sunrise", "sunrise.fill"),
        ("leaf", "leaf.fill"),
        ("flower", "camera.macro"),
        ("sprout", "tree.fill"),
        ("target", "target"),
        ("flame", "flame.fill"),
        ("zap", "bolt.fill"),
        ("star", "star.fill"),
        ("smile", "face.smiling"),
        ("wallet", "creditcard.fill"),
        ("dog", "dog.fill"),
    ]

    public static var keys: [String] { all.map(\.key) }
    public static let defaultKey = "dumbbell"

    public static func symbol(_ key: String) -> String {
        all.first { $0.key == key }?.symbol ?? "circle.fill"
    }

    /// Same as JS: `hash = (hash * 31 + charCode) | 0`, then `Math.abs`.
    public static func hashString(_ value: String) -> Int {
        var hash: Int32 = 0
        for unit in value.utf16 { hash = hash &* 31 &+ Int32(unit) }
        return abs(Int(hash))
    }

    /// The stored icon when it's a known key; otherwise a stable pick from the
    /// habit id, so legacy habits (no stored icon) still get the same icon as on the web.
    public static func resolve(_ icon: String?, habitID: String) -> String {
        if let icon, keys.contains(icon) { return icon }
        return keys[hashString(habitID) % keys.count]
    }
}

/// Starter habits on the New Habit sheet (lib/templates.ts).
public enum HabitTemplates {
    public struct Template: Identifiable, Sendable {
        public let id: String
        public let draft: HabitDraft
    }

    public static let all: [Template] = [
        Template(id: "water", draft: HabitDraft(name: "Drink water", icon: "droplets", colorHex: "#2e6f9e", goalType: .amount, amountTarget: 2000, amountUnit: "ml", amountStep: 250)),
        Template(id: "teeth", draft: HabitDraft(name: "Brush teeth", icon: "smile", colorHex: "#2c7873", completionsPerDay: 2, parts: [.morning, .evening])),
        Template(id: "read", draft: HabitDraft(name: "Read", icon: "book", colorHex: "#4a58a8", goalType: .time, durationMinutes: 20, parts: [.evening])),
        Template(id: "meditate", draft: HabitDraft(name: "Meditate", icon: "brain", colorHex: "#7059ae", goalType: .time, durationMinutes: 10, parts: [.morning])),
        Template(id: "walk", draft: HabitDraft(name: "Walk", icon: "footprints", colorHex: "#3b7a4b", goalType: .amount, amountTarget: 8000, amountUnit: "steps", amountStep: 1000)),
        Template(id: "workout", draft: HabitDraft(name: "Work out", icon: "dumbbell", colorHex: "#b8502f", schedule: .period(.week, times: 3))),
        Template(id: "vitamins", draft: HabitDraft(name: "Take vitamins", icon: "heart", colorHex: "#bc4560", parts: [.morning])),
        Template(id: "journal", draft: HabitDraft(name: "Journal", icon: "pen", colorHex: "#9c6b12", parts: [.evening])),
        Template(id: "plants", draft: HabitDraft(name: "Water plants", icon: "sprout", colorHex: "#69752a", schedule: .interval(every: 3))),
        Template(id: "family", draft: HabitDraft(name: "Call family", icon: "heart", colorHex: "#97497f", schedule: .period(.week, times: 1))),
        Template(id: "coffee", draft: HabitDraft(name: "Coffee", icon: "coffee", colorHex: "#4f5d70", goalType: .limit, amountTarget: 2, amountUnit: "cups")),
        Template(id: "junk", draft: HabitDraft(name: "No junk food", icon: "utensils", colorHex: "#22242e", goalType: .limit, amountTarget: 0, amountUnit: "snacks")),
    ]
}
