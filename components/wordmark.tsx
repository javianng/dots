import { cn } from "@/lib/utils";

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-heading font-bold tracking-tight", className)}>
      dots
    </span>
  );
}
