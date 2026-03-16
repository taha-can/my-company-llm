import Image from "next/image";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="flex items-center gap-2">
          <Image src="/logo.png" alt="my-company-llm" width={24} height={24} className="h-6 w-6 rounded" />
          <span className="font-bold">my-company-llm</span>
        </span>
      ),
      url: "/",
    },
    links: [
      {
        text: "Documentation",
        url: "/docs",
        active: "nested-url",
      },
      {
        text: "Launch App",
        url: "/app",
      },
    ],
  };
}
