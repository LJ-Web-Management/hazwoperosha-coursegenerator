"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function TopBar() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
      <Link href="/courses" className="font-semibold">
        HAZWOPER Course Generator
      </Link>
      <button onClick={logout} className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
        Sign out
      </button>
    </header>
  );
}
