import SwiftUI

struct AuthView: View {
    @Environment(AuthStore.self) private var auth

    private enum Mode { case signIn, signUp }
    private enum Field { case name, email, password }

    @State private var mode: Mode = .signIn
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var busy = false
    @State private var error: String?
    @State private var info: String?
    @FocusState private var focus: Field?

    var body: some View {
        ScrollView {
            VStack(spacing: 28) {
                VStack(spacing: 14) {
                    DotsMark(size: 56)
                    Text("dots")
                        .font(.system(size: 34, weight: .bold))
                        .tracking(-0.5)
                    Text("“What you do every day matters more than what you do once in a while.”")
                        .font(.system(size: 15))
                        .multilineTextAlignment(.center)
                        .foregroundStyle(Theme.mutedText)
                    Text("— Gretchen Rubin")
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.subtle)
                }
                .padding(.top, 48)

                VStack(spacing: 0) {
                    if mode == .signUp {
                        field("Your name", text: $name, field: .name)
                            .textContentType(.name)
                        Divider().padding(.leading, 16)
                    }
                    field("name@example.com", text: $email, field: .email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    Divider().padding(.leading, 16)
                    SecureField("Password", text: $password)
                        .textContentType(mode == .signUp ? .newPassword : .password)
                        .focused($focus, equals: .password)
                        .submitLabel(.go)
                        .onSubmit(submit)
                        .padding(.horizontal, 16)
                        .frame(height: 50)
                }
                .background(Theme.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))

                if let error {
                    Text(error)
                        .font(.system(size: 14))
                        .foregroundStyle(Theme.destructive)
                        .multilineTextAlignment(.center)
                }
                if let info {
                    Text(info)
                        .font(.system(size: 14))
                        .foregroundStyle(Theme.mutedText)
                        .multilineTextAlignment(.center)
                }

                VStack(spacing: 12) {
                    Button(action: submit) {
                        ZStack {
                            Text(mode == .signIn ? "Sign In" : "Create Account").opacity(busy ? 0 : 1)
                            if busy { ProgressView().tint(Theme.background) }
                        }
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(Theme.background)
                        .frame(maxWidth: .infinity, minHeight: 50)
                        .background(Theme.ink, in: Capsule())
                    }
                    .buttonStyle(PressableStyle())
                    .disabled(busy || email.isEmpty || password.isEmpty)

                    Button {
                        run { try await auth.signInWithGoogle() }
                    } label: {
                        Label("Continue with Google", systemImage: "g.circle.fill")
                            .font(.system(size: 17, weight: .semibold))
                            .foregroundStyle(Theme.ink)
                            .frame(maxWidth: .infinity, minHeight: 50)
                            .background(Theme.card, in: Capsule())
                            .overlay(Capsule().stroke(Theme.border))
                    }
                    .buttonStyle(PressableStyle())
                    .disabled(busy)
                }

                VStack(spacing: 14) {
                    Button(mode == .signIn ? "New here? Create an account" : "Have an account? Sign in") {
                        withAnimation(.snappy) { mode = mode == .signIn ? .signUp : .signIn }
                        error = nil
                        info = nil
                    }
                    .font(.system(size: 15, weight: .medium))

                    if mode == .signIn {
                        Button("Forgot password?") { resetPassword() }
                            .font(.system(size: 14))
                            .foregroundStyle(Theme.mutedText)
                    }
                }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 32)
            .frame(maxWidth: 440)
            .frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(Theme.background.ignoresSafeArea())
    }

    private func field(_ placeholder: String, text: Binding<String>, field: Field) -> some View {
        TextField(placeholder, text: text)
            .focused($focus, equals: field)
            .submitLabel(.next)
            .onSubmit { focus = field == .name ? .email : .password }
            .padding(.horizontal, 16)
            .frame(height: 50)
    }

    private func submit() {
        guard !email.isEmpty, !password.isEmpty else { return }
        let email = email.trimmingCharacters(in: .whitespaces)
        if mode == .signIn {
            run { try await auth.signIn(email: email, password: password) }
        } else {
            run { try await auth.signUp(name: name, email: email, password: password) }
        }
    }

    private func resetPassword() {
        let email = email.trimmingCharacters(in: .whitespaces)
        guard !email.isEmpty else {
            error = "Enter your email first, then tap Forgot password."
            return
        }
        run {
            try await auth.sendPasswordReset(email: email)
            info = "Check \(email) for a link to reset your password."
        }
    }

    private func run(_ action: @escaping () async throws -> Void) {
        error = nil
        info = nil
        busy = true
        focus = nil
        Task {
            do { try await action() } catch { self.error = AuthStore.message(for: error) }
            busy = false
        }
    }
}
