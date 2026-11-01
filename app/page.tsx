import { MainScreen } from "@/components/main-screen";
import { RequireAuth } from "@/components/require-auth";
import { PageTransition } from "@/lib/transitions";

export default function Home() {
  return (
    <PageTransition>
      <RequireAuth>
        <MainScreen />
      </RequireAuth>
    </PageTransition>
  );
}
