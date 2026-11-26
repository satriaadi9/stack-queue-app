import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, IBM_Plex_Sans_Condensed, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";

const bodoni = Bodoni_Moda({ variable: "--font-bodoni", subsets: ["latin"], display: "swap" });
const plex = IBM_Plex_Sans_Condensed({
  variable: "--font-plex",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});
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
      <body className={`${bodoni.variable} ${plex.variable} ${jet.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
