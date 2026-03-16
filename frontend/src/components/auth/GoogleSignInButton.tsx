"use client";

import { useEffect, useRef, useState } from "react";

import { GoogleButton } from "@/components/auth/GoogleButton";
import { fetchGoogleSignInConfig } from "@/lib/auth";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

type GoogleSignInButtonProps = {
  onCredential: (response: { credential: string }) => void | Promise<void>;
  loading?: boolean;
  text?: string;
};

export function GoogleSignInButton({
  onCredential,
  loading = false,
  text = "Continue with Google",
}: GoogleSignInButtonProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchGoogleSignInConfig()
      .then((config) => {
        if (!cancelled) {
          setClientId(config.client_id);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setClientId(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!clientId || !overlayRef.current || !wrapperRef.current) return;

    let cancelled = false;

    const initializeButton = () => {
      if (cancelled || !window.google?.accounts.id || !overlayRef.current || !wrapperRef.current) return;

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: onCredential,
      });

      overlayRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(overlayRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        width: wrapperRef.current.offsetWidth,
      });
      setReady(true);
    };

    if (window.google?.accounts.id) {
      initializeButton();
      return () => {
        cancelled = true;
      };
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = initializeButton;
    document.head.appendChild(script);

    return () => {
      cancelled = true;
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, [clientId, onCredential]);

  return (
    <div ref={wrapperRef} className="relative w-full">
      <GoogleButton
        onClick={() => {}}
        disabled={!clientId || !ready || loading}
        loading={loading}
      >
        {text}
      </GoogleButton>
      {!loading && clientId ? (
        <div
          ref={overlayRef}
          className={`absolute inset-0 overflow-hidden rounded-lg ${ready ? "opacity-0" : "pointer-events-none opacity-0"}`}
          aria-hidden="true"
        />
      ) : null}
    </div>
  );
}
