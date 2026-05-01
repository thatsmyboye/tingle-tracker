"use client";

import { useState, type FormEvent } from "react";
import { getSupabaseBrowserClient } from "@tingle/database";
import type { CreatorIntakeSubmission, IntakeStatus } from "@tingle/types";

const STATUS_STYLES: Record<IntakeStatus, string> = {
  pending: "border-tingle-gold/30 bg-tingle-gold/10 text-tingle-gold",
  approved: "border-tingle-aqua/30 bg-tingle-aqua/10 text-tingle-aqua",
  rejected: "border-red-500/30 bg-red-500/10 text-red-400",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

interface Props {
  initialSubmissions: CreatorIntakeSubmission[];
}

export default function SubmitForm({ initialSubmissions }: Props) {
  const [channelUrl, setChannelUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<CreatorIntakeSubmission[]>(initialSubmissions);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setErrorMsg("You must be signed in to submit a channel.");
        return;
      }

      const res = await fetch("/api/creator-intake", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ channelUrl }),
      });

      const json = await res.json();

      if (!res.ok) {
        setErrorMsg(json.error ?? "Something went wrong. Please try again.");
        return;
      }

      setSuccessMsg(
        `"${(json.submission as CreatorIntakeSubmission).channel_title}" has been submitted for review. We'll evaluate it shortly.`
      );
      setChannelUrl("");
      setSubmissions((prev) => [json.submission as CreatorIntakeSubmission, ...prev]);
    } catch {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-10">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="channelUrl" className="block text-sm font-medium text-surface-muted mb-1">
            YouTube channel URL, @handle, or channel ID
          </label>
          <input
            id="channelUrl"
            type="text"
            value={channelUrl}
            onChange={(e) => setChannelUrl(e.target.value)}
            placeholder="https://youtube.com/@YourASMRChannel"
            required
            className="w-full rounded-lg border border-white/10 bg-surface-elevated px-4 py-2.5 text-sm text-white placeholder:text-surface-muted focus:outline-none focus:ring-2 focus:ring-tingle-aqua/50"
          />
        </div>

        {successMsg && (
          <p className="rounded-lg border border-tingle-aqua/30 bg-tingle-aqua/10 px-4 py-3 text-sm text-tingle-aqua">
            {successMsg}
          </p>
        )}
        {errorMsg && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {errorMsg}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || !channelUrl.trim()}
          className="rounded-lg bg-tingle-aqua px-5 py-2.5 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit for review"}
        </button>
      </form>

      {submissions.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-surface-muted">
            Your submissions
          </h2>
          <ul className="space-y-3">
            {submissions.map((s) => (
              <li
                key={s.id}
                className="rounded-lg border border-white/10 bg-surface-elevated px-4 py-3 text-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">{s.channel_title}</p>
                    <p className="text-xs text-surface-muted mt-0.5">
                      {s.youtube_channel_id} · Submitted {formatDate(s.created_at)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[s.status as IntakeStatus]}`}
                  >
                    {s.status}
                  </span>
                </div>
                {s.status === "rejected" && s.rejection_reason && (
                  <p className="mt-2 text-xs text-red-400">
                    Reason: {s.rejection_reason}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
