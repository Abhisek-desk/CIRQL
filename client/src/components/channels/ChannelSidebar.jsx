import { motion } from "motion/react";
import { Hash, Plus, ChevronDown, Lock } from "lucide-react";
import ProfileMenu from "../common/ProfileMenu";

export default function ChannelSidebar({
  onClose,
  workspace,
  channels = [],
  selectedChannel,
  onSelectChannel,
  onCreateChannel,
  user,
}) {
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
            <p className="text-xs text-[var(--muted)]">
              No channels yet.
            </p>
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
              const active = selectedChannel?._id === channel._id;

              return (
                <motion.button
                  key={channel._id}
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
                    <Lock size={16} />
                  ) : (
                    <Hash size={17} />
                  )}
                  <span className="truncate">{channel.name}</span>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-[var(--border)] p-3">
        <div className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
        <ProfileMenu user={user} />
      </div>
    </motion.aside>
  );
}
