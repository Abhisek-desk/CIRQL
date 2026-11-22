import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Search,
  X,
  LoaderCircle,
  MessageSquare,
  Clock,
  Filter,
  RotateCcw,
} from "lucide-react";

function HighlightText({ text, query }) {
  const value = String(text || "");

  if (!query?.trim()) return value;

  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = value.split(new RegExp(`(${escaped})`, "gi"));

  return parts.map((part, index) =>
    part.toLowerCase() === query.trim().toLowerCase() ? (
      <mark
        key={index}
        className="rounded bg-indigo-500/20 px-0.5 font-semibold text-indigo-500"
      >
        {part}
      </mark>
    ) : (
      <span key={index}>{part}</span>
    )
  );
}

export default function MessageSearch({
  open,
  onClose,
  channel,
  query,
  onQueryChange,
  results = [],
  loading = false,
  error = "",
  onSelectResult,
  members = [],
  filters,
  onFiltersChange,
  onClearFilters,
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const formatDate = (date) => {
    if (!date) return "";

    return new Date(date).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const updateFilter = (key, value) => {
    onFiltersChange?.((previous) => ({
      ...previous,
      [key]: value,
      ...(key === "dateFilter" && value !== "custom"
        ? { date: "" }
        : {}),
    }));
  };

  const activeFilters =
    filters?.senderId ||
    (filters?.dateFilter && filters.dateFilter !== "all");

  const getMemberId = (member) =>
    member.userId?._id || member._id || member.user?._id || "";

  const getMemberName = (member) =>
    member.userId?.name ||
    member.user?.name ||
    member.name ||
    "Unknown user";

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
          />

          <motion.section
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="fixed left-1/2 top-24 z-50 w-[calc(100%-24px)] max-w-2xl -translate-x-1/2 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg)] shadow-2xl"
          >
            {/* SEARCH INPUT */}
            <div className="flex items-center gap-3 border-b border-[var(--border)] p-4">
              <Search size={20} className="shrink-0 text-indigo-500" />

              <input
                ref={inputRef}
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") onClose();
                }}
                placeholder={`Search messages in #${channel?.name || "channel"}...`}
                maxLength={100}
                className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
              />

              {loading && (
                <LoaderCircle
                  size={18}
                  className="animate-spin text-indigo-500"
                />
              )}

              <button
                onClick={onClose}
                aria-label="Close search"
                className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface)]"
              >
                <X size={18} />
              </button>
            </div>

            {/* FILTERS */}
            <div className="space-y-3 border-b border-[var(--border)] p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                  <Filter size={16} className="text-indigo-500" />
                  Search filters
                </div>

                <button
                  onClick={onClearFilters}
                  disabled={!activeFilters}
                  className="flex items-center gap-1.5 text-xs text-[var(--muted)] transition hover:text-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <RotateCcw size={13} />
                  Clear filters
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {/* SENDER */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">
                    Sent by
                  </label>

                  <select
                    value={filters?.senderId || ""}
                    onChange={(event) =>
                      updateFilter("senderId", event.target.value)
                    }
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-indigo-500"
                  >
                    <option value="">Anyone</option>

                    {members.map((member) => {
                      const id = getMemberId(member);

                      if (!id) return null;

                      return (
                        <option key={id} value={id}>
                          {getMemberName(member)}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* DATE */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">
                    Date range
                  </label>

                  <select
                    value={filters?.dateFilter || "all"}
                    onChange={(event) =>
                      updateFilter("dateFilter", event.target.value)
                    }
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-indigo-500"
                  >
                    <option value="all">Any time</option>
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="7days">Last 7 days</option>
                    <option value="custom">Specific date</option>
                  </select>
                </div>
              </div>

              {filters?.dateFilter === "custom" && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">
                    Choose date
                  </label>

                  <input
                    type="date"
                    value={filters?.date || ""}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(event) =>
                      updateFilter("date", event.target.value)
                    }
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-indigo-500"
                  />
                </div>
              )}
            </div>

            {/* RESULTS */}
            <div className="max-h-[min(50vh,400px)] overflow-y-auto p-3">
              {!query.trim() ? (
                <div className="flex flex-col items-center py-10 text-center">
                  <Search size={30} className="mb-3 text-[var(--muted)]" />

                  <p className="text-sm font-medium text-[var(--text)]">
                    Search this channel
                  </p>

                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Enter a keyword and optionally apply filters.
                  </p>
                </div>
              ) : loading && results.length === 0 ? (
                <div className="py-10 text-center text-sm text-[var(--muted)]">
                  Searching messages...
                </div>
              ) : error ? (
                <div className="py-10 text-center text-sm text-red-400">
                  {error}
                </div>
              ) : results.length === 0 ? (
                <div className="py-10 text-center">
                  <MessageSquare
                    size={28}
                    className="mx-auto mb-3 text-[var(--muted)]"
                  />

                  <p className="text-sm text-[var(--text)]">
                    No matching messages found
                  </p>

                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Try another keyword or change your filters.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                    {results.length} search results
                  </p>

                  {results.map((message) => (
                    <button
                      key={message._id}
                      onClick={() => onSelectResult?.(message)}
                      className="w-full rounded-xl p-3 text-left transition hover:bg-[var(--surface)]"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-semibold text-[var(--text)]">
                          {message.sender?.name || "Unknown user"}
                        </span>

                        <span className="flex shrink-0 items-center gap-1 text-[11px] text-[var(--muted)]">
                          <Clock size={12} />
                          {formatDate(message.createdAt)}
                        </span>
                      </div>

                      <p className="break-words text-sm leading-relaxed text-[var(--muted)]">
                        <HighlightText
                          text={message.content}
                          query={query}
                        />
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.section>
        </>
      )}
    </AnimatePresence>
  );
}