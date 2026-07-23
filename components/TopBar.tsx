"use client";

import Image from "next/image";
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
    <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
      <Link href="/courses" className="flex items-center gap-3 font-semibold">
        <Image src="/brand/hazwoper-logo.png" alt="Hazwoper Osha Training LLC" width={154} height={28} />
        COURSE GENERATOR
      </Link>
      <nav className="flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/courses" className="hover:text-zinc-900">
          Course List
        </Link>
        <span>-</span>
        <button onClick={logout} className="hover:text-zinc-900">
          Sign Out
        </button>
      </nav>
    </header>
  );
}
