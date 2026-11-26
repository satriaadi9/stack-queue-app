import type { Metadata, Viewport } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";

// Archivo: a sturdy grotesque with a width axis. Wide for headings and numbers, normal for reading.
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], axes: ["wdth"], display: "swap" });
const jet = JetBrains_Mono({ variable: "--font-jet", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Stack & Deal",
  description: "A card table where the data structure decides your payout. Stack, queue or recurse — then cash out.",
};

export const viewport: Viewport = {
  themeColor: "#23160f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${archivo.variable} ${jet.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
