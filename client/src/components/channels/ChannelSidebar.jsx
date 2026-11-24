import { m as motion } from "motion/react";
import {
  Hash,
  Plus,
  ChevronDown,
  Lock,
  Users,
} from "lucide-react";

import ProfileMenu from "../common/ProfileMenu";
import WorkspaceMembers from "../presence/WorkspaceMembers";

export default function ChannelSidebar({
  onClose,
  workspace,
  channels = [],
  selectedChannel,
  onSelectChannel,
  onCreateChannel,
  user,
  unreadCounts = {},
  members = [],
  onlineUsers = [],
  conversations = [],
  selectedConversation,
  onSelectConversation,
  onSelectMember,
}) {
  const currentUserId = user?.id || user?._id;

  const getOtherParticipant = (conversation) =>
    conversation.participants?.find(
      (participant) =>
        String(participant._id || participant) !== String(currentUserId),
    );

  const getParticipantName = (participant) =>
    typeof participant === "object"
      ? participant.name || "Unknown user"
      : "Unknown user";

  return (
    <motion.aside
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25 }}
      className="flex h-full w-[260px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar)]"
    >
      <div className="flex h-[72px] items-center justify-between border-b border-[var(--border)] px-5">
        <div className="min-w-0">
          <h2 className="truncate font-bold text-[var(--text)]">
            {workspace?.name || "CIRQL"}
          </h2>
          <p className="text-xs text-[var(--muted)]">
            {workspace ? "Team workspace" : "Select a workspace"}
          </p>
        </div>

        <button
          onClick={onClose}
          aria-label="Close sidebar"
          className="rounded-lg p-2 text-lg text-[var(--muted)] hover:bg-[var(--surface)] lg:hidden"
        >
          ×
        </button>
      </div>

      <div className="custom-scrollbar flex-1 overflow-y-auto p-4">
        {/* CHANNELS */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            <ChevronDown size={14} />
            Channels
          </div>

          <button
            onClick={onCreateChannel}
            disabled={!workspace}
            title="Create channel"
            className="rounded-md p-1 text-[var(--muted)] transition hover:bg-[var(--surface-hover)] hover:text-indigo-500 disabled:opacity-30"
          >
            <Plus size={17} />
          </button>
        </div>

        {!workspace ? (
          <p className="px-3 py-4 text-xs text-[var(--muted)]">
            Create or select a workspace to see its channels.
          </p>
        ) : channels.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] p-4 text-center">
            <Hash size={22} className="mx-auto mb-2 text-[var(--muted)]" />
            <p className="text-xs text-[var(--muted)]">No channels yet.</p>

            <button
              onClick={onCreateChannel}
              className="mt-2 text-xs font-semibold text-indigo-500 hover:text-violet-500"
            >
              Create your first channel
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            {channels.map((channel, index) => {
              const active =
                String(selectedChannel?._id) === String(channel._id);

              const unreadCount = Number(unreadCounts[channel._id] || 0);

              return (
                <motion.button
                  key={channel._id}
                  type="button"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.035 }}
                  onClick={() => onSelectChannel(channel)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                    active
                      ? "bg-indigo-500/15 font-medium text-indigo-500"
                      : "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
                  }`}
                >
                  {channel.type === "private" ? (
                    <Lock size={16} className="shrink-0" />
                  ) : (
                    <Hash size={17} className="shrink-0" />
                  )}

                  <span className="min-w-0 flex-1 truncate text-left">
                    {channel.name}
                  </span>

                  {unreadCount > 0 && !active && (
                    <motion.span
                      key={unreadCount}
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 450,
                        damping: 20,
                      }}
                      className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[10px] font-bold text-white shadow-sm shadow-indigo-500/30"
                    >
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </motion.span>
                  )}
                </motion.button>
              );
            })}
          </div>
        )}

        {/* DIRECT MESSAGES */}
        <div className="mb-3 mt-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            <ChevronDown size={14} />
            Direct Messages
          </div>

          <span className="rounded-md bg-[var(--surface)] px-1.5 py-0.5 text-[10px]">
            {conversations.length}
          </span>
        </div>

        {conversations.length === 0 ? (
          <p className="px-3 py-3 text-xs text-[var(--muted)]">
            Click a workspace member to start a conversation.
          </p>
        ) : (
          <div className="space-y-1">
            {conversations.map((conversation, index) => {
              const participant = getOtherParticipant(conversation);
              const participantId =
                participant?._id || participant;
              const active =
                String(selectedConversation?._id) ===
                String(conversation._id);

              const online = onlineUsers.some(
                (id) => String(id) === String(participantId),
              );

              const unread = Number(conversation.unreadCount || 0);

              return (
                <motion.button
                  key={conversation._id}
                  type="button"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.025 }}
                  onClick={() => onSelectConversation?.(conversation)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                    active
                      ? "bg-indigo-500/15 font-medium text-indigo-500"
                      : "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
                  }`}
                >
                  <div className="relative h-8 w-8 shrink-0">
                    {participant?.avatar ? (
                      <img
                        src={participant.avatar}
                        width={32} height={32}
                        alt=""
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white">
                        {getParticipantName(participant)
                          .charAt(0)
                          .toUpperCase()}
                      </div>
                    )}

                    <span
                      className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[var(--sidebar)] ${
                        online ? "bg-emerald-500" : "bg-zinc-400"
                      }`}
                    />
                  </div>

                  <span className="min-w-0 flex-1 truncate text-left">
                    {getParticipantName(participant)}
                  </span>

                  {unread > 0 && !active && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[10px] font-bold text-white">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>
        )}

        <div className="my-5 border-t border-[var(--border)]" />

        {/* WORKSPACE MEMBERS */}
        <div className="mb-3 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          <Users size={14} />
          Workspace members
          <span className="ml-auto rounded-md bg-[var(--surface)] px-1.5 py-0.5 text-[10px]">
            {members.length}
          </span>
        </div>

        {workspace ? (
          <WorkspaceMembers
            members={members}
            onlineUsers={onlineUsers}
            currentUserId={currentUserId}
            onSelectMember={onSelectMember}
          />
        ) : (
          <p className="px-3 py-3 text-xs text-[var(--muted)]">
            Select a workspace to see its members.
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-[var(--border)] p-3">
        <div className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
        <ProfileMenu user={user} />
      </div>
    </motion.aside>
  );
}
