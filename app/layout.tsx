import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { ThemeProvider, themeInitScript } from "@/components/theme-provider";
import { AuthProvider } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import type { Metadata, Viewport } from "next";
import { Geist_Mono, Mulish, Quattrocento_Sans } from "next/font/google";
import "./globals.css";

const mulish = Mulish({ subsets: ["latin"], variable: "--font-sans" });

const quattrocentoSans = Quattrocento_Sans({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-heading",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "dots",
  description: "A quiet way to keep your habits.",
  appleWebApp: {
    capable: true,
    title: "dots",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3efea" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1a1a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("h-full", "antialiased", geistMono.variable, "font-sans", mulish.variable, quattrocentoSans.variable)}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
          <ServiceWorkerRegister />
        </ThemeProvider>
      </body>
    </html>
  );
}
