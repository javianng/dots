"use client";

import * as React from "react";
import { doc, onSnapshot } from "firebase/firestore";

import { db } from "@/lib/firebase";
import { lifeProfileFrom, type LifeProfile } from "@/lib/life";

interface Snapshot {
  uid: string;
  profile: LifeProfile | null;
}

/**
 * Realtime `users/{uid}.life`. `loading` is true until the first snapshot
 * for this uid arrives; `profile` is null when it hasn't been set yet.
 */
export function useLifeProfile(uid: string | undefined) {
  const [snap, setSnap] = React.useState<Snapshot | null>(null);

  React.useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      doc(db, "users", uid),
      (d) => setSnap({ uid, profile: lifeProfileFrom(d.data()) }),
      () => setSnap({ uid, profile: null }),
    );
  }, [uid]);

  const current = snap && snap.uid === uid ? snap : null;
  return { profile: current?.profile ?? null, loading: !!uid && !current };
}
