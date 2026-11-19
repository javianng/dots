import DotsCore
import SwiftUI

enum MainTab: String, CaseIterable, Identifiable {
    case grid, list, compact, life
    var id: String { rawValue }

    var symbol: String {
        switch self {
        case .grid: "square.grid.2x2"
        case .list: "list.bullet"
        case .compact: "line.3.horizontal"
        case .life: "hourglass"
        }
    }

    var label: String {
        switch self {
        case .grid: "Grid view"
        case .list: "List view"
        case .compact: "Compact view"
        case .life: "Life in weeks"
        }
    }
}

struct MainView: View {
    @Environment(HabitStore.self) private var store
    @AppStorage("mainTab") private var tab: MainTab = .grid
    @State private var showNew = Demo.isOn && Demo.screen == "form"
    @State private var showSettings = Demo.isOn && Demo.screen == "settings"
    @State private var path: [String] = Demo.isOn && Demo.screen == "detail" ? ["workout"] : []

    var body: some View {
        NavigationStack(path: $path) {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    if !store.isLoaded {
                        ProgressView().frame(maxWidth: .infinity, minHeight: 300)
                    } else if tab == .life {
                        LifeView()
                    } else if store.habits.isEmpty {
                        EmptyStateView { showNew = true }
                    } else {
                        TodayHeader(habits: store.habits)
                        switch tab {
                        case .grid: GridSections(habits: store.habits)
                        case .list: LastDaysList(habits: store.habits)
                        default: CompactSections(habits: store.habits)
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 24)
                .frame(maxWidth: 720)
                .frame(maxWidth: .infinity)
            }
            .background(Theme.background.ignoresSafeArea())
            .safeAreaInset(edge: .bottom) {
                if store.isLoaded { ViewSwitcher(tab: $tab) }
            }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    HStack(spacing: 8) {
                        DotsMark(size: 20)
                        Text("dots").font(.system(size: 20, weight: .bold)).tracking(-0.3)
                        SyncBadge()
                    }
                }
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button { showSettings = true } label: {
                        Image(systemName: "gearshape")
                    }
                    .accessibilityLabel("Settings")
                    Button { showNew = true } label: {
                        Image(systemName: "plus")
                            .fontWeight(.semibold)
                    }
                    .accessibilityLabel("New habit")
                }
            }
            .toolbarBackground(Theme.background, for: .navigationBar)
            .navigationBarTitleDisplayMode(.inline)
            .navigationDestination(for: String.self) { id in
                HabitDetailView(habitID: id)
            }
            .sheet(isPresented: $showNew) { HabitFormView(habit: nil) }
            .sheet(isPresented: $showSettings) { SettingsView() }
        }
        .onAppear {
            if Demo.isOn, let raw = Demo.tab, let demoTab = MainTab(rawValue: raw) { tab = demoTab }
        }
    }
}

/// Large "Today" header with the date and a progress ring.
struct TodayHeader: View {
    let habits: [Habit]

    var body: some View {
        let summary = Today.summary(habits)
        HStack(alignment: .bottom) {
            VStack(alignment: .leading, spacing: 2) {
                Text(Date.now.formatted(.dateTime.weekday(.wide).day().month(.wide)))
                    .sectionTitleStyle()
                Text("Today")
                    .font(.system(size: 34, weight: .bold))
                    .tracking(-0.5)
                Text(summary.total == 0 ? "Rest day. Nothing due."
                     : summary.done == summary.total ? "All done. Nice work."
                     : "\(summary.done) of \(summary.total) done")
                    .font(.system(size: 15))
                    .foregroundStyle(Theme.mutedText)
            }
            Spacer()
            ProgressRingView(value: summary.total == 0 ? 1 : Double(summary.done) / Double(summary.total))
        }
        .padding(.top, 4)
        .padding(.bottom, 8)
    }
}

struct EmptyStateView: View {
    let onNew: () -> Void

    var body: some View {
        VStack(spacing: 20) {
            VStack(spacing: 6) {
                HStack(spacing: 6) {
                    Squircle().fill(Theme.ink).frame(width: 28, height: 28)
                    Squircle().fill(Theme.mutedText).frame(width: 28, height: 28)
                }
                HStack(spacing: 6) {
                    Squircle().fill(Theme.subtle).frame(width: 28, height: 28)
                    Squircle().stroke(Theme.accent, style: StrokeStyle(lineWidth: 2, dash: [4, 3])).frame(width: 26, height: 26).frame(width: 28, height: 28)
                }
            }
            VStack(spacing: 4) {
                Text("No habits yet").font(.title3.bold())
                Text("Start with one small thing you want to do every day.")
                    .font(.system(size: 15))
                    .foregroundStyle(Theme.mutedText)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 260)
            }
            Button(action: onNew) {
                Text("New Habit")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(Theme.background)
                    .padding(.horizontal, 24)
                    .frame(height: 48)
                    .background(Theme.ink, in: Capsule())
            }
            .buttonStyle(PressableStyle())
        }
        .frame(maxWidth: .infinity, minHeight: 420)
    }
}

/// Floating segmented control, like the web app's.
struct ViewSwitcher: View {
    @Binding var tab: MainTab
    @Namespace private var thumb

    var body: some View {
        HStack(spacing: 0) {
            ForEach(MainTab.allCases) { item in
                Button {
                    guard item != tab else { return }
                    Haptics.selection()
                    withAnimation(.spring(response: 0.4, dampingFraction: 0.75)) { tab = item }
                } label: {
                    Image(systemName: item.symbol)
                        .font(.system(size: 17, weight: item == tab ? .semibold : .regular))
                        .foregroundStyle(item == tab ? Theme.ink : Theme.mutedText)
                        .frame(width: 48, height: 40)
                        .background {
                            if item == tab {
                                Capsule()
                                    .fill(Theme.thumb)
                                    .shadow(color: .black.opacity(0.12), radius: 2, y: 1)
                                    .matchedGeometryEffect(id: "thumb", in: thumb)
                            }
                        }
                }
                .buttonStyle(.plain)
                .accessibilityLabel(item.label)
                .accessibilityAddTraits(item == tab ? .isSelected : [])
            }
        }
        .padding(4)
        .background(.thickMaterial, in: Capsule())
        .shadow(color: .black.opacity(0.16), radius: 18, y: 8)
        .padding(.bottom, 8)
        .frame(maxWidth: .infinity)
    }
}
