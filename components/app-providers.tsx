"use client";

import * as React from "react";

import { SyncStatus } from "@/components/sync-status";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { HabitsProvider } from "@/hooks/use-habits";

function UserHabits({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return <HabitsProvider uid={user?.uid}>{children}</HabitsProvider>;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <UserHabits>{children}</UserHabits>
      <SyncStatus />
      <Toaster
        position="top-center"
        offset={{ top: "calc(env(safe-area-inset-top) + 12px)" }}
        mobileOffset={{ top: "calc(env(safe-area-inset-top) + 8px)" }}
        visibleToasts={1}
        gap={8}
      />
    </AuthProvider>
  );
}
