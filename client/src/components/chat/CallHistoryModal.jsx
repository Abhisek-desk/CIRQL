import { useCallback, useEffect, useState } from "react";
import { Clock, Phone, Video, X, RefreshCw } from "lucide-react";
import callService from "../../features/messages/callService";

const STATUS_STYLES = {
  completed: "text-emerald-500",
  missed: "text-red-500",
  rejected: "text-red-500",
  cancelled: "text-zinc-400",
  failed: "text-amber-500",
  ringing: "text-amber-500",
  ongoing: "text-emerald-500",
};

const formatDate = (value) => {
  if (!value) return "";
  return new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const formatDuration = (seconds = 0) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${String(remainingSeconds).padStart(2, "0")}s`;
};

export default function CallHistoryModal({
  open,
  onClose,
  conversationId,
  currentUserId,
}) {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadHistory = useCallback(async () => {
    if (!conversationId) return;

    setLoading(true);
    setError("");

    try {
      const result = await callService.getHistory(conversationId);
      setCalls(result.calls || []);
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to load call history.",
      );
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    if (open) loadHistory();
  }, [open, loadHistory]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="call-history-title"
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-indigo-500/10 p-2 text-indigo-500">
              <Clock size={19} />
            </div>
            <div>
              <h2
                id="call-history-title"
                className="font-semibold text-[var(--text)]"
              >
                Call history
              </h2>
              <p className="text-xs text-[var(--muted)]">
                Recent voice and video calls
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={loadHistory}
              disabled={loading}
              title="Refresh history"
              aria-label="Refresh call history"
              className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--bg)] disabled:opacity-40"
            >
              <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close call history"
              className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--bg)]"
            >
              <X size={19} />
            </button>
          </div>
        </header>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
          {loading && calls.length === 0 ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500/20 border-t-indigo-500" />
            </div>
          ) : error ? (
            <div className="py-10 text-center">
              <p role="alert" className="text-sm text-red-500">{error}</p>
              <button
                type="button"
                onClick={loadHistory}
                className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                Try again
              </button>
            </div>
          ) : calls.length === 0 ? (
            <div className="py-12 text-center">
              <Clock size={34} className="mx-auto text-[var(--muted)]" />
              <p className="mt-3 font-medium text-[var(--text)]">
                No calls yet
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Your calls with this person will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {calls.map((call) => {
                const callerId = String(
                  call.caller?._id || call.caller || "",
                );
                const isOutgoing = callerId === String(currentUserId);
                const otherPerson = isOutgoing ? call.callee : call.caller;
                const personName =
                  typeof otherPerson === "object"
                    ? otherPerson?.name || "CIRQL user"
                    : "CIRQL user";

                return (
                  <article
                    key={call._id || call.callId}
                    className="flex items-center gap-3 rounded-xl border border-[var(--border)] p-3"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-500">
                      {call.mode === "video" ? (
                        <Video size={18} />
                      ) : (
                        <Phone size={18} />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--text)]">
                        {personName}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--muted)]">
                        {isOutgoing ? "Outgoing" : "Incoming"} ·{" "}
                        {call.mode === "video" ? "Video" : "Voice"} ·{" "}
                        {formatDate(call.createdAt)}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p
                        className={`text-xs font-semibold capitalize ${
                          STATUS_STYLES[call.status] || "text-[var(--muted)]"
                        }`}
                      >
                        {call.status}
                      </p>
                      {call.status === "completed" && (
                        <p className="mt-1 text-[10px] text-[var(--muted)]">
                          {formatDuration(call.durationSeconds)}
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
