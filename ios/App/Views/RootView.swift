import DotsCore
import SwiftUI

struct RootView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(HabitStore.self) private var store
    @Environment(\.scenePhase) private var scenePhase
    @AppStorage("appearance") private var appearance = "system"

    var body: some View {
        Group {
            if Demo.isOn {
                if Demo.screen == "auth" { AuthView() } else { MainView() }
            } else if !FirebaseSetup.isConfigured {
                SetupNeededView()
            } else if auth.user == nil {
                AuthView()
            } else {
                MainView()
            }
        }
        .preferredColorScheme(appearance == "dark" ? .dark : appearance == "light" ? .light : nil)
        .tint(Theme.ink)
        .overlay(alignment: .top) { ToastView() }
        .task(id: auth.user?.uid) {
            if Demo.isOn { return store.loadDemo() }
            store.start(uid: auth.user?.uid)
            if auth.user == nil { Reminders.cancelAll() }
        }
        .task(id: store.habits) {
            // Debounced: re-plan reminders once taps settle.
            try? await Task.sleep(for: .milliseconds(600))
            guard !Task.isCancelled, auth.user != nil, !Demo.isOn else { return }
            await Reminders.reschedule(habits: store.habits)
        }
        .task(id: runningTimers) {
            // Finish countdowns that ran out (also ones started on the web).
            while !runningTimers.isEmpty, !Task.isCancelled {
                finishElapsedTimers()
                try? await Task.sleep(for: .seconds(1))
            }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { store.rebuild() }
        }
        .onReceive(NotificationCenter.default.publisher(for: .NSCalendarDayChanged)) { _ in
            store.rebuild()
        }
    }

    private var runningTimers: [String] {
        store.habits.filter { $0.timer != nil }.map(\.id)
    }

    private func finishElapsedTimers() {
        let now = Date()
        for habit in store.habits {
            guard let timer = habit.timer,
                  CheckIn.elapsedSeconds(habit, timer.dateKey, now: now) >= habit.dayTarget
            else { continue }
            store.run(habit, CheckIn.pause(habit, now: now))
        }
    }
}

/// Shown when the build has no GoogleService-Info.plist.
struct SetupNeededView: View {
    var body: some View {
        VStack(spacing: 16) {
            DotsMark(size: 56)
            Text("Connect Firebase")
                .font(.title2.bold())
            Text("Add your Firebase project's GoogleService-Info.plist to ios/App, then build again. See ios/README.md.")
                .multilineTextAlignment(.center)
                .foregroundStyle(Theme.mutedText)
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.background.ignoresSafeArea())
    }
}

/// The top-centre "done" toast.
struct ToastView: View {
    @Environment(HabitStore.self) private var store

    var body: some View {
        ZStack {
            if let toast = store.toast {
                HStack(spacing: 12) {
                    Image(systemName: "checkmark")
                        .font(.system(size: 16, weight: .heavy))
                        .foregroundStyle(Theme.onTint)
                        .frame(width: 36, height: 36)
                        .background(Theme.tint(toast.colorHex), in: Circle())
                        .overlay {
                            if toast.goalReached { Circle().stroke(Theme.accentSoft, lineWidth: 3).padding(-3) }
                        }
                    VStack(alignment: .leading, spacing: 1) {
                        Text(toast.title).font(.system(size: 14, weight: .semibold)).lineLimit(1)
                        Text(toast.subtitle).font(.system(size: 12)).foregroundStyle(Theme.mutedText).lineLimit(1)
                    }
                }
                .padding(.vertical, 8)
                .padding(.leading, 8)
                .padding(.trailing, 20)
                .background(.regularMaterial, in: Capsule())
                .shadow(color: .black.opacity(0.18), radius: 16, y: 6)
                .id(toast.id)
                .transition(.move(edge: .top).combined(with: .opacity))
                .onTapGesture { store.toast = nil }
                .accessibilityElement(children: .combine)
            }
        }
        .padding(.top, 6)
        .animation(.spring(response: 0.4, dampingFraction: 0.8), value: store.toast)
    }
}
