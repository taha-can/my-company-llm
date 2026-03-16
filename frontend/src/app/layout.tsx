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
  title: {
    default: "my-company-llm — AI-Powered Digital Company Management Platform",
    template: "%s | my-company-llm",
  },
  description:
    "Build and manage your digital company with AI-powered teams. Create departments, automate operations, track projects, and scale your business — all from one intelligent platform.",
  keywords: [
    "digital company management",
    "AI team management platform",
    "business automation software",
    "AI-powered operations",
    "digital workforce management",
    "company management tool",
    "AI business platform",
    "team automation",
    "project management AI",
    "enterprise AI platform",
    "department management",
    "business operations software",
    "AI company builder",
    "workflow automation",
    "digital business management",
  ],
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://my-company-llm.com"
  ),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "my-company-llm",
    title: "my-company-llm — AI-Powered Digital Company Management Platform",
    description:
      "Build and manage your digital company with AI-powered teams. Automate operations and scale your business from one platform.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "my-company-llm — AI-Powered Digital Company Management Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "my-company-llm — AI-Powered Digital Company Management",
    description:
      "Build and manage your digital company with AI-powered teams. Automate operations and scale your business.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
