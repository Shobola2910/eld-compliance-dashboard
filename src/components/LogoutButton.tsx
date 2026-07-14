"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="mt-2 w-full rounded-md px-3 py-2 text-left text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-100"
    >
      Sign out
    </button>
  );
}
