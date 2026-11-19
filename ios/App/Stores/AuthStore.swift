import FirebaseAuth
import FirebaseCore
import FirebaseFirestore
import GoogleSignIn
import Observation
import UIKit

/// The signed-in Firebase user. Firebase keeps the session in the keychain,
/// so the user is known instantly at launch, offline included.
@MainActor
@Observable
final class AuthStore {
    private(set) var user: User?

    @ObservationIgnored private var handle: AuthStateDidChangeListenerHandle?

    init() {
        guard FirebaseSetup.isConfigured else { return }
        user = Auth.auth().currentUser
        handle = Auth.auth().addStateDidChangeListener { [weak self] _, user in
            MainActor.assumeIsolated { self?.user = user }
        }
    }

    var displayName: String {
        if let name = user?.displayName, !name.isEmpty { return name }
        if let email = user?.email, let first = email.split(separator: "@").first { return String(first) }
        return "You"
    }

    func signIn(email: String, password: String) async throws {
        _ = try await Auth.auth().signIn(withEmail: email, password: password)
    }

    func signUp(name: String, email: String, password: String) async throws {
        let result = try await Auth.auth().createUser(withEmail: email, password: password)
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        if !trimmed.isEmpty {
            let change = result.user.createProfileChangeRequest()
            change.displayName = trimmed
            try? await change.commitChanges()
        }
        ensureUserDoc(result.user, name: trimmed.isEmpty ? nil : trimmed)
    }

    func signInWithGoogle() async throws {
        guard let clientID = FirebaseApp.app()?.options.clientID else { throw AuthMessage("Google sign-in isn't set up for this build.") }
        GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientID)
        guard let presenter = Self.topViewController() else { return }
        let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: presenter)
        guard let idToken = result.user.idToken?.tokenString else { throw AuthMessage("Google didn't return a sign-in token. Try again.") }
        let credential = GoogleAuthProvider.credential(withIDToken: idToken, accessToken: result.user.accessToken.tokenString)
        let auth = try await Auth.auth().signIn(with: credential)
        ensureUserDoc(auth.user, name: auth.user.displayName)
    }

    func sendPasswordReset(email: String) async throws {
        try await Auth.auth().sendPasswordReset(withEmail: email)
    }

    func signOut() {
        GIDSignIn.sharedInstance.signOut()
        try? Auth.auth().signOut()
    }

    /// Same profile doc the web app writes on sign-up (merged, never awaited).
    private func ensureUserDoc(_ user: User, name: String?) {
        Firestore.firestore().collection("users").document(user.uid).setData([
            "email": user.email.map { $0 as Any } ?? NSNull(),
            "displayName": name.map { $0 as Any } ?? NSNull(),
            "createdAt": FieldValue.serverTimestamp(),
        ], merge: true)
    }

    private static func topViewController() -> UIViewController? {
        let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first
        var top = scene?.windows.first { $0.isKeyWindow }?.rootViewController
        while let presented = top?.presentedViewController { top = presented }
        return top
    }

    /// Friendly text for a sign-in error, or nil when the user just cancelled.
    static func message(for error: Error) -> String? {
        if let message = error as? AuthMessage { return message.text }
        let ns = error as NSError
        if ns.domain == "com.google.GIDSignIn", ns.code == -5 { return nil } // cancelled
        switch ns.code {
        case 17004, 17009, 17011: return "Wrong email or password."
        case 17007: return "An account with this email already exists. Sign in instead."
        case 17008: return "Enter a valid email address."
        case 17026: return "Use a password of at least 6 characters."
        case 17020: return "You're offline. Connect to the internet to sign in."
        case 17010: return "Too many tries. Wait a moment, then try again."
        default: return ns.localizedDescription
        }
    }
}

struct AuthMessage: Error {
    let text: String
    init(_ text: String) { self.text = text }
}
