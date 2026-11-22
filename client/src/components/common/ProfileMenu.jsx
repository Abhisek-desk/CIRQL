import { useState } from "react";
import { useDispatch } from "react-redux";
import { motion, AnimatePresence } from "motion/react";
import {
  LogOut,
  ChevronUp,
  UserRound,
  Check,
  X,
  Clock,
  MessageSquare,
} from "lucide-react";
import toast from "react-hot-toast";

import authService from "../../services/authService";
import presenceService from "../../features/presence/presenceService";
import { logout } from "../../features/auth/authSlice";

const STATUS_PRESETS = [
  { emoji: "📅", text: "In a meeting" },
  { emoji: "🏡", text: "Working remotely" },
  { emoji: "🎯", text: "Focusing" },
  { emoji: "🤒", text: "Out sick" },
  { emoji: "🌴", text: "On vacation" },
  { emoji: "☕", text: "Taking a break" },
];

export default function ProfileMenu({ user }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState(user?.customStatusText || "");
  const [statusEmoji, setStatusEmoji] = useState(user?.customStatusEmoji || "💬");
  const [expiresIn, setExpiresIn] = useState("never");
  const [savingStatus, setSavingStatus] = useState(false);

  const dispatch = useDispatch();

  const handleLogout = async () => {
    if (loading) return;

    setLoading(true);

    try {
      await authService.logout();
    } catch (error) {
      console.error("Logout request failed:", error.message);
    } finally {
      dispatch(logout());
      toast.success("You've been logged out");
      window.location.replace("/login");
    }
  };

  const handleSaveStatus = async () => {
    if (savingStatus) return;

    if (!statusText.trim()) {
      toast.error("Enter a status message first");
      return;
    }

    setSavingStatus(true);

    try {
      let expiresAt = null;

      if (expiresIn !== "never") {
        const now = new Date();
        const durations = {
          hour: 60 * 60 * 1000,
          fourHours: 4 * 60 * 60 * 1000,
          today: null,
        };

        if (expiresIn === "today") {
          now.setHours(23, 59, 59, 999);
          expiresAt = now.toISOString();
        } else {
          expiresAt = new Date(
            Date.now() + durations[expiresIn],
          ).toISOString();
        }
      }

      await presenceService.updateStatus({
        text: statusText.trim(),
        emoji: statusEmoji,
        expiresAt,
      });

      toast.success("Status updated");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not update status");
    } finally {
      setSavingStatus(false);
    }
  };

  const handleClearStatus = async () => {
    setSavingStatus(true);

    try {
      await presenceService.clearStatus();
      setStatusText("");
      setStatusEmoji("💬");
      toast.success("Status cleared");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not clear status");
    } finally {
      setSavingStatus(false);
    }
  };

  const initials = (user?.name || "User")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative min-w-0 flex-1">
      <button
        onClick={() => setOpen((value) => !value)}
        className="flex w-full min-w-0 items-center gap-3 rounded-xl p-2 text-left transition hover:bg-[var(--surface-hover)]"
      >
        {user?.avatar ? (
          <img
            src={user.avatar}
            alt=""
            className="h-10 w-10 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white">
            {initials}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--text)]">
            {user?.name || "User"}
          </p>
          <p className="truncate text-xs text-[var(--muted)]">
            {user?.customStatusEmoji && user?.customStatusText
              ? `${user.customStatusEmoji} ${user.customStatusText}`
              : user?.email || ""}
          </p>
        </div>

        <ChevronUp
          size={16}
          className={`shrink-0 text-[var(--muted)] transition ${open ? "" : "rotate-180"}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            className="absolute bottom-full left-0 z-50 mb-2 max-h-[75vh] w-full min-w-[250px] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-xl"
          >
            <div className="border-b border-[var(--border)] px-3 py-3">
              <p className="truncate text-sm font-semibold text-[var(--text)]">
                {user?.name}
              </p>
              <p className="truncate text-xs text-[var(--muted)]">
                {user?.email}
              </p>
            </div>

            <div className="border-b border-[var(--border)] py-3">
              <div className="mb-3 flex items-center gap-2 px-3">
                <MessageSquare size={15} className="text-indigo-500" />
                <span className="text-xs font-semibold text-[var(--text)]">
                  Set a custom status
                </span>
              </div>

              <div className="flex gap-2 px-2">
                <input
                  value={statusEmoji}
                  onChange={(event) => setStatusEmoji(event.target.value)}
                  maxLength={12}
                  aria-label="Status emoji"
                  className="w-12 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 text-center text-lg text-[var(--text)] outline-none focus:border-indigo-500"
                />

                <input
                  value={statusText}
                  onChange={(event) => setStatusText(event.target.value)}
                  maxLength={80}
                  placeholder="What are you up to?"
                  className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs text-[var(--text)] outline-none focus:border-indigo-500"
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5 px-2">
                {STATUS_PRESETS.map((preset) => (
                  <button
                    key={preset.text}
                    onClick={() => {
                      setStatusEmoji(preset.emoji);
                      setStatusText(preset.text);
                    }}
                    className="rounded-lg border border-[var(--border)] px-2 py-1 text-[10px] text-[var(--muted)] transition hover:border-indigo-500 hover:text-indigo-500"
                  >
                    {preset.emoji} {preset.text}
                  </button>
                ))}
              </div>

              <div className="mt-3 flex items-center gap-2 px-2">
                <Clock size={14} className="shrink-0 text-[var(--muted)]" />
                <select
                  value={expiresIn}
                  onChange={(event) => setExpiresIn(event.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-2 text-xs text-[var(--text)] outline-none"
                >
                  <option value="never">Don't clear</option>
                  <option value="hour">Clear after 1 hour</option>
                  <option value="fourHours">Clear after 4 hours</option>
                  <option value="today">Clear tonight</option>
                </select>
              </div>

              <div className="mt-3 flex gap-2 px-2">
                <button
                  onClick={handleSaveStatus}
                  disabled={savingStatus}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
                >
                  <Check size={14} />
                  {savingStatus ? "Saving..." : "Save status"}
                </button>

                <button
                  onClick={handleClearStatus}
                  disabled={savingStatus}
                  title="Clear status"
                  className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs text-[var(--muted)] transition hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="py-1">
              <div className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--muted)]">
                <UserRound size={17} />
                Account
              </div>

              <button
                onClick={handleLogout}
                disabled={loading}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-red-500 transition hover:bg-red-500/10 disabled:opacity-50"
              >
                <LogOut size={17} />
                {loading ? "Logging out..." : "Sign out"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
