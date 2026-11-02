"use client";

import * as React from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

import { auth, db, googleProvider } from "@/lib/firebase";
import { disableReminders } from "@/lib/push";

const REMINDER_CLEANUP_TIMEOUT_MS = 3000;

interface AuthContextValue {
  user: User | null;
  loading: boolean;
}

const AuthContext = React.createContext<AuthContextValue>({
  user: null,
  loading: true,
});

async function ensureUserDoc(user: User) {
  await setDoc(
    doc(db, "users", user.uid),
    {
      email: user.email,
      displayName: user.displayName ?? null,
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    return onAuthStateChanged(auth, (next) => {
      setUser(next);
      setLoading(false);
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return React.useContext(AuthContext);
}

export async function signUpWithEmail(
  name: string,
  email: string,
  password: string
) {
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  if (name) await updateProfile(user, { displayName: name });
  await ensureUserDoc(user);
}

export async function signInWithEmail(email: string, password: string) {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function signInWithGoogle() {
  const { user } = await signInWithPopup(auth, googleProvider);
  await ensureUserDoc(user);
}

export async function signOutUser() {
  // A signed-out device shouldn't keep getting this account's reminders. This
  // needs the session, so it runs first; Firestore writes wait forever offline,
  // so it's capped to never block signing out.
  const uid = auth.currentUser?.uid;
  if (uid) {
    await Promise.race([
      disableReminders(uid).catch(() => undefined),
      new Promise((resolve) => setTimeout(resolve, REMINDER_CLEANUP_TIMEOUT_MS)),
    ]);
  }
  await signOut(auth);
}
