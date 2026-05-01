"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { getSupabaseBrowserClient } from "@tingle/database";
import IntakeTable from "./IntakeTable";

export default function AdminIntakePage() {
  const { user, isLoading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    const supabase = getSupabaseBrowserClient();
    supabase
      .from("user_profiles")
      .select("is_admin")
      .eq("user_id", user.id)
      .maybeSingle()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: { data: any }) => {
        setIsAdmin(!!data?.is_admin);
      });
  }, [user]);

  if (authLoading || isAdmin === null) {
    return (
      <main className="min-h-screen bg-surface px-4 py-16">
        <div className="mx-auto max-w-3xl text-sm text-surface-muted">Loading…</div>
      </main>
    );
  }

  if (!user || !isAdmin) {
    return (
      <main className="min-h-screen bg-surface px-4 py-16">
        <div className="mx-auto max-w-3xl space-y-2 text-center">
          <p className="text-lg font-semibold text-white">403 — Forbidden</p>
          <p className="text-sm text-surface-muted">You do not have access to this page.</p>
          <Link href="/" className="text-sm text-tingle-aqua hover:underline">Go home</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-surface px-4 py-16">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Creator Intake</h1>
            <p className="mt-1 text-sm text-surface-muted">
              Review and approve channel submissions from creators and fans.
            </p>
          </div>
          <Link
            href="/admin"
            className="text-xs text-surface-muted hover:text-white transition"
          >
            ← Admin
          </Link>
        </div>

        <IntakeTable />
      </div>
    </main>
  );
}
