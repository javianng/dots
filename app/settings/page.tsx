"use client";

import { ChevronRight, FileText, Moon, Shield } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Divider, Group, Row, RowIcon } from "@/components/grouped-list";
import { ReminderSettings } from "@/components/reminder-settings";
import { RequireAuth } from "@/components/require-auth";
import { useTheme } from "@/components/theme-provider";
import { Switch } from "@/components/ui/switch";
import { signOutUser, useAuth } from "@/hooks/use-auth";
import { PageTransition, nav } from "@/lib/transitions";

export default function SettingsPage() {
  return (
    <PageTransition>
      <RequireAuth>
        <SettingsScreen />
      </RequireAuth>
    </PageTransition>
  );
}

function SettingsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();

  const displayName = user?.displayName || user?.email?.split("@")[0] || "You";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pb-12">
      <header className="material bar-edge pt-safe sticky top-0 z-20 -mx-4 px-2">
        <div className="grid h-14 grid-cols-[1fr_auto_1fr] items-center">
          <span />
          <h1 className="font-sans text-[17px] font-semibold">Settings</h1>
          <button
            type="button"
            onClick={() => router.push("/", { transitionTypes: nav("sheetDown") })}
            className="tappable justify-self-end rounded-full px-3 py-2 text-[17px] font-semibold"
          >
            Done
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-7 pt-4">
        <Group>
          <div className="flex items-center gap-3.5 px-4 py-3">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-foreground/60 to-foreground/80 text-2xl font-semibold text-background">
              {initial}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[19px] font-semibold">{displayName}</span>
              <span className="truncate text-[15px] text-muted-foreground">
                {user?.email} · Free Plan
              </span>
            </span>
          </div>
        </Group>

        <Group label="Appearance">
          <Row
            label="Dark Mode"
            htmlFor="dark-mode"
            icon={
              <RowIcon className="bg-[#5856d6]">
                <Moon />
              </RowIcon>
            }
          >
            <Switch
              id="dark-mode"
              checked={theme === "dark"}
              onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
            />
          </Row>
        </Group>

        {user && <ReminderSettings uid={user.uid} />}

        <Group label="About">
          <LinkRow
            href="/privacy"
            label="Privacy Policy"
            icon={
              <RowIcon className="bg-[#007aff]">
                <Shield />
              </RowIcon>
            }
          />
          <Divider inset={58} />
          <LinkRow
            href="/terms"
            label="Terms of Service"
            icon={
              <RowIcon className="bg-[#8e8e93]">
                <FileText />
              </RowIcon>
            }
          />
        </Group>

        <Group>
          <button
            type="button"
            onClick={() => signOutUser()}
            className="tappable h-12 w-full text-[17px] text-destructive"
          >
            Sign Out
          </button>
        </Group>
      </div>
    </main>
  );
}

function LinkRow({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      transitionTypes={nav("push")}
      className="tappable flex min-h-12 items-center gap-3 px-4 py-1.5 text-[17px]"
    >
      {icon}
      <span className="flex-1">{label}</span>
      <ChevronRight className="size-5 text-muted-foreground/60" />
    </Link>
  );
}
