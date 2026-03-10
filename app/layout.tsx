import type { Metadata } from "next";
import React from "react";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "./components/ToastProvider";

const cormorant = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const dmSans = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://leadgenos.com";

export const metadata: Metadata = {
  title: "LeadGenOS — Intelligent Lead Intelligence",
  description:
    "Find and convert B2B leads matched to your exact service. Signal-driven scoring. Personalized outreach.",
  metadataBase: new URL(BASE_URL),
  openGraph: {
    title: "LeadGenOS — Intelligent Lead Intelligence",
    description:
      "Find high-fit B2B leads using signal-driven scoring matched to your exact service profile.",
    url: BASE_URL,
    siteName: "LeadGenOS",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "LeadGenOS — Signal-driven B2B lead intelligence",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LeadGenOS — Intelligent Lead Intelligence",
    description:
      "Find high-fit B2B leads using signal-driven scoring matched to your exact service profile.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${cormorant.variable} ${dmSans.variable} antialiased`}>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
