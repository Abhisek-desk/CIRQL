import { memo, useEffect, useRef, useState } from "react";
import { AnimatePresence, m as motion } from "motion/react";
import {
  Smile,
  Reply,
  MoreHorizontal,
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
  Eye,
  FileText,
  Download,
  Copy,
  Link,
  CheckCheck
} from "lucide-react";

const EMOJIS = ["\u{1F44D}", "\u2764\uFE0F", "\u{1F602}", "\u{1F389}", "\u{1F440}", "\u{1F680}"];

const formatFileSize = (bytes = 0) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const isImageAttachment = (file) =>
  file.mimeType?.startsWith("image/") ||
  file.resourceType === "image";


function MessageBubble({
  message,
  workspaceId,
  channelId,
  conversationId,
  isOwn = false,
  onEdit,
  onDelete,
  onReply,
  onJumpToMessage,
  onReact,
  currentUserId,
  members = [],
  seenBy = [],
}) {
  const sender = message.sender || {};
  const name = sender.name || message.name || "User";
  const avatar = sender.avatar || "";
  const content = message.content || "";
  const attachments = Array.isArray(message.attachments) ? message.attachments : [];

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
    if (message.deletedAt) return content;

    const renderPlainText = (text, prefix) => {
      if (!mentionRegex) return text;

      const parts = [];
      let lastIndex = 0;
      let match;
      let index = 0;

      mentionRegex.lastIndex = 0;

      while ((match = mentionRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
          parts.push(text.slice(lastIndex, match.index));
        }

        parts.push(
          <span
            key={`${prefix}-mention-${index++}`}
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

      if (lastIndex < text.length) {
        parts.push(text.slice(lastIndex));
      }

      return parts.length ? parts : text;
    };

    const renderInline = (text, prefix) => {
      const regex = /(\*\*[^*\n]+\*\*|~~[^~\n]+~~|`[^`\n]+`|\*[^*\n]+\*)/g;

      const parts = [];
      let lastIndex = 0;
      let match;
      let index = 0;

      const addPlain = (value, key) => {
        const result = renderPlainText(value, key);
        parts.push(...(Array.isArray(result) ? result : [result]));
      };

      while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
          addPlain(text.slice(lastIndex, match.index), `${prefix}-${index}`);
        }

        const token = match[0];
        const key = `${prefix}-format-${index++}`;

        if (token.startsWith("**")) {
          parts.push(
            <strong key={key} className="font-bold">
              {token.slice(2, -2)}
            </strong>
          );
        } else if (token.startsWith("~~")) {
          parts.push(
            <del key={key}>
              {token.slice(2, -2)}
            </del>
          );
        } else if (token.startsWith("`")) {
          parts.push(
            <code
              key={key}
              className={`rounded-md px-1.5 py-0.5 font-mono text-[0.9em] ${
                isOwn
                  ? "bg-white/15 text-white"
                  : "bg-indigo-500/10 text-indigo-500"
              }`}
            >
              {token.slice(1, -1)}
            </code>
          );
        } else {
          parts.push(
            <em key={key} className="italic">
              {token.slice(1, -1)}
            </em>
          );
        }

        lastIndex = match.index + token.length;
      }

      if (lastIndex < text.length) {
        addPlain(text.slice(lastIndex), `${prefix}-last`);
      }

      if (!parts.length) {
        return renderPlainText(text, prefix);
      }

      return parts;
    };

    const codeBlockRegex = /```([^\n`]*)\r?\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    let index = 0;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${index}`}>
            {renderInline(
              content.slice(lastIndex, match.index),
              `inline-${index}`
            )}
          </span>
        );
      }

      const code = match[2].replace(/\r?\n$/, "");

      parts.push(
        <pre
          key={`code-block-${index}`}
          className={`my-2 max-w-full overflow-x-auto rounded-xl border p-3 text-left ${
            isOwn
              ? "border-white/15 bg-black/20"
              : "border-[var(--border)] bg-[var(--bg)]"
          }`}
        >
          <code className="font-mono text-xs leading-6 sm:text-sm">
            {code}
          </code>
        </pre>
      );

      lastIndex = match.index + match[0].length;
      index++;
    }

    if (lastIndex < content.length) {
      parts.push(
        <span key={`text-${index}`}>
          {renderInline(content.slice(lastIndex), `inline-${index}`)}
        </span>
      );
    }

    return parts.length ? parts : renderInline(content, "inline");
  };
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [copiedAction, setCopiedAction] = useState("");
  const moreMenuRef = useRef(null);

  useEffect(() => {
    if (!moreOpen) return;

    const handleOutsideClick = (event) => {
      if (!moreMenuRef.current?.contains(event.target)) {
        setMoreOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") setMoreOpen(false);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [moreOpen]);

  const copyText = async (value, action) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedAction(action);
      setTimeout(() => setCopiedAction(""), 1600);
      setMoreOpen(false);
    } catch {
      window.prompt("Copy this text:", value);
      setMoreOpen(false);
    }
  };

  const handleCopyMessage = () => {
    const attachmentNames = attachments
      .map((file) => file.name)
      .filter(Boolean);

    const text = [
      content,
      ...attachmentNames.map((name) => `[Attachment: ${name}]`),
    ].filter(Boolean).join("\n");

    if (text) copyText(text, "message");
  };

  const handleCopyLink = () => {
    if (!message._id) return;

    const url = new URL(window.location.origin);
    url.pathname = "/";

    if (conversationId) {
      url.searchParams.set("conversationId", conversationId);
    } else if (workspaceId && channelId) {
      url.searchParams.set("workspaceId", workspaceId);
      url.searchParams.set("channelId", channelId);
    } else {
      return;
    }

    url.hash = `message-${message._id}`;
    copyText(url.toString(), "link");
  };
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

  const handleEditKeyDown = (event) => {
    if (saving) return;

    if (event.key === "Escape") {
      event.preventDefault();
      setEditContent(content);
      setEditing(false);
      return;
    }

    if (
      event.key === "Enter" &&
      (event.ctrlKey || event.metaKey)
    ) {
      event.preventDefault();
      handleSave();
    }
  };
  const handleDelete = async () => {
    if (deleting || saving) return;

    if (!window.confirm("Are you sure you want to delete this message?")) {
      return;
    }

    try {
      setDeleting(true);
      await onDelete?.(message._id);
    } finally {
      setDeleting(false);
    }
  };

  const handleReaction = async (emoji) => {
    setPickerOpen(false);
    await onReact?.(message._id, emoji);
  };

  const renderAttachments = () => {
    if (!attachments.length || isDeleted) return null;

    return (
      <div className={`mt-2 grid gap-2 ${attachments.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
        {attachments.map((file) => (
          <div key={file._id || file.publicId} className="min-w-0">
            {isImageAttachment(file) ? (
              <a
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block overflow-hidden rounded-xl border border-[var(--border)]"
                title={`Open ${file.name}`}
              >
                <img
                  src={file.url}
                  width={640} height={360}
                  alt={file.name}
                  loading="eager"
                  className="max-h-72 w-full object-cover transition duration-300 hover:scale-[1.02]"
                />
              </a>
            ) : (
              <div className={`flex min-w-0 items-center gap-3 rounded-xl border p-3 ${
                isOwn ? "border-white/20 bg-white/10" : "border-[var(--border)] bg-[var(--bg)]"
              }`}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500">
                  <FileText size={21} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className={`truncate text-xs font-semibold ${isOwn ? "text-white" : "text-[var(--text)]"}`}>
                    {file.name}
                  </p>
                  <p className={`text-[11px] ${isOwn ? "text-white/65" : "text-[var(--muted)]"}`}>
                    {formatFileSize(file.size)}
                  </p>
                </div>

                <a
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={file.name}
                  aria-label={`Download ${file.name}`}
                  title="Open or download file"
                  className="rounded-lg p-2 text-indigo-500 hover:bg-indigo-500/10"
                >
                  <Download size={17} />
                </a>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };
  return (
    <motion.div
      id={`message-${message._id}`}
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.22 }}
      className={`group flex gap-2.5 px-3 py-2.5 transition-colors sm:gap-3 sm:px-4 sm:py-3 hover:bg-[var(--surface)]/50 ${
        isOwn ? "flex-row-reverse" : ""
      }`}
    >
      {avatar ? (
        <img
          src={avatar}
          width={40} height={40}
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
          <span className="text-[13px] font-semibold text-[var(--text)] sm:text-sm">
            {name}
          </span>

          <span className="text-[11px] text-[var(--muted)] sm:text-xs">{time}</span>

          {message.editedAt && !isDeleted && (
            <span className="text-[10px] text-[var(--muted)]">
              edited
            </span>
          )}
        </div>

        {parent && (
          <div className={`mb-2 flex ${isOwn ? "justify-end" : "justify-start"}`}>
            <button
              type="button"
              onClick={() => onJumpToMessage?.(parent._id)}
              disabled={!parent._id}
              title="Jump to original message"
              className="max-w-full rounded-lg border-l-2 border-indigo-500 bg-indigo-500/5 px-3 py-2 text-left transition hover:bg-indigo-500/10 disabled:cursor-default"
            >
              <p className="text-xs font-semibold text-indigo-500">
                {parent.sender?.name || "Original message"}
              </p>

              <p className="mt-1 truncate text-xs text-[var(--muted)]">
                {parent.content || "Original message unavailable"}
              </p>
            </button>
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
                onKeyDown={handleEditKeyDown}
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
              className={`rounded-2xl px-3 py-2.5 text-left text-[13px] leading-5 whitespace-pre-wrap break-words sm:px-4 sm:py-3 sm:text-sm sm:leading-6 ${
                isDeleted
                  ? "rounded-tl-sm border border-[var(--border)] bg-[var(--surface)] italic text-[var(--muted)]"
                  : isOwn
                    ? "rounded-tr-sm bg-indigo-600 text-white"
                    : "rounded-tl-sm border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-sm"
              }`}
            >
              {renderMessageContent()}
              {renderAttachments()}
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

        {isOwn && !isDeleted && seenBy.length > 0 && (
          <div className="relative mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => setReceiptOpen((value) => !value)}
              aria-expanded={receiptOpen}
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium text-indigo-500 transition hover:bg-indigo-500/10"
            >
              <Eye size={13} />
              Seen by {seenBy.length}
            </button>

            <AnimatePresence>
              {receiptOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 7, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 7, scale: 0.96 }}
                  transition={{ duration: 0.18 }}
                  className="absolute right-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] text-left shadow-2xl"
                >
                  <div className="border-b border-[var(--border)] px-4 py-3">
                    <p className="text-xs font-bold text-[var(--text)]">
                      Seen by {seenBy.length} {seenBy.length === 1 ? "person" : "people"}
                    </p>
                  </div>

                  <div className="max-h-56 overflow-y-auto p-2">
                    {seenBy.map((reader) => (
                      <div
                        key={reader._id || reader.id}
                        className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-[var(--surface-hover)]"
                      >
                        {reader.avatar ? (
                          <img
                            src={reader.avatar}
                            width={32} height={32}
                            alt=""
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white">
                            {(reader.name || "U").charAt(0).toUpperCase()}
                          </div>
                        )}

                        <span className="truncate text-sm font-medium text-[var(--text)]">
                          {reader.name || "Member"}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
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
                  disabled={deleting || saving}
                  aria-label="Delete message"
                  title={deleting ? "Deleting message..." : "Delete message"}
                  className="rounded-lg p-2 text-[var(--muted)] hover:bg-red-500/10 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deleting ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Trash2 size={15} />
                  )}
                </button>
              </>
            )}

            <div className="relative" ref={moreMenuRef}>
              <button
                type="button"
                onClick={() => setMoreOpen((value) => !value)}
                aria-label="More message options"
                aria-expanded={moreOpen}
                aria-haspopup="menu"
                title="More options"
                className={`rounded-lg p-2 transition ${
                  moreOpen
                    ? "bg-[var(--surface-hover)] text-indigo-500"
                    : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-indigo-500"
                }`}
              >
                <MoreHorizontal size={15} />
              </button>

              <AnimatePresence>
                {moreOpen && (
                  <motion.div
                    role="menu"
                    initial={{ opacity: 0, y: 6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute bottom-full right-0 z-50 mb-2 w-52 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5 text-left shadow-2xl"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleCopyMessage}
                      disabled={!content && attachments.length === 0}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {copiedAction === "message" ? (
                        <CheckCheck size={15} className="text-emerald-500" />
                      ) : (
                        <Copy size={15} className="text-[var(--muted)]" />
                      )}
                      {copiedAction === "message" ? "Copied!" : "Copy message"}
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleCopyLink}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)]"
                    >
                      {copiedAction === "link" ? (
                        <CheckCheck size={15} className="text-emerald-500" />
                      ) : (
                        <Link size={15} className="text-[var(--muted)]" />
                      )}
                      {copiedAction === "link" ? "Link copied!" : "Copy message link"}
                    </button>

                    {isOwn && !isDeleted && (
                      <>
                        <div className="my-1 border-t border-[var(--border)]" />

                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setEditContent(content);
                            setEditing(true);
                            setMoreOpen(false);
                          }}
                          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)]"
                        >
                          <Pencil size={15} className="text-[var(--muted)]" />
                          Edit message
                        </button>

                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setMoreOpen(false);
                            handleDelete();
                          }}
                          disabled={deleting || saving}
                          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium text-red-500 transition hover:bg-red-500/10 disabled:opacity-50"
                        >
                          <Trash2 size={15} />
                          Delete message
                        </button>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}














function areMessageBubblePropsEqual(previous, next) {
  const previousSeenBy = previous.seenBy || [];
  const nextSeenBy = next.seenBy || [];

  const sameSeenBy =
    previousSeenBy.length === nextSeenBy.length &&
    previousSeenBy.every((user, index) => {
      const previousId = user?._id || user?.id || user;
      const nextUser = nextSeenBy[index];
      const nextId = nextUser?._id || nextUser?.id || nextUser;

      return String(previousId) === String(nextId);
    });

  return (
    previous.message === next.message &&
    previous.isOwn === next.isOwn &&
    previous.currentUserId === next.currentUserId &&
    previous.members === next.members &&
    previous.onEdit === next.onEdit &&
    previous.onDelete === next.onDelete &&
    previous.onReply === next.onReply &&
    previous.onJumpToMessage === next.onJumpToMessage &&
    previous.onReact === next.onReact &&
    sameSeenBy
  );
}

export default memo(MessageBubble, areMessageBubblePropsEqual);

