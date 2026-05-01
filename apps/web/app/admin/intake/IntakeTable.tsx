"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@tingle/database";
import type { CreatorIntakeSubmission, IntakeStatus } from "@tingle/types";

const STATUS_STYLES: Record<IntakeStatus, string> = {
  pending: "border-tingle-gold/30 bg-tingle-gold/10 text-tingle-gold",
  approved: "border-tingle-aqua/30 bg-tingle-aqua/10 text-tingle-aqua",
  rejected: "border-red-500/30 bg-red-500/10 text-red-400",
};

const FILTERS = ["all", "pending", "approved", "rejected"] as const;
type Filter = (typeof FILTERS)[number];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function IntakeTable() {
  const [filter, setFilter] = useState<Filter>("pending");
  const [submissions, setSubmissions] = useState<CreatorIntakeSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<Set<string>>(new Set());
  const [rejectionInputs, setRejectionInputs] = useState<Record<string, string>>({});
  const [rejecting, setRejecting] = useState<Set<string>>(new Set());

  async function getToken() {
    const supabase = getSupabaseBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }

  async function loadSubmissions(statusFilter: Filter) {
    setLoading(true);
    setFetchError(null);
    const token = await getToken();
    if (!token) { setFetchError("Not authenticated"); setLoading(false); return; }

    const url = statusFilter === "all"
      ? "/api/admin/creator-intake"
      : `/api/admin/creator-intake?status=${statusFilter}`;

    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const json = await res.json();
        setFetchError(json.error ?? "Failed to load submissions");
        return;
      }
      const json = await res.json();
      setSubmissions(json.submissions ?? []);
    } catch {
      setFetchError("Network error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadSubmissions(filter); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAction(id: string, action: "approve" | "reject") {
    const token = await getToken();
    if (!token) return;

    const reason = rejectionInputs[id]?.trim();
    if (action === "reject" && !reason) return;

    setActionLoading((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/admin/creator-intake/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(
          action === "approve"
            ? { action: "approve" }
            : { action: "reject", rejection_reason: reason }
        ),
      });

      if (res.ok) {
        const json = await res.json();
        setSubmissions((prev) =>
          prev.map((s) => (s.id === id ? (json.submission as CreatorIntakeSubmission) : s))
        );
        if (action === "reject") {
          setRejecting((prev) => { const s = new Set(prev); s.delete(id); return s; });
          setRejectionInputs((prev) => { const r = { ...prev }; delete r[id]; return r; });
        }
      } else {
        const json = await res.json();
        alert(json.error ?? "Action failed");
      }
    } catch {
      alert("Network error");
    } finally {
      setActionLoading((prev) => { const s = new Set(prev); s.delete(id); return s; });
    }
  }

  function toggleReject(id: string) {
    setRejecting((prev) => {
      const s = new Set(prev);
      if (s.has(id)) { s.delete(id); } else { s.add(id); }
      return s;
    });
  }

  return (
    <div className="space-y-6">
      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg border px-4 py-1.5 text-xs font-medium capitalize transition ${
              filter === f
                ? "border-tingle-aqua bg-tingle-aqua/10 text-tingle-aqua"
                : "border-white/10 text-surface-muted hover:border-white/20 hover:text-white"
            }`}
          >
            {f}
          </button>
        ))}
        <button
          onClick={() => loadSubmissions(filter)}
          className="ml-auto rounded-lg border border-white/10 px-3 py-1.5 text-xs text-surface-muted hover:text-white"
        >
          Refresh
        </button>
      </div>

      {loading && <p className="text-sm text-surface-muted">Loading…</p>}
      {fetchError && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {fetchError}
        </p>
      )}

      {!loading && !fetchError && submissions.length === 0 && (
        <p className="text-sm text-surface-muted">No submissions found.</p>
      )}

      {!loading && submissions.length > 0 && (
        <ul className="space-y-3">
          {submissions.map((s) => {
            const isActioning = actionLoading.has(s.id);
            const isRejectOpen = rejecting.has(s.id);

            return (
              <li key={s.id} className="rounded-lg border border-white/10 bg-surface-elevated px-5 py-4 text-sm space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-white truncate">{s.channel_title}</p>
                    <p className="text-xs text-surface-muted mt-0.5">
                      {s.youtube_channel_id} · Submitted {formatDate(s.created_at)}
                    </p>
                    <p className="text-xs text-surface-muted">
                      Raw input: <span className="font-mono">{s.youtube_channel_url}</span>
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[s.status as IntakeStatus]}`}
                  >
                    {s.status}
                  </span>
                </div>

                {s.status === "rejected" && s.rejection_reason && (
                  <p className="text-xs text-red-400">Reason: {s.rejection_reason}</p>
                )}
                {s.status === "approved" && s.reviewed_at && (
                  <p className="text-xs text-surface-muted">Approved {formatDate(s.reviewed_at)}</p>
                )}

                {s.status === "pending" && (
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAction(s.id, "approve")}
                        disabled={isActioning}
                        className="rounded-lg bg-tingle-aqua px-4 py-1.5 text-xs font-semibold text-black hover:opacity-90 disabled:opacity-50"
                      >
                        {isActioning && !isRejectOpen ? "Approving…" : "Approve"}
                      </button>
                      <button
                        onClick={() => toggleReject(s.id)}
                        disabled={isActioning}
                        className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>

                    {isRejectOpen && (
                      <div className="space-y-2">
                        <textarea
                          value={rejectionInputs[s.id] ?? ""}
                          onChange={(e) =>
                            setRejectionInputs((prev) => ({ ...prev, [s.id]: e.target.value }))
                          }
                          placeholder="Reason for rejection (required)"
                          rows={2}
                          className="w-full rounded-lg border border-white/10 bg-surface px-3 py-2 text-xs text-white placeholder:text-surface-muted focus:outline-none focus:ring-1 focus:ring-red-500/50"
                        />
                        <button
                          onClick={() => handleAction(s.id, "reject")}
                          disabled={isActioning || !(rejectionInputs[s.id]?.trim())}
                          className="rounded-lg bg-red-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50"
                        >
                          {isActioning ? "Rejecting…" : "Confirm rejection"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
