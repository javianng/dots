import DotsCore
import FirebaseFirestore
import Foundation
import Observation

/// A "done" toast, like the web app's.
struct Toast: Equatable, Identifiable {
    let id = UUID()
    var title: String
    var subtitle: String
    var colorHex: String
    var goalReached: Bool
}

/// Realtime habits for the signed-in user: habit docs plus each habit's
/// `completions` merged into one `Habit` (see `HabitParser`).
///
/// Offline: Firestore serves everything from the phone's cache and applies
/// writes locally straight away, so taps show instantly with or without a
/// signal. Writes are never awaited; they're queued and sync when the phone is
/// back online (also after the app was closed).
@MainActor
@Observable
final class HabitStore {
    private(set) var habits: [Habit] = []
    private(set) var isLoaded = false
    /// Changes made on this phone that haven't reached the server yet.
    private(set) var hasPendingWrites = false
    private(set) var life: LifeProfile?
    private(set) var lifeLoaded = false
    var toast: Toast?

    @ObservationIgnored private var uid: String?
    @ObservationIgnored private var metaListener: ListenerRegistration?
    @ObservationIgnored private var userListener: ListenerRegistration?
    @ObservationIgnored private var dayListeners: [String: ListenerRegistration] = [:]
    @ObservationIgnored private var metas: [Habit] = []
    @ObservationIgnored private var days: [String: [String: DayDoc]] = [:]
    @ObservationIgnored private var metaPending = false
    @ObservationIgnored private var daysPending: Set<String> = []
    @ObservationIgnored private var toastTask: Task<Void, Never>?

    private var db: Firestore { Firestore.firestore() }

    private func habitsRef(_ uid: String) -> CollectionReference {
        db.collection("users").document(uid).collection("habits")
    }

    func habit(_ id: String) -> Habit? { habits.first { $0.id == id } }

    // MARK: Demo

    @ObservationIgnored private var demo = false

    /// Sample data with no Firebase (see Demo). Writes apply in memory only.
    func loadDemo() {
        demo = true
        habits = Demo.habits()
        life = Demo.life
        isLoaded = true
        lifeLoaded = true
    }

    private func applyDemo(_ writes: [HabitWrite], habitID: String) {
        guard let i = habits.firstIndex(where: { $0.id == habitID }) else { return }
        habits[i] = habits[i].applying(CheckInResult(writes, .none))
    }

    // MARK: Listening

    func start(uid: String?) {
        guard uid != self.uid else { return }
        stop()
        self.uid = uid
        guard let uid, FirebaseSetup.isConfigured else { return }

        metaListener = habitsRef(uid)
            .order(by: "createdAt")
            .addSnapshotListener(includeMetadataChanges: true) { [weak self] snapshot, _ in
                guard let snapshot else { return }
                MainActor.assumeIsolated { self?.receive(snapshot) }
            }

        userListener = db.collection("users").document(uid).addSnapshotListener { [weak self] snapshot, _ in
            MainActor.assumeIsolated {
                guard let self else { return }
                self.life = LifeProfile(userData: snapshot?.data())
                self.lifeLoaded = true
            }
        }
    }

    func stop() {
        metaListener?.remove()
        userListener?.remove()
        dayListeners.values.forEach { $0.remove() }
        metaListener = nil
        userListener = nil
        dayListeners = [:]
        metas = []
        days = [:]
        habits = []
        isLoaded = false
        life = nil
        lifeLoaded = false
        metaPending = false
        daysPending = []
        hasPendingWrites = false
        uid = nil
    }

    private func receive(_ snapshot: QuerySnapshot) {
        metas = snapshot.documents.map { doc in
            // While a new habit's createdAt is still pending, use the estimate.
            let data = doc.data(with: .estimate)
            let createdAt = (data["createdAt"] as? Timestamp)?.dateValue()
            return HabitParser.meta(id: doc.documentID, data: data, createdAt: createdAt)
        }
        metaPending = snapshot.metadata.hasPendingWrites
        syncDayListeners()
        isLoaded = true
        rebuild()
    }

    private func syncDayListeners() {
        guard let uid else { return }
        let ids = Set(metas.map(\.id))
        for (id, listener) in dayListeners where !ids.contains(id) {
            listener.remove()
            dayListeners[id] = nil
            days[id] = nil
            daysPending.remove(id)
        }
        for id in ids where dayListeners[id] == nil {
            dayListeners[id] = habitsRef(uid).document(id).collection("completions")
                .addSnapshotListener(includeMetadataChanges: true) { [weak self] snapshot, _ in
                    guard let snapshot else { return }
                    MainActor.assumeIsolated {
                        guard let self else { return }
                        self.days[id] = Dictionary(
                            snapshot.documents.map { ($0.documentID, DayDoc(data: $0.data())) },
                            uniquingKeysWith: { _, last in last }
                        )
                        if snapshot.metadata.hasPendingWrites { self.daysPending.insert(id) } else { self.daysPending.remove(id) }
                        self.rebuild()
                    }
                }
        }
    }

