"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { getSupabaseBrowserClient } from "@tingle/database";
import type { CreatorIntakeSubmission } from "@tingle/types";
import SubmitForm from "./SubmitForm";
import { DormantNotice } from "@/components/DormantNotice";
import { IS_DORMANT } from "@/lib/dormancy";

export default function SubmitPage() {
  const { user, isAnonymous, isLoading } = useAuth();
  const [initialSubmissions, setInitialSubmissions] = useState<CreatorIntakeSubmission[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading || !user || isAnonymous) return;

    async function loadSubmissions() {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      try {
        const res = await fetch("/api/creator-intake", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const json = await res.json();
          setInitialSubmissions(json.submissions ?? []);
        }
      } catch {
        setLoadError("Could not load your submissions.");
      }
    }

    loadSubmissions();
  }, [user, isAnonymous, isLoading]);

  // Channel intake resolves the YouTube channel through the Data API and then
  // queues it for the LLM pipeline — both metered. Off while dormant.
  if (IS_DORMANT) {
    return (
      <DormantNotice
        title="Channel submissions are paused"
        detail="Tingle Tracker is dormant, so new channels aren't being accepted or reviewed right now."
      />
    );
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-surface px-4 py-16">
        <div className="mx-auto max-w-xl text-center text-surface-muted text-sm">Loading…</div>
      </main>
    );
  }

  if (!user || isAnonymous) {
    return (
      <main className="min-h-screen bg-surface px-4 py-16">
        <div className="mx-auto max-w-xl text-center space-y-4">
          <h1 className="text-2xl font-bold text-white">Submit your channel</h1>
          <p className="text-surface-muted text-sm">
            Sign in to submit an ASMR channel for inclusion in Tingle Tracker.
          </p>
          <Link
            href="/login?next=/submit"
            className="inline-block rounded-lg bg-tingle-aqua px-5 py-2.5 text-sm font-semibold text-black hover:opacity-90"
          >
            Sign in to continue
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-surface px-4 py-16">
      <div className="mx-auto max-w-xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Submit your channel</h1>
          <p className="mt-2 text-sm text-surface-muted">
            Know an ASMR creator who should be tracked? Submit their YouTube channel below.
            Our team reviews every submission to keep the catalog dedicated to ASMR content.
          </p>
        </div>

        {loadError && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {loadError}
          </p>
        )}

        {initialSubmissions !== null ? (
          <SubmitForm initialSubmissions={initialSubmissions} />
        ) : (
          <div className="text-sm text-surface-muted">Loading your submissions…</div>
        )}
      </div>
    </main>
  );
}
