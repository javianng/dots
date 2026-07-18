import Image from "next/image";
import Link from "next/link";

import { Wordmark } from "@/components/wordmark";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2.5", className)}>
      <Image
        src="/logo.png"
        alt=""
        width={28}
        height={28}
        className="rounded-md"
        priority
      />
      <Wordmark className="text-xl" />
    </Link>
  );
}
