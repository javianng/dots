import { BackButton } from "@/components/back-button";
import { PageTransition } from "@/lib/transitions";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <PageTransition>
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-16">
        <header className="material bar-edge pt-safe sticky top-0 z-20 -mx-5 px-5">
          <div className="flex h-14 items-center">
            <BackButton />
          </div>
        </header>
        <h1 className="mt-4 text-[34px] leading-tight font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-[15px] text-muted-foreground">Last updated: {updated}</p>
        <div className="mt-8 space-y-8">{children}</div>
      </main>
    </PageTransition>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold tracking-tight">{title}</h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}
