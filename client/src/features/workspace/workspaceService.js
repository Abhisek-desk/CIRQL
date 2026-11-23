import { m as motion } from "motion/react";
import { Users, Circle, MessageCircle } from "lucide-react";
import PresenceIndicator from "./PresenceIndicator";

function formatLastSeen(value) {
  if (!value) return "Never seen";

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "Last seen recently";

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));

  if (seconds < 60) return "Last seen just now";
  if (seconds < 3600) return `Last seen ${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `Last seen ${Math.floor(seconds / 3600)}h ago`;

  return `Last seen ${Math.floor(seconds / 86400)}d ago`;
}

export default function WorkspaceMembers({
  members = [],
  onlineUsers = [],
  currentUserId,
  onSelectMember,
}) {
  const onlineSet = new Set(onlineUsers.map(String));

  const sortedMembers = [...members]
    .filter((member) => String(member._id) !== String(currentUserId))
    .sort((a, b) => {
      const aOnline = onlineSet.has(String(a._id));
      const bOnline = onlineSet.has(String(b._id));

      if (aOnline !== bOnline) return aOnline ? -1 : 1;
      return (a.name || "").localeCompare(b.name || "");
    });

  const onlineMembers = sortedMembers.filter((member) =>
    onlineSet.has(String(member._id)),
  );

  const offlineMembers = sortedMembers.filter(
    (member) => !onlineSet.has(String(member._id)),
  );

  const renderMember = (member, index, online) => (
    <motion.button
      key={member._id}
      type="button"
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.025 }}
      onClick={() => onSelectMember?.(member)}
      title={`Message ${member.name || "member"}`}
      className="group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-[var(--surface-hover)]"
    >
      <div className="relative h-9 w-9 shrink-0">
        {member.avatar ? (
          <img
            src={member.avatar}
            alt=""
            className={`h-9 w-9 rounded-full object-cover ${
              online ? "" : "grayscale-[35%] opacity-80"
            }`}
          />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white">
            {(member.name || "U").slice(0, 1).toUpperCase()}
          </div>
        )}

        <PresenceIndicator online={online} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-medium text-[var(--text)]">
            {member.name || "Unknown member"}
          </p>

          {member.customStatusEmoji && (
            <span className="shrink-0 text-xs">
              {member.customStatusEmoji}
            </span>
          )}
        </div>

        <p className="truncate text-[11px] text-[var(--muted)]">
          {member.customStatusExpiresAt &&
          new Date(member.customStatusExpiresAt) <= new Date()
            ? online
              ? "Online"
              : formatLastSeen(member.lastSeen)
            : member.customStatusText ||
              (online ? "Online" : formatLastSeen(member.lastSeen))}
        </p>
      </div>

      <MessageCircle
        size={15}
        className="shrink-0 text-[var(--muted)] opacity-0 transition group-hover:opacity-100"
      />
    </motion.button>
  );

  if (!sortedMembers.length) {
    return (
      <div className="px-3 py-6 text-center">
        <Users size={22} className="mx-auto mb-2 text-[var(--muted)]" />
        <p className="text-xs text-[var(--muted)]">
          No other workspace members yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-center justify-between px-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
            Online — {onlineMembers.length}
          </span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        </div>

        {onlineMembers.length ? (
          <div className="space-y-0.5">
            {onlineMembers.map((member, index) =>
              renderMember(member, index, true),
            )}
          </div>
        ) : (
          <p className="px-3 py-2 text-xs text-[var(--muted)]">
            Nobody online right now.
          </p>
        )}
      </div>

      {offlineMembers.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2 px-2">
            <Circle size={8} className="text-zinc-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Offline — {offlineMembers.length}
            </span>
          </div>

          <div className="space-y-0.5">
            {offlineMembers.map((member, index) =>
              renderMember(member, index, false),
            )}
          </div>
        </div>
      )}
    </div>
  );
}