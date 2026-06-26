import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Geist substitute — Inter carries display + body (weights 400/500/600).
const inter = Inter({
  variable: "--font-sans",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
});

// Geist Mono substitute — technical labels, code, prices.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono-ff",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mini Auction Room — IPL Edition",
  description:
    "Live IPL-style auction with friends. Create a room, invite your crew, and bid on real cricket players to build your dream XI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full`}
    >
      <body className="min-h-full bg-void text-chalk font-body antialiased">
        {process.env.NEXT_PUBLIC_DEV_MODE === 'true' && (
          <div className="sticky top-0 z-[200] bg-amber text-void text-center text-xs font-mono py-1">
            DEV MODE — port 3003 — solo testing · no restrictions
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
