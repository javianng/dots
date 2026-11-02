import { AppProviders } from "@/components/app-providers";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { ThemeProvider, themeInitScript } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_SC } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

// Chinese companion to Inter (javian ng brand); loaded on demand.
const notoSansSC = Noto_Sans_SC({
  weight: ["400", "600"],
  subsets: ["latin"],
  variable: "--font-noto-sc",
  preload: false,
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
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f2ec" },
    { media: "(prefers-color-scheme: dark)", color: "#131211" },
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
      className={cn("h-full", "antialiased", "font-sans", inter.variable, notoSansSC.variable)}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <AppProviders>{children}</AppProviders>
          <ServiceWorkerRegister />
        </ThemeProvider>
      </body>
    </html>
  );
}
