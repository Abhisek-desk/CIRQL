import { Hash, Lock, Menu, Search, Phone, Video, Users } from "lucide-react";
import ThemeToggle from "../common/ThemeToggle";

export default function ChatHeader({
  onMenuClick,
  channel,
}) {
  return (
    <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--bg)] px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface)] lg:hidden"
          aria-label="Open channels"
        >
          <Menu size={21} />
        </button>

        {channel?.type === "private" ? (
          <Lock size={19} className="shrink-0 text-[var(--muted)]" />
        ) : (
          <Hash size={20} className="shrink-0 text-[var(--muted)]" />
        )}

        <div className="min-w-0">
          <h2 className="truncate font-semibold text-[var(--text)]">
            {channel?.name || "Welcome to CIRQL"}
          </h2>
          <p className="hidden truncate text-xs text-[var(--muted)] sm:block">
            {channel?.description || "Select a channel to start collaborating"}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-3">
        <button
          aria-label="Search"
          className="hidden rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface)] sm:block"
        >
          <Search size={19} />
        </button>
        <button
          aria-label="Voice call"
          className="hidden rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface)] md:block"
        >
          <Phone size={19} />
        </button>
        <button
          aria-label="Video call"
          className="hidden rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface)] md:block"
        >
          <Video size={19} />
        </button>
        <button
          aria-label="Members"
          className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface)]"
        >
          <Users size={19} />
        </button>
        <ThemeToggle />
      </div>
    </header>
  );
}
