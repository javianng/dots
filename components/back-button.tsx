"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { addTransitionType, startTransition } from "react";

import { Button } from "@/components/ui/button";

/** iOS-style "‹ Back" that returns to wherever the user came from. */
export function BackButton({ fallbackHref = "/" }: { fallbackHref?: string }) {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      className="-ml-2 h-10 gap-0.5 rounded-full px-2 text-[17px] font-normal"
      onClick={() => {
        if (window.history.length > 1) {
          startTransition(() => {
            addTransitionType("pop");
            router.back();
          });
        } else {
          router.push(fallbackHref, { transitionTypes: ["pop"] });
        }
      }}
    >
      <ChevronLeft className="size-6" strokeWidth={2.25} />
      Back
    </Button>
  );
}
