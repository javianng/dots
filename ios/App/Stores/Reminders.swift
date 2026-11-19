import DotsCore
import Foundation
import UserNotifications

/// Local reminder and timer notifications, scheduled on the phone.
///
/// The web app's reminders are Web Push sent by a scheduled GitHub job, which
/// can arrive hours late. Here the phone schedules them itself, so they fire on
/// time with no server and no signal. They're re-planned whenever habits
/// change, so a day with nothing left gets no reminder.
@MainActor
enum Reminders {
    static let enabledKey = "remindersEnabled"
    static let timeKey = "reminderTime"
    static let morningEnabledKey = "morningReminderEnabled"
    static let morningTimeKey = "morningReminderTime"

    static var settings: ReminderPlanner.Settings {
        let defaults = UserDefaults.standard
        return ReminderPlanner.Settings(
            enabled: defaults.bool(forKey: enabledKey),
            time: defaults.object(forKey: timeKey) as? Int ?? 20 * 60,
            morningEnabled: defaults.bool(forKey: morningEnabledKey),
            morningTime: defaults.object(forKey: morningTimeKey) as? Int ?? 7 * 60 + 30
        )
    }

    /// Asks for permission. Returns whether notifications are allowed.
    static func requestPermission() async -> Bool {
        let center = UNUserNotificationCenter.current()
        let status = await center.notificationSettings().authorizationStatus
        switch status {
        case .authorized, .provisional, .ephemeral: return true
        case .denied: return false
        default: return (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
        }
    }

    private static let timerPrefix = "dots-timer-"

    /// Replaces every pending dots notification with a fresh plan.
    static func reschedule(habits: [Habit]) async {
        let center = UNUserNotificationCenter.current()
        let pending = await center.pendingNotificationRequests()
        let old = pending.map(\.identifier).filter { $0.hasPrefix(ReminderPlanner.idPrefix) || $0.hasPrefix(timerPrefix) }
        center.removePendingNotificationRequests(withIdentifiers: old)

        let status = await center.notificationSettings().authorizationStatus
        guard status == .authorized || status == .provisional || status == .ephemeral else { return }

        let calendar = Calendar.current
        for item in ReminderPlanner.plan(habits: habits, settings: settings) {
            let content = UNMutableNotificationContent()
            content.title = item.title
            content.body = item.body
            content.sound = .default
            content.threadIdentifier = "dots-reminders"
            let components = calendar.dateComponents([.year, .month, .day, .hour, .minute], from: item.fireDate)
            let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
            try? await center.add(UNNotificationRequest(identifier: item.id, content: content, trigger: trigger))
        }

        // A running countdown pings when its time is up, even if dots is closed.
        for habit in habits {
            guard let end = CheckIn.timerEnd(habit), end > Date() else { continue }
            let content = UNMutableNotificationContent()
            content.title = habit.name
            content.body = "Time's up: \(Labels.minutes(habit.durationMinutes)) done. Open dots to log it."
            content.sound = .default
            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: max(1, end.timeIntervalSinceNow), repeats: false)
            try? await center.add(UNNotificationRequest(identifier: timerPrefix + habit.id, content: content, trigger: trigger))
        }
    }

    static func cancelAll() {
        UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
    }
}
