"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";

import { ReminderSettings } from "@/components/reminder-settings";
import { RequireAuth } from "@/components/require-auth";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { signOutUser, useAuth } from "@/hooks/use-auth";

export default function SettingsPage() {
  return (
    <RequireAuth>
      <SettingsScreen />
    </RequireAuth>
  );
}

function SettingsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-4">
      <div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center">
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label="Back"
          onClick={() => router.push("/")}
        >
          <X />
        </Button>
        <h1 className="text-center text-lg font-semibold">Settings</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-3">
          <span className="truncate text-sm">{user?.email}</span>
          <span className="shrink-0 text-sm text-muted-foreground">
            Free Plan
          </span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field orientation="horizontal">
            <FieldLabel htmlFor="dark-mode">Dark Mode</FieldLabel>
            <Switch
              id="dark-mode"
              checked={theme === "dark"}
              onCheckedChange={(checked) =>
                setTheme(checked ? "dark" : "light")
              }
            />
          </Field>
          <Separator />
          {user && <ReminderSettings uid={user.uid} />}
        </CardContent>
      </Card>

      <Button
        variant="destructive"
        size="lg"
        className="w-full"
        onClick={() => signOutUser()}
      >
        Sign Out
      </Button>
    </main>
  );
}
