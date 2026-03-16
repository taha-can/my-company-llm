import type { Metadata } from "next";
import { LandingContent } from "./landing-content";

export const metadata: Metadata = {
  title: "my-company-llm — Manage Your Digital Company with AI-Powered Teams",
  description:
    "The all-in-one platform for building, managing, and scaling your digital company. Create AI departments, assign tasks, automate marketing, and direct your entire workforce from a single dashboard.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "my-company-llm — Manage Your Digital Company with AI-Powered Teams",
    description:
      "Build and manage your digital company with AI-powered teams. Automate operations, track projects, and scale your business.",
    url: "/",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "my-company-llm",
      url: process.env.NEXT_PUBLIC_SITE_URL || "https://my-company-llm.com",
      logo: `${process.env.NEXT_PUBLIC_SITE_URL || "https://my-company-llm.com"}/og-image.png`,
      description:
        "AI-powered digital company management platform for building, managing, and scaling business operations.",
    },
    {
      "@type": "SoftwareApplication",
      name: "my-company-llm",
      description:
        "AI-powered digital company management platform. Build departments, add AI team members, automate operations, and scale your business from a single dashboard.",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        description: "Free to start. No credit card required.",
      },
      featureList: [
        "AI Team Management",
        "Department Organization",
        "Knowledge Base & Document Management",
        "Project Tracking & Task Automation",
        "Marketing Automation",
        "Company Dashboard & Analytics",
      ],
    },
    {
      "@type": "WebSite",
      name: "my-company-llm",
      url: process.env.NEXT_PUBLIC_SITE_URL || "https://my-company-llm.com",
    },
  ],
};

export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingContent />
    </>
  );
}
