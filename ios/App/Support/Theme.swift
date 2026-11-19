import DotsCore
import SwiftUI
import UIKit

extension UIColor {
    convenience init(hex: String) {
        let rgb = Palette.rgb(hex) ?? (0, 0, 0)
        self.init(red: rgb.r, green: rgb.g, blue: rgb.b, alpha: 1)
    }
}

extension Color {
    init(hex: String) {
        self.init(uiColor: UIColor(hex: hex))
    }

    /// A colour that follows light and dark mode.
    init(light: String, dark: String) {
        self.init(uiColor: UIColor { traits in
            UIColor(hex: traits.userInterfaceStyle == .dark ? dark : light)
        })
    }
}

/// Kinari & Sumi: kinari paper, sumi ink and one persimmon accent reserved for
/// "now" (today's dot, a full progress ring, a reached goal). Values match
/// app/globals.css in the web app.
enum Theme {
    static let background = Color(light: "#f5f2ec", dark: "#131211")
    static let card = Color(light: "#ffffff", dark: "#1f1e1c")
    static let ink = Color(light: "#16171c", dark: "#f2efe8")
    static let muted = Color(light: "#ebe7df", dark: "#292826")
    static let mutedText = Color(light: "#5c5a55", dark: "#a6a39c")
    static let subtle = Color(light: "#8a8780", dark: "#77746e")
    static let border = Color(light: "#e3ded5", dark: "#34322f")
    /// Selected segment in the floating switcher.
    static let thumb = Color(light: "#ffffff", dark: "#3d3b38")
    static let accent = Color(light: "#e1602f", dark: "#f07a4f")
    static let accentText = Color(light: "#b4461c", dark: "#f07a4f")
    static let accentSoft = Color(light: "#f8e1d6", dark: "#3a2419")
    /// Glyphs drawn on a habit colour.
    static let onTint = Color(light: "#ffffff", dark: "#131211")
    static let destructive = Color(light: "#c2361f", dark: "#f07a6a")

    /// A habit's colour. Brand pigments swap to their lighter value in dark mode.
    static func tint(_ hex: String) -> Color {
        let t = Palette.tint(hex)
        return Color(light: t.light, dark: t.dark)
    }
}

/// The brand squircle: corners at 32% of the side, continuous like iOS icons.
struct Squircle: Shape {
    func path(in rect: CGRect) -> Path {
        RoundedRectangle(cornerRadius: min(rect.width, rect.height) * 0.32, style: .continuous).path(in: rect)
    }
}

/// White (or dark) rounded card on the kinari background.
struct CardStyle: ViewModifier {
    var padding: CGFloat = 16

    func body(content: Content) -> some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
    }
}

extension View {
    func card(padding: CGFloat = 16) -> some View { modifier(CardStyle(padding: padding)) }

    /// Small uppercase section title, like the web app's.
    func sectionTitleStyle() -> some View {
        font(.system(size: 13, weight: .semibold))
            .tracking(0.4)
            .textCase(.uppercase)
            .foregroundStyle(Theme.mutedText)
    }
}

/// Springy press feedback for custom buttons.
struct PressableStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.92 : 1)
            .animation(.spring(response: 0.25, dampingFraction: 0.6), value: configuration.isPressed)
    }
}

enum Haptics {
    @MainActor static func light() { UIImpactFeedbackGenerator(style: .light).impactOccurred() }
    @MainActor static func success() { UINotificationFeedbackGenerator().notificationOccurred(.success) }
    @MainActor static func selection() { UISelectionFeedbackGenerator().selectionChanged() }
}
