import { useEffect, useRef, useState } from "react";
import { AnimatePresence, m as motion } from "motion/react";
import {
  Bell,
  Check,
  CheckCheck,
  MessageCircle,
  Reply,
  AtSign,
  UserPlus,
  X,
} from "lucide-react";

const iconMap = {
  new_message: MessageCircle,
  reply: Reply,
  mention: AtSign,
  workspace_invitation: UserPlus,
};

const formatTime = (date) => {
  const value = new Date(date);
  const now = new Date();
  const diff = Math.max(0, now - value);

  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return value.toLocaleDateString();
};

export default function NotificationBell({
  notifications = [],
  unreadCount = 0,
  loading = false,
  onMarkRead,
  onMarkAllRead,
  onNotificationClick,
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Notifications"
        aria-expanded={open}
        className="relative rounded-lg p-2 text-[var(--muted)] transition hover:bg-[var(--surface)] hover:text-[var(--text)]"
      >
        <Bell size={19} />

        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white ring-2 ring-[var(--bg)]">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="fixed left-3 right-3 top-16 z-[80] flex max-h-[min(520px,calc(100dvh-5.5rem))] w-auto flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg)] shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:max-h-[min(520px,75dvh)] sm:w-[min(360px,calc(100vw-24px))]"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text)]">
                  Notifications
                </h3>
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  {unreadCount} unread
                </p>
              </div>

              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={onMarkAllRead}
                    title="Mark all as read"
                    className="rounded-lg p-2 text-[var(--muted)] transition hover:bg-[var(--surface)] hover:text-indigo-500"
                  >
                    <CheckCheck size={17} />
                  </button>
                )}

                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close notifications"
                  className="rounded-lg p-2 text-[var(--muted)] transition hover:bg-[var(--surface)]"
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            <div className="custom-scrollbar flex-1 overflow-y-auto">
              {loading ? (
                <div className="space-y-3 p-4">
                  {[1, 2, 3].map((item) => (
                    <div key={item} className="flex gap-3">
                      <div className="h-9 w-9 animate-pulse rounded-full bg-[var(--surface)]" />
                      <div className="flex-1 space-y-2 py-1">
                        <div className="h-3 w-3/4 animate-pulse rounded bg-[var(--surface)]" />
                        <div className="h-3 w-1/2 animate-pulse rounded bg-[var(--surface)]" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center px-6 py-12 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface)] text-[var(--muted)]">
                    <Bell size={22} />
                  </div>
                  <p className="text-sm font-semibold text-[var(--text)]">
                    You're all caught up
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    New activity will appear here.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border)]">
                  {notifications.map((notification) => {
                    const Icon = iconMap[notification.type] || Bell;

                    return (
                      <button
                        type="button"
                        key={notification._id}
                        onClick={() => {
                          onNotificationClick(notification);
                          setOpen(false);
                        }}
                        className={`flex w-full gap-3 px-4 py-3 text-left transition hover:bg-[var(--surface)] ${
                          !notification.isRead ? "bg-indigo-500/[0.045]" : ""
                        }`}
                      >
                        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-500/10 text-indigo-500">
                          {notification.sender?.avatar ? (
                            <img
                              src={notification.sender.avatar}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Icon size={18} />
                          )}
                          {!notification.isRead && (
                            <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-[var(--bg)] bg-indigo-500" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate text-xs font-semibold text-[var(--text)]">
                              {notification.sender?.name || "CIRQL"}
                            </p>
                            <span className="shrink-0 text-[10px] text-[var(--muted)]">
                              {formatTime(notification.createdAt)}
                            </span>
                          </div>

                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--muted)]">
                            {notification.type === "reply"
                              ? "replied in"
                              : "sent a message in"}{" "}
                            <span className="font-semibold text-[var(--text)]">
                              #{notification.channel?.name || "channel"}
                            </span>
                          </p>

                          {notification.content && (
                            <p className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">
                              {notification.content}
                            </p>
                          )}

                          {!notification.isRead && (
                            <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-indigo-500">
                              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                              Unread
                            </span>
                          )}
                        </div>

                        {!notification.isRead && (
                          <span
                            role="button"
                            tabIndex={0}
                            aria-label="Mark as read"
                            onClick={(event) => {
                              event.stopPropagation();
                              onMarkRead(notification._id);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                event.stopPropagation();
                                onMarkRead(notification._id);
                              }
                            }}
                            className="self-center rounded-md p-1.5 text-[var(--muted)] hover:bg-indigo-500/10 hover:text-indigo-500"
                          >
                            <Check size={15} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-[var(--border)] px-4 py-2">
              <p className="text-center text-[10px] text-[var(--muted)]">
                Showing your latest 50 notifications
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


