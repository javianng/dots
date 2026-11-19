import FirebaseCore
import FirebaseFirestore
import Foundation

/// Starts Firebase with the project's GoogleService-Info.plist and turns on
/// Firestore's on-device cache, which is what makes dots work offline:
/// habits load from the phone with no signal, and taps made offline are
/// queued on the phone and upload by themselves once it's back online.
enum FirebaseSetup {
    private(set) static var isConfigured = false

    static func configure() {
        guard !isConfigured,
              Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil
        else { return }
        FirebaseApp.configure()
        let settings = FirestoreSettings()
        settings.cacheSettings = PersistentCacheSettings(sizeBytes: NSNumber(value: FirestoreCacheSizeUnlimited))
        Firestore.firestore().settings = settings
        isConfigured = true
    }
}
