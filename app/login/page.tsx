"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";

function LockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 3l18 18" />
      <path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c7 0 10.5 7 10.5 7a13.2 13.2 0 0 1-3.1 4.1M6.4 6.4A13.4 13.4 0 0 0 1.5 12S5 19 12 19a10.7 10.7 0 0 0 4.6-1" />
      <path d="M9.5 9.9A3 3 0 0 0 12 15a3 3 0 0 0 2.1-.9" />
    </svg>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Login failed");
        return;
      }
      const next = searchParams.get("next") ?? "/courses";
      router.push(next);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-sm flex-col gap-5 rounded-2xl border border-white/10 bg-white/[0.06] p-8 shadow-2xl shadow-black/40 backdrop-blur-xl"
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="rounded-xl bg-black/40 p-2.5 ring-1 ring-white/10">
          <Image
            src="/brand/hazwoper-logo.png"
            alt="Hazwoper Osha Training LLC"
            width={168}
            height={31}
            priority
          />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-white">Course Generator</h1>
          <p className="mt-1 text-sm text-white/50">Enter the shared password to continue.</p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-xs font-medium tracking-wide text-white/40 uppercase">
          Password
        </label>
        <div className="relative">
          <LockIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-lg border border-white/10 bg-black/30 py-2.5 pr-10 pl-10 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-accent/60 focus:ring-2 focus:ring-accent/30"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute top-1/2 right-3 -translate-y-1/2 text-white/35 hover:text-white/70"
          >
            {showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !password}
        className="rounded-lg bg-accent py-2.5 text-sm font-semibold text-navy-deep transition disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:brightness-95"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>

      <p className="flex items-center justify-center gap-1.5 text-[11px] text-white/30">
        <LockIcon className="h-3 w-3" />
        Restricted access — authorized users only
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-navy-deep p-6">
      <div className="pointer-events-none absolute inset-0 [background:radial-gradient(circle_at_20%_20%,rgba(255,205,8,0.16),transparent_35%),radial-gradient(circle_at_80%_75%,rgba(255,205,8,0.1),transparent_35%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.05] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:32px_32px]" />
      <div className="absolute inset-x-0 top-0 h-1.5 [background:repeating-linear-gradient(45deg,var(--accent)_0,var(--accent)_10px,#111_10px,#111_20px)]" />
      <div className="absolute inset-x-0 bottom-0 h-1.5 [background:repeating-linear-gradient(45deg,var(--accent)_0,var(--accent)_10px,#111_10px,#111_20px)]" />

      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
