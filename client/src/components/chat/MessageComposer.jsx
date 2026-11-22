import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Paperclip,
  Smile,
  Send,
  Plus,
  X,
  CornerUpLeft,
  AtSign,
} from "lucide-react";

export default function MessageComposer({
  onSend,
  onTypingChange,
  channelName = "channel",
  replyTo,
  onCancelReply,
  members = [],
}) {
  const [message, setMessage] = useState("");
  const [mentionQuery, setMentionQuery] = useState(null);
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const [selectedMentions, setSelectedMentions] = useState([]);

  const textareaRef = useRef(null);

  const filteredMembers = useMemo(() => {
    if (!mentionQuery) return [];

    const query = mentionQuery.query.toLowerCase();

    return members
      .filter((member) =>
        member.name?.toLowerCase().includes(query),
      )
      .slice(0, 6);
  }, [members, mentionQuery]);

  const handleChange = (event) => {
    const value = event.target.value;
    const cursor = event.target.selectionStart;

    setMessage(value);

    setSelectedMentions((previous) =>
      previous.filter((mention) =>
        value.includes(mention.token),
      ),
    );

    onTypingChange?.(Boolean(value.trim()));

    const textBeforeCursor = value.slice(0, cursor);
    const match = textBeforeCursor.match(/(^|\s)@([^\s@]*)$/);

    if (match) {
      const start = cursor - match[0].length + match[1].length;

      setMentionQuery({
        start,
        end: cursor,
        query: match[2],
      });

      setActiveMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  };

  const handleSelectMention = (member) => {
    if (!mentionQuery) return;

    const token = `@${member.name}`;
    const updatedMessage =
      message.slice(0, mentionQuery.start) +
      token +
      " " +
      message.slice(mentionQuery.end);

    setMessage(updatedMessage);

    setSelectedMentions((previous) => {
      if (previous.some((item) => item.id === member._id)) {
        return previous;
      }

      return [
        ...previous,
        {
          id: member._id,
          token,
        },
      ];
    });

    setMentionQuery(null);
    onTypingChange?.(true);

    requestAnimationFrame(() => {
      const cursor = mentionQuery.start + token.length + 1;

      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(cursor, cursor);
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const content = message.trim();
    if (!content) return;

    const mentionIds = [
      ...new Set(
        selectedMentions
          .filter((mention) => content.includes(mention.token))
          .map((mention) => mention.id),
      ),
    ];

    onTypingChange?.(false);
    onSend?.(content, replyTo?._id || null, mentionIds);

    setMessage("");
    setSelectedMentions([]);
    setMentionQuery(null);
  };

  const handleKeyDown = (event) => {
    if (mentionQuery && filteredMembers.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveMentionIndex((previous) =>
          (previous + 1) % filteredMembers.length,
        );
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveMentionIndex((previous) =>
          (previous - 1 + filteredMembers.length) %
          filteredMembers.length,
        );
        return;
      }

      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleSelectMention(
          filteredMembers[activeMentionIndex],
        );
        return;
      }
    }

    if (event.key === "Escape") {
      setMentionQuery(null);
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="shrink-0 border-t border-[var(--border)] bg-[var(--bg)] px-3 py-3 sm:px-5 sm:py-4"
    >
      <div className="mx-auto max-w-4xl">
        <div className="overflow-visible rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm transition-all focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-500/10">

          <AnimatePresence>
            {replyTo && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-center justify-between border-b border-[var(--border)] bg-indigo-500/5 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <CornerUpLeft size={17} className="shrink-0 text-indigo-500" />

                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-indigo-500">
                        Replying to {replyTo.sender?.name || "User"}
                      </p>

                      <p className="truncate text-xs text-[var(--muted)]">
                        {replyTo.content}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onCancelReply}
                    aria-label="Cancel reply"
                    className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
                  >
                    <X size={16} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-2 px-3 pt-3 sm:px-4">
            <button
              type="button"
              aria-label="More options"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[var(--muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--primary)]"
            >
              <Plus size={21} />
            </button>

            <div className="relative min-w-0 flex-1">
              <AnimatePresence>
                {mentionQuery && filteredMembers.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                    className="absolute bottom-full left-0 z-50 mb-3 w-full max-w-xs overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-2xl"
                  >
                    <div className="flex items-center gap-2 px-2 py-2 text-xs font-semibold text-[var(--muted)]">
                      <AtSign size={14} />
                      Workspace members
                    </div>

                    {filteredMembers.map((member, index) => (
                      <button
                        key={member._id}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => handleSelectMention(member)}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition ${
                          index === activeMentionIndex
                            ? "bg-indigo-500/10"
                            : "hover:bg-[var(--surface-hover)]"
                        }`}
                      >
                        {member.avatar ? (
                          <img
                            src={member.avatar}
                            alt=""
                            className="h-9 w-9 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-500/15 text-sm font-bold text-indigo-500">
                            {member.name?.charAt(0)?.toUpperCase() || "U"}
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[var(--text)]">
                            {member.name}
                          </p>
                          <p className="text-xs capitalize text-[var(--muted)]">
                            {member.role || "Member"}
                          </p>
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <textarea
                ref={textareaRef}
                value={message}
                onChange={handleChange}
                onBlur={() => onTypingChange?.(false)}
                onKeyDown={handleKeyDown}
                placeholder={`Message #${channelName}...`}
                rows={1}
                maxLength={5000}
                className="max-h-32 min-h-10 w-full resize-none bg-transparent py-2.5 text-sm leading-6 text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
              />
            </div>
          </div>

          <div className="flex min-h-14 items-center justify-between px-3 pb-2 sm:px-4">
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Attach file"
                className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--primary)]"
              >
                <Paperclip size={19} />
              </button>

              <button
                type="button"
                aria-label="Add emoji"
                className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--primary)]"
              >
                <Smile size={19} />
              </button>
            </div>

            <motion.button
              type="submit"
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.92 }}
              disabled={!message.trim()}
              aria-label="Send message"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send size={18} />
            </motion.button>
          </div>
        </div>

        <p className="mt-2 hidden text-center text-[11px] text-[var(--muted)] sm:block">
          Type @ to mention a teammate · Enter to send · Shift + Enter for a new line
        </p>
      </div>
    </form>
  );
}
