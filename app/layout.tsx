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
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-5">
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
            <div className="hidden sm:flex items-center gap-4">
              {/* Procure Analytics prospect logo */}
              <svg className="h-7 w-auto" viewBox="0 0 336.31 55.01" xmlns="http://www.w3.org/2000/svg">
                <path d="m0 0v55.01h31.509l20.51-55.01z" fill="#3676bc"/>
                <path d="m54.113 3.934-18.3 47.472h4.017l16.7-43.642 17.621 43.642h4.49l-19.49-47.472z" fill="#639330"/>
                <path d="m26.319 4.045c-1.07-0.11-2.02-0.11-2.02-0.11h-18.87v47.23h3.54v-19.98l7.33 0.052c2.274 0.016 4.547 0.076 6.82 0.125 4.46 0.1 17.2-0.835 17.13-14.637 0-6.96-4.04-11.74-13.93-12.68m-5.42 23.7h-12.03v-20.47l13.97 0.11c0.22 0 3.17 0.1 4.9 0.27 5.58 0.75 8.6 3.28 8.83 9.67 0.4 9.911-9.972 10.48-12.862 10.446-0.936-0.01-1.872-0.026-2.808-0.026" fill="#fff"/>
                <g fill="#ffffff">
                  <path d="m83.376 35.861v-16.284h5.724a7.1 7.1 0 0 1 2.564 0.414 3.7 3.7 0 0 1 1.622 1.116 4.666 4.666 0 0 1 0.793 1.437 5.325 5.325 0 0 1 0 3.174 4.666 4.666 0 0 1-0.793 1.437 3.7 3.7 0 0 1-1.622 1.116 7.1 7.1 0 0 1-2.564 0.414h-3.516v7.176zm2.208-14.352v5.244h2.9q3.5 0 3.5-2.622t-3.5-2.622z"/>
                  <path d="m98.394 35.861v-16.284h5.727a7.1 7.1 0 0 1 2.564 0.414 3.7 3.7 0 0 1 1.622 1.116 4.69 4.69 0 0 1 0.794 1.437 5.064 5.064 0 0 1 0.241 1.587 4.169 4.169 0 0 1-1.1 2.852 4.4 4.4 0 0 1-2.9 1.449l4.623 7.429h-2.765l-4.139-7.176h-2.461v7.176zm2.206-14.352v5.244h2.9q3.5 0 3.5-2.622t-3.5-2.622z"/>
                  <path d="m127.4 33.826a8.809 8.809 0 0 1-12.19 0 8.394 8.394 0 0 1-2.392-6.107 8.39 8.39 0 0 1 2.392-6.106 8.806 8.806 0 0 1 12.19 0 8.394 8.394 0 0 1 2.392 6.106 8.4 8.4 0 0 1-2.392 6.107m-10.534-1.495a6.194 6.194 0 0 0 8.878 0 6.608 6.608 0 0 0 1.7-4.612 6.607 6.607 0 0 0-1.7-4.611 6.192 6.192 0 0 0-8.878 0 6.607 6.607 0 0 0-1.7 4.611 6.608 6.608 0 0 0 1.7 4.612"/>
                  <path d="m147.52 21.694-1.84 1.4a4.763 4.763 0 0 0-1.737-1.368 5.074 5.074 0 0 0-2.2-0.5 5.594 5.594 0 0 0-4.381 1.9 6.848 6.848 0 0 0-1.691 4.727 6.5 6.5 0 0 0 1.656 4.508 5.652 5.652 0 0 0 4.416 1.84 4.96 4.96 0 0 0 4.255-2.18l1.863 1.4a5.607 5.607 0 0 1-0.667 0.736 10.981 10.981 0 0 1-1.161 0.92 6.309 6.309 0 0 1-1.9 0.862 8.693 8.693 0 0 1-2.438 0.334 7.994 7.994 0 0 1-4.439-1.265 8.324 8.324 0 0 1-2.944-3.163 8.515 8.515 0 0 1-0.989-3.99 8.6 8.6 0 0 1 2.375-6.255 8.154 8.154 0 0 1 6.118-2.438 8.275 8.275 0 0 1 3.22 0.644 5.917 5.917 0 0 1 2.484 1.886"/>
                  <path d="m151.62 19.577h2.208v9.982a5.462 5.462 0 0 0 1 3.232 4.091 4.091 0 0 0 6.187 0 5.461 5.461 0 0 0 1-3.232v-9.982h2.208v10.323a6.3 6.3 0 1 1-12.6 0z"/>
                  <path d="m169.49 35.861v-16.284h5.728a7.108 7.108 0 0 1 2.564 0.414 3.7 3.7 0 0 1 1.621 1.116 4.69 4.69 0 0 1 0.794 1.437 5.064 5.064 0 0 1 0.241 1.587 4.169 4.169 0 0 1-1.1 2.852 4.4 4.4 0 0 1-2.9 1.449l4.623 7.429h-2.758l-4.141-7.176h-2.459v7.176zm2.213-14.352v5.244h2.9q3.5 0 3.5-2.622t-3.5-2.622z"/>
                  <path d="m184.92 35.861v-16.284h10.511v2.07h-8.3v4.853h7.728v2.07h-7.728v5.221h8.717v2.07z"/>
                  <path d="m205.25 35.789 7.1-16.1h1.977l6.89 16.1h-2.547l-1.614-3.98h-7.663l-1.591 3.98zm4.911-5.889h6.094l-3-7.389h-0.046z"/>
                  <path d="m224.66 35.789v-16.1h2.864l8.871 13.235h0.045v-13.233h2.184v16.1h-2.774l-8.958-13.233h-0.046v13.231z"/>
                  <path d="m242.08 35.789 7.1-16.1h1.977l6.89 16.1h-2.549l-1.614-3.98h-7.666l-1.591 3.98zm4.911-5.889h6.094l-3-7.389h-0.046z"/>
                  <path d="m261.5 35.789v-16.1h2.183v14.054h7.389v2.046z"/>
                  <path d="m275.94 35.789v-6.867l-6.094-9.231h2.8l4.389 7.071 4.524-7.071h2.66l-6.093 9.231v6.867z"/>
                  <path d="m290.79 35.789v-14.052h-5.186v-2.046h12.551v2.046h-5.183v14.052z"/>
                  <rect x="301.84" y="19.691" width="2.183" height="16.098"/>
                  <path d="m322.55 21.783-1.819 1.387a4.72 4.72 0 0 0-1.716-1.353 5.028 5.028 0 0 0-2.172-0.489 5.528 5.528 0 0 0-4.331 1.876 6.769 6.769 0 0 0-1.672 4.673 6.419 6.419 0 0 0 1.638 4.456 5.582 5.582 0 0 0 4.365 1.82 4.9 4.9 0 0 0 4.206-2.161l1.842 1.387a5.552 5.552 0 0 1-0.659 0.728 10.978 10.978 0 0 1-1.149 0.909 6.163 6.163 0 0 1-1.876 0.852 8.6 8.6 0 0 1-2.41 0.33 7.9 7.9 0 0 1-4.388-1.25 8.245 8.245 0 0 1-2.911-3.127 8.426 8.426 0 0 1-0.977-3.944 8.512 8.512 0 0 1 2.341-6.185 8.068 8.068 0 0 1 6.049-2.41 8.163 8.163 0 0 1 3.183 0.637 5.842 5.842 0 0 1 2.456 1.864"/>
                  <path d="m325.57 33.97 1.8-1.546a3.81 3.81 0 0 0 3.41 1.729 3.676 3.676 0 0 0 2.206-0.728 2.3 2.3 0 0 0 1-1.956 1.865 1.865 0 0 0-0.818-1.592 6.469 6.469 0 0 0-1.99-0.931q-1.171-0.342-2.331-0.8a4.528 4.528 0 0 1-1.981-1.546 4.577 4.577 0 0 1-0.818-2.819 3.9 3.9 0 0 1 0.318-1.512 4.959 4.959 0 0 1 0.944-1.444 4.55 4.55 0 0 1 1.716-1.114 6.694 6.694 0 0 1 2.479-0.432 5.632 5.632 0 0 1 4.638 1.842l-1.773 1.614a2.931 2.931 0 0 0-1.171-1.023 3.685 3.685 0 0 0-1.694-0.387 3.234 3.234 0 0 0-2.387 0.762 2.361 2.361 0 0 0-0.751 1.694 2.165 2.165 0 0 0 0.592 1.569 3.3 3.3 0 0 0 1.466 0.875q0.876 0.262 1.91 0.625t1.91 0.762a3.442 3.442 0 0 1 1.467 1.319 4.158 4.158 0 0 1 0.59 2.285 4.505 4.505 0 0 1-1.6 3.627 5.983 5.983 0 0 1-3.991 1.353 7.813 7.813 0 0 1-2.979-0.557 4.836 4.836 0 0 1-2.16-1.672"/>
                </g>
              </svg>
              {/* Security badge */}
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1.5">
                <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="text-[11px] text-white/50 font-medium">Standalone &middot; Air-Gapped &middot; Secure</span>
              </div>
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
