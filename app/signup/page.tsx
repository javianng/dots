import { AuthScreen } from "@/components/auth-screen";
import { PageTransition } from "@/lib/transitions";

export default function SignUpPage() {
  return (
    <PageTransition>
      <AuthScreen mode="signup" />
    </PageTransition>
  );
}
