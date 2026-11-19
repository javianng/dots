import DotsCore
import SwiftUI
import UIKit

struct SettingsView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(HabitStore.self) private var store
    @Environment(Connectivity.self) private var connectivity
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    @AppStorage("appearance") private var appearance = "system"
    @AppStorage(Reminders.enabledKey) private var remindersOn = false
    @AppStorage(Reminders.timeKey) private var reminderTime = 20 * 60
    @AppStorage(Reminders.morningEnabledKey) private var morningOn = false
    @AppStorage(Reminders.morningTimeKey) private var morningTime = 7 * 60 + 30
    @State private var reminderError: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack(spacing: 14) {
                        Text(String(auth.displayName.prefix(1)).uppercased())
                            .font(.system(size: 24, weight: .semibold))
                            .foregroundStyle(Theme.background)
                            .frame(width: 56, height: 56)
                            .background(Theme.ink.opacity(0.75), in: Circle())
                        VStack(alignment: .leading, spacing: 2) {
                            Text(auth.displayName).font(.system(size: 19, weight: .semibold))
                            Text(auth.user?.email ?? "").font(.system(size: 15)).foregroundStyle(Theme.mutedText)
                        }
                    }
                    .padding(.vertical, 4)
                }

                Section("Appearance") {
                    Picker("Theme", selection: $appearance) {
                        Text("System").tag("system")
                        Text("Light").tag("light")
                        Text("Dark").tag("dark")
                    }
                }

                LifeSettingsSection()

                Section {
                    Toggle("Daily reminder", isOn: Binding(get: { remindersOn }, set: setReminders))
                    if remindersOn {
                        DatePicker("Time", selection: timeBinding($reminderTime), displayedComponents: .hourAndMinute)
                        Toggle("Morning reminder", isOn: $morningOn)
                        if morningOn {
                            DatePicker("Morning time", selection: timeBinding($morningTime), displayedComponents: .hourAndMinute)
                        }
                    }
                } header: {
                    Text("Reminders")
                } footer: {
                    Text(reminderError ?? "Scheduled on this iPhone, so they arrive on time, even offline. No reminder on days you've finished everything. The morning one only counts morning habits and only goes out before noon.")
                }
                .onChange(of: reminderTime) { _, _ in replan() }
                .onChange(of: morningOn) { _, _ in replan() }
                .onChange(of: morningTime) { _, _ in replan() }

                Section("Sync") {
                    LabeledContent("Status", value: syncStatus)
                }

                Section {
                    Button("Sign Out", role: .destructive) {
                        Reminders.cancelAll()
                        auth.signOut()
                        dismiss()
                    }
                    .frame(maxWidth: .infinity)
                } footer: {
                    Text("dots \(Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "")")
                        .frame(maxWidth: .infinity)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background.ignoresSafeArea())
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }.fontWeight(.semibold)
                }
            }
        }
    }

    private var syncStatus: String {
        if !connectivity.isOnline {
            return store.hasPendingWrites ? "Offline · changes saved on this iPhone" : "Offline"
        }
        return store.hasPendingWrites ? "Syncing…" : "Up to date"
    }

    private func setReminders(_ on: Bool) {
        reminderError = nil
        guard on else {
            remindersOn = false
            replan()
            return
        }
        Task {
            if await Reminders.requestPermission() {
                remindersOn = true
                replan()
            } else {
                remindersOn = false
                reminderError = "Notifications are off for dots. Turn them on in the Settings app → Notifications → dots."
                if let url = URL(string: UIApplication.openNotificationSettingsURLString) { openURL(url) }
            }
        }
    }

    private func replan() {
        Task { await Reminders.reschedule(habits: store.habits) }
    }

    /// Minutes since midnight ↔ a Date for DatePicker.
    private func timeBinding(_ minutes: Binding<Int>) -> Binding<Date> {
        Binding(
            get: { DayMath.current.at(Date(), minutes: minutes.wrappedValue) },
            set: { date in
                let c = Calendar.current.dateComponents([.hour, .minute], from: date)
                minutes.wrappedValue = (c.hour ?? 0) * 60 + (c.minute ?? 0)
            }
        )
    }
}

/// Birth date and life expectancy for "Life in weeks".
struct LifeSettingsSection: View {
    @Environment(HabitStore.self) private var store
    @State private var birth = Calendar.current.date(byAdding: .year, value: -30, to: Date()) ?? Date()
    @State private var expectancy = LifeProfile.defaultLifeExpectancy
    @State private var loaded = false

    var body: some View {
        let math = DayMath.current
        let draft = LifeProfile(birthDate: math.key(birth), lifeExpectancy: expectancy)
        let problem = Life.validate(draft)
        Section {
            DatePicker("Date of birth", selection: $birth, in: ...Date(), displayedComponents: .date)
            Stepper(value: $expectancy, in: LifeProfile.minLifeExpectancy...LifeProfile.maxLifeExpectancy) {
                LabeledContent("Life expectancy", value: "\(expectancy) years")
            }
            if draft != store.life {
                Button(store.life == nil ? "Show my life in weeks" : "Save") {
                    store.saveLife(draft)
                    Haptics.success()
                }
                .disabled(problem != nil)
            }
        } header: {
            Text("Life in weeks")
        } footer: {
            Text(problem ?? "One dot per week of your life. Synced with the web app.")
        }
        .onAppear(perform: load)
        .onChange(of: store.life) { _, _ in load() }
    }

    private func load() {
        guard let life = store.life, let date = DayMath.current.date(life.birthDate) else { return }
        guard !loaded || DayMath.current.key(birth) != life.birthDate || expectancy != life.lifeExpectancy else { return }
        birth = date
        expectancy = life.lifeExpectancy
        loaded = true
    }
}