    /// Recomputes habits (also call when the day changes: limits and streaks
    /// depend on what "today" is).
    func rebuild() {
        if demo { return }
        let now = Date()
        let next = metas.map { HabitParser.habit($0, days: days[$0.id] ?? [:], now: now) }
        if next != habits { habits = next }
        let pending = metaPending || !daysPending.isEmpty
        if pending != hasPendingWrites { hasPendingWrites = pending }
    }

    // MARK: Logging days

    func tap(_ habit: Habit, dateKey: String, part: DayPart? = nil) {
        run(habit, CheckIn.tap(habit, dateKey, part: part))
    }

    func run(_ habit: Habit, _ result: CheckInResult) {
        apply(result.writes, habitID: habit.id)
        switch result.feedback {
        case .none: break
        case .light: Haptics.light()
        case .celebrate(let dateKey): celebrate(habit, dateKey: dateKey)
        }
    }

    private func celebrate(_ habit: Habit, dateKey: String) {
        let text = Labels.celebration(habit, dateKey: dateKey)
        if text.goalReached { Haptics.success() } else { Haptics.light() }
        toast = Toast(title: text.title, subtitle: text.subtitle, colorHex: habit.colorHex, goalReached: text.goalReached)
        toastTask?.cancel()
        let seconds: Double = text.goalReached ? 3.5 : 2.2
        toastTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(seconds))
            guard !Task.isCancelled else { return }
            self?.toast = nil
        }
    }

    /// Turns `HabitWrite`s into Firestore writes, matching lib/habits.ts.
    func apply(_ writes: [HabitWrite], habitID: String) {
        if demo { return applyDemo(writes, habitID: habitID) }
        guard let uid, !writes.isEmpty else { return }
        let habitRef = habitsRef(uid).document(habitID)
        let completions = habitRef.collection("completions")
        for write in writes {
            switch write {
            case .setDay(let key, let count, let completed, let slots):
                var data: [String: Any] = [
                    "count": Encode.number(count),
                    "completed": completed,
                    "completedAt": FieldValue.serverTimestamp(),
                ]
                if let slots { data["slots"] = slots.map(\.rawValue) }
                completions.document(key).setData(data)
            case .deleteDay(let key):
                completions.document(key).delete()
            case .skipDay(let key):
                completions.document(key).setData([
                    "count": 0,
                    "completed": false,
                    "skipped": true,
                    "completedAt": FieldValue.serverTimestamp(),
                ])
            case .startTimer(let timer):
                habitRef.updateData(["timer": Encode.timer(timer)])
            case .stopTimer(let key, let seconds, let completed):
                // One batch, so the timer and the logged time never disagree.
                let batch = db.batch()
                batch.updateData(["timer": NSNull()], forDocument: habitRef)
                if seconds <= 0 {
                    batch.deleteDocument(completions.document(key))
                } else {
                    batch.setData([
                        "count": Encode.number(seconds),
                        "completed": completed,
                        "completedAt": FieldValue.serverTimestamp(),
                    ], forDocument: completions.document(key))
                }
                batch.commit()
            case .clearTimer:
                habitRef.updateData(["timer": NSNull()])
            case .mergeDay(let key, let count, let completed):
                completions.document(key).setData(["count": Encode.number(count), "completed": completed], merge: true)
            }
        }
    }

    // MARK: Habits

    func create(_ draft: HabitDraft) {
        guard let uid else { return }
        var data = Encode.draft(draft)
        data["createdAt"] = FieldValue.serverTimestamp()
        habitsRef(uid).document().setData(data)
        Haptics.success()
    }

    func update(_ habit: Habit, to draft: HabitDraft) {
        guard let uid else { return }
        habitsRef(uid).document(habit.id).updateData(Encode.draft(draft))
        // Taps, seconds and units don't convert between goal types.
        apply(CheckIn.goalTypeChange(from: habit, to: draft), habitID: habit.id)
        Haptics.success()
    }

    /// Deletes a habit and its completions (Firestore doesn't cascade). The
    /// habit doc goes last, so a partial failure leaves it there to retry.
    func delete(_ habit: Habit) {
        guard let uid else { return }
        let habitRef = habitsRef(uid).document(habit.id)
        let refs = (days[habit.id] ?? [:]).keys.sorted().map { habitRef.collection("completions").document($0) } + [habitRef]
        stride(from: 0, to: refs.count, by: 450).forEach { start in
            let batch = db.batch()
            refs[start..<min(start + 450, refs.count)].forEach { batch.deleteDocument($0) }
            batch.commit()
        }
    }

    // MARK: Life in weeks

    func saveLife(_ profile: LifeProfile) {
        guard let uid else { return }
        db.collection("users").document(uid).setData(["life": profile.fields], merge: true)
        life = profile
    }
}
