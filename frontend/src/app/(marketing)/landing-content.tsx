"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import {
  ArrowRight,
  CheckCircle2,
  Mail,
  Loader2,
  Building2,
  Bot,
  MessageSquare,
  GitBranch,
} from "lucide-react";
import { toast } from "sonner";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.12 } },
};

/* ━━━━━━━━━━━━━━━━━━ Waitlist Form ━━━━━━━━━━━━━━━━━━ */

function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "landing" }),
      });
      if (res.ok) {
        setSubmitted(true);
        setEmail("");
        toast.success("You're on the list! We'll be in touch soon.");
      } else if (res.status === 409) {
        toast.info("You're already on the waiting list!");
        setSubmitted(true);
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    } catch {
      toast.error("Unable to connect. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex items-center gap-2 font-medium text-emerald-600">
        <CheckCircle2 className="h-5 w-5" />
        <span>You&apos;re on the list. We&apos;ll notify you at launch.</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-md gap-2.5">
      <div className="relative flex-1">
        <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your work email"
          className="h-12 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="h-12 rounded-xl bg-gray-900 px-6 text-sm font-semibold text-white transition-all duration-200 flex items-center gap-2 hover:bg-gray-800 disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            Get Early Access
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
    </form>
  );
}

/* ━━━━━━━━━━━━━━━━━━ Section 1: Hero ━━━━━━━━━━━━━━━━━━ */

function HeroSection() {
  return (
    <section className="relative bg-white pt-32 pb-24 sm:pt-40 sm:pb-32">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="flex flex-col items-center"
        >
          <motion.div variants={fadeUp} transition={{ duration: 0.5 }}>
            <Image
              src="/logo.png"
              alt="my-company-llm"
              width={200}
              height={48}
              className="h-12 w-auto mb-8"
            />
          </motion.div>

          <motion.div
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="text-[13px] font-medium text-emerald-700">Beta</span>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            transition={{ duration: 0.6 }}
            className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl md:text-6xl"
          >
            Run your company
            <br />
            <span className="text-emerald-600">with AI agents.</span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            transition={{ duration: 0.6 }}
            className="mt-6 max-w-lg text-lg text-gray-500 leading-relaxed"
          >
            Create departments, deploy AI agents with real roles, and manage
            everything through natural language. One platform, entire workforce.
          </motion.p>

          <motion.div
            variants={fadeUp}
            transition={{ duration: 0.6 }}
            className="mt-10 w-full flex flex-col items-center"
          >
            <WaitlistForm />
            <p className="mt-3 text-[13px] text-gray-400">
              Free to start &middot; No credit card required
            </p>
          </motion.div>
        </motion.div>
      </div>

      {/* How it works */}
      <div className="mx-auto max-w-4xl px-6 mt-28">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={stagger}
          className="grid gap-px bg-gray-100 rounded-2xl overflow-hidden border border-gray-100 sm:grid-cols-4"
        >
          {[
            { icon: Building2, label: "Create departments", desc: "Engineering, Marketing, Sales..." },
            { icon: Bot, label: "Deploy AI agents", desc: "Each with roles, memory & tools" },
            { icon: MessageSquare, label: "Give directives", desc: "Type naturally, like a CEO" },
            { icon: GitBranch, label: "Auto-routing", desc: "Right team, right agent, done" },
          ].map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.label}
                variants={fadeUp}
                transition={{ duration: 0.5 }}
                className="bg-white p-6 text-center"
              >
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50 border border-gray-100">
                  <Icon className="h-5 w-5 text-gray-600" />
                </div>
                <p className="text-xs font-semibold text-gray-400 mb-1">Step {i + 1}</p>
                <p className="text-sm font-semibold text-gray-900">{step.label}</p>
                <p className="mt-1 text-[13px] text-gray-500">{step.desc}</p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

/* ━━━━━━━━━━━━━━━━━━ Section 2: CTA ━━━━━━━━━━━━━━━━━━ */

function CTASection() {
  return (
    <section className="bg-gray-50 py-24 sm:py-32">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6 }}
        className="mx-auto max-w-2xl px-6 text-center"
      >
        <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
          Ready to build your AI company?
        </h2>

        <p className="mt-4 text-lg text-gray-500 leading-relaxed">
          Join the beta and be among the first to run a company with AI-powered
          departments and agents.
        </p>

        <div className="mt-8 flex flex-col items-center gap-4">
          <WaitlistForm />
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] text-gray-400">
            {["Open source", "Self-hostable", "MIT license"].map((text) => (
              <span key={text} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                {text}
              </span>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  );
}

/* ━━━━━━━━━━━━━━━━━━ Main Export ━━━━━━━━━━━━━━━━━━ */

export function LandingContent() {
  return (
    <>
      <HeroSection />
      <CTASection />
    </>
  );
}
