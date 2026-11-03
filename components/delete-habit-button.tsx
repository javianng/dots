"use client";

import * as React from "react";
import { toast } from "sonner";

import { Group } from "@/components/grouped-list";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/use-auth";
import { deleteHabit } from "@/lib/habits";
import { haptic } from "@/lib/haptics";
import type { Habit } from "@/lib/types";

/**
 * Destructive row at the foot of the edit sheet. On success there's nothing to
 * do here: the habit drops out of the realtime snapshot and the edit page
 * navigates home.
 */
export function DeleteHabitButton({
  habit,
  disabled,
}: {
  habit: Habit;
  disabled?: boolean;
}) {
  const { user } = useAuth();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  function handleConfirm() {
    if (!user) return;
    haptic();
    setOpen(false);
    setPending(true);
    // Not awaited: the local delete sends the user home straight away (and is
    // queued while offline). A rejected write surfaces as a toast.
    deleteHabit(user.uid, habit.id).catch(() => {
      toast.error(`Couldn't delete "${habit.name}". Try again.`);
      setPending(false);
    });
  }

  return (
    <>
      <Group>
        <button
          type="button"
          disabled={disabled || pending}
          onClick={() => setOpen(true)}
          className="tappable flex h-12 w-full items-center justify-center gap-2 text-[17px] text-destructive disabled:opacity-35"
        >
          {pending && <Spinner className="size-4" />}
          Delete Habit
        </button>
      </Group>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent size="sm" className="max-w-[calc(100vw-2rem)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[17px] font-semibold">
              Delete &ldquo;{habit.name}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px]">
              This also deletes its history and streak. You can&apos;t undo this.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleConfirm}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
