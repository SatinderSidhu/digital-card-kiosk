"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, ArrowLeft } from "lucide-react";
import clsx from "clsx";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const onTab = (path: string) =>
    pathname === path || pathname.startsWith(`${path}/`);

  const showBack = pathname !== "/admin";

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.refresh();
  };

  return (
    <div
      className="min-h-dvh w-full"
      style={{ touchAction: "auto", userSelect: "text" }}
    >
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 px-5 py-3 backdrop-blur-md bg-[color:var(--background)]/80 border-b border-white/5">
        <div className="flex items-center gap-3 min-w-0">
          {showBack ? (
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 text-white/65 hover:text-white text-sm"
            >
              <ArrowLeft size={16} /> Back
            </Link>
          ) : (
            <Link
              href="/"
              className="flex items-center gap-2 min-w-0 text-white/70 hover:text-white"
            >
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-[#7c5cff] to-[#22d3ee] grid place-items-center text-xs font-black text-white">
                ◆
              </div>
              <span className="text-sm font-semibold tracking-tight">
                Admin
              </span>
            </Link>
          )}

          {!showBack && (
            <nav className="flex items-center gap-1 ml-2">
              <TabLink href="/admin" active={onTab("/admin") && pathname === "/admin"}>
                Overview
              </TabLink>
            </nav>
          )}
        </div>

        <button
          onClick={logout}
          className="inline-flex items-center gap-1.5 text-xs text-white/55 hover:text-white px-2.5 py-1.5 rounded-full hover:bg-white/5"
        >
          <LogOut size={14} /> Sign out
        </button>
      </header>

      <main className="w-full max-w-5xl mx-auto px-5 py-6">{children}</main>
    </div>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        "px-3 py-1.5 rounded-full text-sm transition-colors",
        active
          ? "bg-white/10 text-white"
          : "text-white/65 hover:text-white hover:bg-white/5",
      )}
    >
      {children}
    </Link>
  );
}
