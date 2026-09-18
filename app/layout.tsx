import type { Metadata, Viewport } from "next";
import { Playfair_Display, Nunito } from "next/font/google";
import "./globals.css";

const display = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
});

const body = Nunito({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Vaishnavi's Stage",
  description: "Every show. Every booking. Every moment.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Vaishnavi's Stage",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Locked so the app can never be pinch-zoomed or double-tap-zoomed --
  // it should always feel like a native app, not a webpage.
  maximumScale: 1,
  userScalable: false,
  themeColor: "#E88AAE",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="rose" suppressHydrationWarning>
      <body className={`${display.variable} ${body.variable} font-body antialiased`}>
        {children}
      </body>
    </html>
  );
}
