import { MainScreen } from "@/components/main-screen";
import { RequireAuth } from "@/components/require-auth";

export default function Home() {
  return (
    <RequireAuth>
      <MainScreen />
    </RequireAuth>
  );
}
