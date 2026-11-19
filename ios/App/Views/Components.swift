import DotsCore
import SwiftUI

/// The dots mark: a 3×3 heatmap, today in persimmon.
struct DotsMark: View {
    var size: CGFloat = 28

    private let pattern: [[Character]] = [["I", ".", "I"], ["I", "I", "."], ["I", "I", "K"]]

    var body: some View {
        let tile = size / (3 + 0.4)
        let gap = tile * 0.2
        VStack(spacing: gap) {
            ForEach(0..<3, id: \.self) { row in
                HStack(spacing: gap) {
                    ForEach(0..<3, id: \.self) { col in
                        Squircle()
                            .fill(color(pattern[row][col]))
                            .frame(width: tile, height: tile)
                    }
                }
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }

    private func color(_ code: Character) -> Color {
        switch code {
        case "K": Theme.accent
        case ".": Theme.border
        default: Theme.ink
        }
    }
}

/// A habit's icon on its colour, in a squircle.
struct HabitIconView: View {
    let habit: Habit
    var size: CGFloat = 40

    var body: some View {
        Image(systemName: HabitIcons.symbol(HabitIcons.resolve(habit.icon, habitID: habit.id)))
            .font(.system(size: size * 0.45, weight: .semibold))
            .foregroundStyle(Theme.onTint)
            .frame(width: size, height: size)
            .background(Theme.tint(habit.colorHex), in: Squircle())
            .accessibilityHidden(true)
    }
}

/// Today's progress, like Apple Fitness. Persimmon once everything's done.
struct ProgressRingView: View {
    var value: Double
    var size: CGFloat = 56
    var lineWidth: CGFloat = 7

    var body: some View {
        ZStack {
            Circle().stroke(Theme.ink.opacity(0.1), lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: max(0, min(1, value)))
                .stroke(value >= 1 ? Theme.accent : Theme.ink, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .opacity(value == 0 ? 0 : 1)
        }
        .frame(width: size, height: size)
        .animation(.spring(response: 0.6, dampingFraction: 0.75), value: value)
        .accessibilityLabel("\(Int((value * 100).rounded()))% of today's habits done")
    }
}

/// "Offline" / "Syncing" badge for the toolbar.
struct SyncBadge: View {
    @Environment(HabitStore.self) private var store
    @Environment(Connectivity.self) private var connectivity

    var body: some View {
        if !connectivity.isOnline {
            label("Offline", systemImage: "icloud.slash")
                .accessibilityHint("Changes are saved on this iPhone and sync when you're back online.")
        } else if store.hasPendingWrites {
            label("Syncing", systemImage: "arrow.triangle.2.circlepath")
        }
    }

    private func label(_ text: String, systemImage: String) -> some View {
        Label(text, systemImage: systemImage)
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(Theme.mutedText)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(Theme.muted, in: Capsule())
    }
}

/// Round − / + style button.
struct RoundIconButton: View {
    let systemImage: String
    let label: String
    var size: CGFloat = 48
    var foreground: Color = Theme.ink
    var background: Color = Theme.ink.opacity(0.07)
    var disabled = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: size * 0.4, weight: .semibold))
                .foregroundStyle(foreground)
                .frame(width: size, height: size)
                .background(background, in: Circle())
        }
        .buttonStyle(PressableStyle())
        .disabled(disabled)
        .opacity(disabled ? 0.35 : 1)
        .accessibilityLabel(label)
    }
}
