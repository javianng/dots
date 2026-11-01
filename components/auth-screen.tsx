"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FirebaseError } from "firebase/app";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Logo } from "@/components/logo";
import {
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
  useAuth,
} from "@/hooks/use-auth";
import { nav } from "@/lib/transitions";
import { cn } from "@/lib/utils";

function friendlyAuthError(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return "Incorrect email or password.";
      case "auth/email-already-in-use":
        return "An account with this email already exists.";
      case "auth/weak-password":
        return "Password should be at least 6 characters.";
      case "auth/invalid-email":
        return "Enter a valid email address.";
      case "auth/popup-closed-by-user":
        return "Google sign-in was cancelled.";
      default:
        return error.message.replace(/^Firebase: /, "");
    }
  }
  return "Something went wrong. Try again.";
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
      />
    </svg>
  );
}

export function AuthScreen({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [loading, user, router]);

  async function run(action: () => Promise<void>) {
    setError(null);
    setPending(true);
    try {
      await action();
      router.replace("/");
    } catch (err) {
      setError(friendlyAuthError(err));
      setPending(false);
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    run(() =>
      mode === "login"
        ? signInWithEmail(email, password)
        : signUpWithEmail(name.trim(), email, password)
    );
  }

  return (
    <main className="grid flex-1 lg:grid-cols-2">
      <div className="hidden flex-col justify-between border-r bg-muted p-10 lg:flex dark:bg-muted/40">
        <Logo />
        <blockquote className="max-w-md space-y-2">
          <p className="text-lg">
            &ldquo;What you do every day matters more than what you do once in
            a while.&rdquo;
          </p>
          <footer className="text-sm text-muted-foreground">
            &mdash; Gretchen Rubin
          </footer>
        </blockquote>
      </div>

      <div className="flex flex-col p-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] lg:p-10">
        <div className="flex items-center justify-between gap-4">
          <Logo className="lg:hidden" />
          <Link
            href={mode === "login" ? "/signup" : "/login"}
            transitionTypes={nav("fade")}
            replace
            className={cn(buttonVariants({ variant: "ghost" }), "ml-auto rounded-full")}
          >
            {mode === "login" ? "Sign Up" : "Login"}
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center py-12">
          <div className="flex w-full max-w-sm flex-col gap-6">
            <div className="flex flex-col gap-1 text-center">
              <h1 className="text-[28px] leading-tight font-bold tracking-tight">
                {mode === "login" ? "Welcome back" : "Create an account"}
              </h1>
              <p className="text-[15px] text-muted-foreground">
                {mode === "login"
                  ? "Enter your email below to sign in to your account"
                  : "Enter your email below to create your account"}
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              <FieldGroup className="gap-4">
                {mode === "signup" && (
                  <Field>
                    <FieldLabel htmlFor="name" className="sr-only">
                      Name
                    </FieldLabel>
                    <Input
                      id="name"
                      autoComplete="name"
                      placeholder="Your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </Field>
                )}
                <Field>
                  <FieldLabel htmlFor="email" className="sr-only">
                    Email
                  </FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </Field>
                <Field data-invalid={error ? true : undefined}>
                  <FieldLabel htmlFor="password" className="sr-only">
                    Password
                  </FieldLabel>
                  <Input
                    id="password"
                    type="password"
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-invalid={error ? true : undefined}
                    required
                  />
                  {error && <FieldError>{error}</FieldError>}
                </Field>
                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={pending}
                >
                  {pending && <Spinner data-icon="inline-start" />}
                  {mode === "login" ? "Sign In with Email" : "Sign Up with Email"}
                </Button>
                <FieldSeparator>Or continue with</FieldSeparator>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="w-full"
                  disabled={pending}
                  onClick={() => run(() => signInWithGoogle())}
                >
                  <GoogleIcon />
                  Google
                </Button>
              </FieldGroup>
            </form>

            <p className="px-4 text-center text-sm text-muted-foreground">
              By clicking continue, you agree to our{" "}
              <Link
                href="/terms"
                className="underline underline-offset-4 hover:text-foreground"
              >
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                className="underline underline-offset-4 hover:text-foreground"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
