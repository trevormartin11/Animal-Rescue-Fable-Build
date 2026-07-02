import type { Metadata, Viewport } from "next";
import { Fraunces, Nunito_Sans } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const nunito = Nunito_Sans({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "Biscuit",
    template: "%s · Biscuit",
  },
  description:
    "Rescue-case tracker for the Rowley Family Charitable Giving Trust — PACC 911 requests, owner outreach, receipts, and giving stats.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#faf6ef",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${fraunces.variable} ${nunito.variable} bg-cream text-ink min-h-screen antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
