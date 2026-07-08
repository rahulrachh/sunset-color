import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-serif",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

const OG_IMAGE = "/api/share?lat=37.77&lng=-122.42&name=San+Francisco";

export const metadata: Metadata = {
  metadataBase: new URL("https://sunset-color.vercel.app"),
  title: "sunset-color",
  description: "predicted sunset colors, by location",
  openGraph: {
    title: "sunset-color",
    description: "predicted sunset colors, by location",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "sunset-color",
    description: "predicted sunset colors, by location",
    images: [OG_IMAGE],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="font-sans">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
