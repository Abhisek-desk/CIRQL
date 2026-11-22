import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Smile,
  Reply,
  MoreHorizontal,
  Pencil,
  Trash2,
  Check,
  X,
} from "lucide-react";

const EMOJIS = ["👍", "❤️", "😂", "🎉", "👀", "🚀"];

export default function MessageBubble({
  message,
  isOwn = false,
  onEdit,
  onDelete,
  onReply,
  onReact,
  currentUserId,
  members = [],
}) {
  const sender = message.sender || {};
  const name = sender.name || message.name || "User";
  const avatar = sender.avatar || "";
  const content = message.content || "";

  const mentionNames = members
    .map((member) => member.name)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  const mentionRegex = mentionNames.length
    ? new RegExp(
        "@(" +
          mentionNames
            .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
            .join("|") +
          ")(?=$|[\\s.,!?;:)}\\]])",
        "giu"
      )
    : null;

  const renderMessageContent = () => {
    if (!mentionRegex || message.deletedAt) return content;

    const parts = [];
    let lastIndex = 0;
    let match;
    let index = 0;

    mentionRegex.lastIndex = 0;

    while ((match = mentionRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(content.slice(lastIndex, match.index));
      }

      parts.push(
        <span
          key={`mention-${index++}`}
          className={
            isOwn
              ? "rounded-md bg-white/15 px-1 font-semibold text-white underline decoration-white/50 underline-offset-2"
              : "rounded-md bg-indigo-500/10 px-1 font-semibold text-indigo-500"
          }
        >
          @{match[1]}
        </span>
      );

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      parts.push(content.slice(lastIndex));
    }

    return parts.length ? parts : content;
  };


  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const date = message.createdAt ? new Date(message.createdAt) : null;

  const time =
    date && !Number.isNaN(date.getTime())
      ? date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";

  const initials = name.charAt(0).toUpperCase();
  const isDeleted = Boolean(message.deletedAt);
  const parent = message.replyTo;

  const reactions = Array.isArray(message.reactions)
    ? message.reactions
    : [];

  const groupedReactions = EMOJIS.map((emoji) => {
    const users = reactions.filter(
      (reaction) => reaction.emoji === emoji,
    );

    return {
      emoji,
      count: users.length,
      selected: users.some(
        (reaction) =>
          String(reaction.user?._id || reaction.user) ===
          String(currentUserId),
      ),
    };
  }).filter((reaction) => reaction.count > 0);

  const handleSave = async () => {
    const updatedContent = editContent.trim();

    if (!updatedContent || updatedContent === content) {
      setEditing(false);
      setEditContent(content);
      return;
    }

    try {
      setSaving(true);
      await onEdit?.(message._id, updatedContent);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete this message?")) {
      onDelete?.(message._id);
    }
  };

  const handleReaction = async (emoji) => {
    setPickerOpen(false);
    await onReact?.(message._id, emoji);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.22 }}
      className={`group flex gap-3 px-4 py-3 transition-colors hover:bg-[var(--surface)]/50 ${
        isOwn ? "flex-row-reverse" : ""
      }`}
    >
      {avatar ? (
        <img
          src={avatar}
          alt={name}
          className="h-10 w-10 shrink-0 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 font-bold text-white">
          {initials}
        </div>
      )}

      <div className={`min-w-0 max-w-[85%] md:max-w-[75%] ${isOwn ? "text-right" : ""}`}>
        <div className={`mb-1 flex flex-wrap items-center gap-2 ${isOwn ? "justify-end" : ""}`}>
          <span className="text-sm font-semibold text-[var(--text)]">
            {name}
          </span>

          <span className="text-xs text-[var(--muted)]">{time}</span>

          {message.editedAt && !isDeleted && (
            <span className="text-[10px] text-[var(--muted)]">
              edited
            </span>
          )}
        </div>

        {parent && (
          <div className={`mb-2 flex ${isOwn ? "justify-end" : "justify-start"}`}>
            <div className="max-w-full rounded-lg border-l-2 border-indigo-500 bg-indigo-500/5 px-3 py-2 text-left">
              <p className="text-xs font-semibold text-indigo-500">
                {parent.sender?.name || "Original message"}
              </p>

              <p className="mt-1 truncate text-xs text-[var(--muted)]">
                {parent.content || "Original message unavailable"}
              </p>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {editing ? (
            <motion.div
              key="editor"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="min-w-[220px] rounded-xl border border-indigo-500/40 bg-[var(--surface)] p-3"
            >
              <textarea
                value={editContent}
                onChange={(event) => setEditContent(event.target.value)}
                maxLength={5000}
                autoFocus
                rows={3}
                className="w-full resize-none bg-transparent text-left text-sm text-[var(--text)] outline-none"
              />

              <div className="mt-2 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setEditContent(content);
                    setEditing(false);
                  }}
                  disabled={saving}
                  className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs text-[var(--muted)] hover:bg-[var(--surface-hover)]"
                >
                  <X size={14} />
                  Cancel
                </button>

                <button
                  onClick={handleSave}
                  disabled={saving || !editContent.trim()}
                  className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  <Check size={14} />
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="content"
              className={`rounded-2xl px-4 py-3 text-left text-sm leading-6 ${
                isDeleted
                  ? "rounded-tl-sm border border-[var(--border)] bg-[var(--surface)] italic text-[var(--muted)]"
                  : isOwn
                    ? "rounded-tr-sm bg-indigo-600 text-white"
                    : "rounded-tl-sm border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-sm"
              }`}
            >
              {renderMessageContent()}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reaction badges */}
        {!isDeleted && groupedReactions.length > 0 && (
          <div className={`mt-2 flex flex-wrap gap-2 ${isOwn ? "justify-end" : ""}`}>
            {groupedReactions.map((reaction) => (
              <motion.button
                key={reaction.emoji}
                type="button"
                whileTap={{ scale: 0.85 }}
                onClick={() => handleReaction(reaction.emoji)}
                title={`${reaction.count} reaction(s)`}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${
                  reaction.selected
                    ? "border-indigo-500 bg-indigo-500/15 text-indigo-500"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:border-indigo-400"
                }`}
              >
                <span>{reaction.emoji}</span>
                <span className="font-semibold">{reaction.count}</span>
              </motion.button>
            ))}
          </div>
        )}

        {!editing && (
          <div className="mt-2 flex flex-wrap items-center gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
            {!isDeleted && (
              <>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setPickerOpen((previous) => !previous)}
                    aria-label="Add reaction"
                    title="Add reaction"
                    className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-indigo-500"
                  >
                    <Smile size={15} />
                  </button>

                  <AnimatePresence>
                    {pickerOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.95 }}
                        className="absolute bottom-full left-0 z-30 mb-2 flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-xl"
                      >
                        {EMOJIS.map((emoji) => (
                          <motion.button
                            key={emoji}
                            type="button"
                            whileHover={{ scale: 1.2 }}
                            whileTap={{ scale: 0.85 }}
                            onClick={() => handleReaction(emoji)}
                            className="rounded-lg p-2 text-lg hover:bg-[var(--surface-hover)]"
                          >
                            {emoji}
                          </motion.button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button
                  type="button"
                  onClick={() => onReply?.(message)}
                  aria-label="Reply to message"
                  title="Reply"
                  className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-indigo-500"
                >
                  <Reply size={15} />
                </button>
              </>
            )}

            {isOwn && !isDeleted && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setEditContent(content);
                    setEditing(true);
                  }}
                  aria-label="Edit message"
                  title="Edit message"
                  className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-indigo-500"
                >
                  <Pencil size={15} />
                </button>

                <button
                  type="button"
                  onClick={handleDelete}
                  aria-label="Delete message"
                  title="Delete message"
                  className="rounded-lg p-2 text-[var(--muted)] hover:bg-red-500/10 hover:text-red-500"
                >
                  <Trash2 size={15} />
                </button>
              </>
            )}

            <button
              type="button"
              aria-label="More message options"
              className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-hover)]"
            >
              <MoreHorizontal size={15} />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
