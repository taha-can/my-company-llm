"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ArrowRight } from "lucide-react";
import { Toaster } from "sonner";

const navLinks = [
  { href: "/docs", label: "Docs" },
  { href: "/waitlist", label: "Waitlist" },
];

function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 pt-4">
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className={`w-full max-w-5xl transition-all duration-500 rounded-2xl border ${
          scrolled
            ? "border-gray-200 bg-white/80 shadow-sm backdrop-blur-2xl"
            : "border-transparent bg-transparent"
        }`}
      >
        <div className="flex h-14 items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/logo.png"
              alt="my-company-llm"
              width={120}
              height={28}
              className="h-7 w-auto"
            />
          </Link>

          <nav className="hidden md:flex items-center">
            {navLinks.map((link, i) => (
              <div key={link.label} className="flex items-center">
                {i > 0 && (
                  <span className="mx-1 h-1 w-1 rounded-full bg-gray-300" />
                )}
                <a
                  href={link.href}
                  className="px-3 py-1.5 text-[13px] font-medium text-gray-500 transition-colors duration-200 hover:text-gray-900"
                >
                  {link.label}
                </a>
              </div>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2">
            <Link
              href="/login"
              className="px-4 py-1.5 text-[13px] font-medium text-gray-500 transition-colors hover:text-gray-900"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="group flex items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-[13px] font-semibold text-white transition-all duration-200 hover:bg-gray-800"
            >
              Get Started
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          <button
            className="md:hidden p-1.5 text-gray-600"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-gray-100 md:hidden"
            >
              <div className="flex flex-col p-3 gap-0.5">
                {navLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    className="rounded-lg px-3 py-2.5 text-[13px] font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
                    onClick={() => setMobileOpen(false)}
                  >
                    {link.label}
                  </a>
                ))}
                <div className="mt-2 border-t border-gray-100 pt-3 flex flex-col gap-2">
                  <Link
                    href="/login"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-xl border border-gray-200 px-4 py-2.5 text-center text-[13px] font-medium text-gray-600 transition-colors hover:bg-gray-50"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/signup"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2.5 text-center text-[13px] font-semibold text-white"
                  >
                    Get Started
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-gray-100 bg-white">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Image
              src="/logo.png"
              alt="my-company-llm"
              width={100}
              height={24}
              className="h-6 w-auto"
            />
          </div>

          <div className="flex items-center gap-6 text-[13px] text-gray-400">
            <Link href="/docs" className="transition-colors hover:text-gray-600">Docs</Link>
            <Link href="/waitlist" className="transition-colors hover:text-gray-600">Waitlist</Link>
            <Link href="/login" className="transition-colors hover:text-gray-600">Sign In</Link>
          </div>

          <p className="text-xs text-gray-400">
            &copy; {new Date().getFullYear()} my-company-llm
          </p>
        </div>
      </div>
    </footer>
  );
}

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
      <Footer />
      <Toaster position="top-center" richColors />
    </>
  );
}
