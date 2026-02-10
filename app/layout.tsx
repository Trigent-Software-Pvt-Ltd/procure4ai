import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Procure4AI — Procurement Data Intelligence",
  description:
    "AI-powered procurement data intake, rationalization, and standardization platform by Trigent",
  icons: {
    icon: "https://trigent.com/wp-content/uploads/trigent-_favicon.svg",
    apple: "https://trigent.com/wp-content/uploads/trigent-_favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* ── Header (dark) ── */}
        <header className="bg-[#0a0a0f] border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://trigent.com/wp-content/uploads/trigent-_yellow-white-ho.svg"
              alt="Trigent"
              className="h-7 w-auto"
            />
            <div className="h-7 w-px bg-white/20" />
            <div>
              <h1 className="text-white text-lg font-semibold leading-tight tracking-tight">
                Procure4AI
              </h1>
              <p className="text-white/40 text-[11px] leading-tight">
                Procurement Data Intelligence
              </p>
            </div>
          </div>
        </header>

        {/* ── Main content (light) ── */}
        <main className="min-h-[calc(100vh-140px)] bg-[#f5f6f8]">
          {children}
        </main>

        {/* ── Footer (dark) ── */}
        <footer className="bg-[#0a0a0f] border-t border-white/10 py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://trigent.com/wp-content/uploads/trigent-_yellow-white-ho.svg"
              alt="Trigent"
              className="h-5 w-auto opacity-50"
            />
            <p className="text-white/30 text-xs">
              &copy; 2026 Trigent Software. All Rights Reserved.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
