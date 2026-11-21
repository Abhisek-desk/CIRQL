import { useState } from "react";
import { useDispatch } from "react-redux";
import { motion, AnimatePresence } from "motion/react";
import { LogOut, ChevronUp, UserRound } from "lucide-react";
import toast from "react-hot-toast";

import authService from "../../services/authService";
import { logout } from "../../features/auth/authSlice";

export default function ProfileMenu({ user }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
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
            {user?.email || ""}
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
            className="absolute bottom-full left-0 z-50 mb-2 w-full min-w-[210px] rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-xl"
          >
            <div className="border-b border-[var(--border)] px-3 py-3">
              <p className="truncate text-sm font-semibold text-[var(--text)]">
                {user?.name}
              </p>
              <p className="truncate text-xs text-[var(--muted)]">
                {user?.email}
              </p>
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
