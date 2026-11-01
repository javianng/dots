import { AuthScreen } from "@/components/auth-screen";
import { PageTransition } from "@/lib/transitions";

export default function LoginPage() {
  return (
    <PageTransition>
      <AuthScreen mode="login" />
    </PageTransition>
  );
}
