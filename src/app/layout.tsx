import type { Metadata } from "next";
import { Public_Sans, Source_Serif_4 } from "next/font/google";
import { Suspense } from "react";
import { ReaderStatus } from "@/components/ReaderStatus";
import { DemoBanner, SiteHeader, SiteHeaderShell } from "@/components/SiteHeader";
import "./globals.css";

const publicSans = Public_Sans({ variable: "--font-public-sans", subsets: ["latin"] });
const sourceSerif = Source_Serif_4({ variable: "--font-source-serif", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Label Check",
  description: "Check an alcohol beverage label against its application.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${publicSans.variable} ${sourceSerif.variable} antialiased`}>
      <body className="min-h-screen flex flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:bg-white focus:px-4 focus:py-2"
        >
          Skip to main content
        </a>
        {/* Who is signed in lives in this browser, so the header renders there. */}
        <Suspense fallback={<SiteHeaderShell />}>
          <SiteHeader />
          <DemoBanner />
        </Suspense>
        <ReaderStatus />
        <main id="main" className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-8">
          {children}
        </main>
        <footer className="border-t border-line-soft bg-white">
          <p className="max-w-6xl mx-auto px-4 sm:px-6 py-4 text-sm text-muted">
            Prototype. Results are a guide; the agent makes the final call. Labels are read on this computer
            and never uploaded. Sign-in, the queue and decisions are a demo, kept only in this browser.
          </p>
        </footer>
      </body>
    </html>
  );
}
