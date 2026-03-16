import Image from "next/image";
import Link from "next/link";
import { Network, Bot, ListChecks, Sparkles } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Left: branding panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[#09090b]">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[700px] w-[700px] rounded-full bg-emerald-500/[0.06] blur-[120px]" />
          <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-sky-500/[0.04] blur-[100px]" />
        </div>
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <div className="relative flex flex-col justify-between w-full p-10">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/logo.png"
              alt="my-company-llm"
              width={32}
              height={32}
              className="h-8 w-8 rounded-lg"
            />
            <span className="text-lg font-bold text-white tracking-tight">my-company-llm</span>
          </Link>

          <div className="flex-1 flex flex-col justify-center max-w-md">
            <h2 className="text-3xl font-bold text-white tracking-tight xl:text-4xl">
              Manage your digital company with AI-powered teams.
            </h2>
            <p className="mt-4 text-white/40 leading-relaxed">
              Create departments, deploy AI agents, track projects, and automate
              operations — all from a single platform.
            </p>

            <div className="mt-10 space-y-4">
              {[
                { icon: Network, text: "Build your org structure with departments" },
                { icon: Bot, text: "Deploy AI agents with specialized skills" },
                { icon: ListChecks, text: "Track projects with kanban boards" },
                { icon: Sparkles, text: "Automate operations with natural language" },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.06]">
                    <item.icon className="h-4 w-4 text-emerald-400" />
                  </div>
                  <span className="text-sm text-white/50">{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-white/15">
            &copy; {new Date().getFullYear()} my-company-llm. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right: form */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 bg-background">
        <div className="lg:hidden mb-8">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/logo.png"
              alt="my-company-llm"
              width={32}
              height={32}
              className="h-8 w-8 rounded-lg"
            />
            <span className="text-lg font-bold tracking-tight">my-company-llm</span>
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
