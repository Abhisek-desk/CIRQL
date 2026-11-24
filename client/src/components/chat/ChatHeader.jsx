import {
  Hash,
  Lock,
  Menu,
  Search,
  Phone,
  Video,
  Users,
  Wifi,
  WifiOff,
  MessageCircle,
  History,
} from "lucide-react";

import ThemeToggle from "../common/ThemeToggle";
import NotificationBell from "../common/NotificationBell";

export default function ChatHeader({
  onMenuClick,
  onVoiceCall,
  onVideoCall,
  onCallHistory,
  channel,
  conversation,
  currentUserId,
  onlineUsers = [],
  socketConnected = false,
  onlineCount = 0,
  onSearchClick,
  notifications = [],
  unreadCount = 0,
  notificationsLoading = false,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onNotificationClick,
}) {
  const recipient = conversation?.participants?.find(
    (participant) =>
      String(participant._id || participant) !== String(currentUserId),
  );

  const recipientName =
    typeof recipient === "object"
      ? recipient?.name || "Unknown user"
      : "Direct message";

  const recipientId =
    typeof recipient === "object" ? recipient?._id : recipient;

  const recipientOnline = onlineUsers.some(
    (id) => String(id) === String(recipientId),
  );

  const isDirectMessage = Boolean(conversation);

  return (
    <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--bg)] px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface)] lg:hidden"
          aria-label="Open sidebar"
        >
          <Menu size={21} />
        </button>

        {isDirectMessage ? (
          <MessageCircle size={20} className="shrink-0 text-indigo-500" />
        ) : channel?.type === "private" ? (
          <Lock size={19} className="shrink-0 text-[var(--muted)]" />
        ) : (
          <Hash size={20} className="shrink-0 text-[var(--muted)]" />
        )}

        <div className="min-w-0">
          <h2 className="truncate font-semibold text-[var(--text)]">
            {isDirectMessage
              ? recipientName
              : channel?.name || "Welcome to CIRQL"}
          </h2>

          <div className="mt-1 flex items-center gap-2">
            {isDirectMessage ? (
              <p className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                <span
                  className={`h-2 w-2 rounded-full ${
                    recipientOnline ? "bg-emerald-500" : "bg-zinc-400"
                  }`}
                />
                {recipientOnline ? "Online" : "Offline"}
              </p>
            ) : (
              <p className="hidden truncate text-xs text-[var(--muted)] sm:block">
                {channel?.description ||
                  "Select a channel to start collaborating"}
              </p>
            )}

            <span
              className={`flex shrink-0 items-center gap-1 text-[10px] ${
                socketConnected ? "text-emerald-500" : "text-amber-500"
              }`}
              title={
                socketConnected
                  ? "Connected to chat server"
                  : "Reconnecting"
              }
            >
              {socketConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
              <span className="hidden sm:inline">
                {socketConnected ? "Connected" : "Reconnecting"}
              </span>
            </span>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-3">
        <div
          className="hidden items-center gap-1.5 rounded-lg px-2 py-2 text-xs text-[var(--muted)] sm:flex"
          title="Users currently online across CIRQL"
        >
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span>{onlineCount} online</span>
        </div>

        <button
          onClick={onSearchClick}
          aria-label="Search messages"
          title="Search messages"
          disabled={!channel}
          className="rounded-lg p-2 text-[var(--muted)] transition hover:bg-[var(--surface)] hover:text-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Search size={19} />
        </button>
        <button
          type="button"
          onClick={onCallHistory}
          disabled={!conversation}
          title="Call history"
          aria-label="Call history"
          className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <History size={19} />
        </button>

        <button
          type="button"
          onClick={onVoiceCall}
          disabled={!conversation}
          title="Start voice call"
          aria-label="Voice call"
          className="hidden rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface)] md:block"
        >
          <Phone size={19} />
        </button>

        <button
          type="button"
          onClick={onVideoCall}
          disabled={!conversation}
          title="Start video call"
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

        <NotificationBell
          notifications={notifications}
          unreadCount={unreadCount}
          loading={notificationsLoading}
          onMarkRead={onMarkNotificationRead}
          onMarkAllRead={onMarkAllNotificationsRead}
          onNotificationClick={onNotificationClick}
        />

        <ThemeToggle />
      </div>
    </header>
  );
}


