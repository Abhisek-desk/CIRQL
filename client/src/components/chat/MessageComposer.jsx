import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, m as motion } from "motion/react";
import {
  Paperclip,
  Smile,
  Send,
  Plus,
  X,
  CornerUpLeft,
  AtSign,
  FileText,
  Upload,
  Bold,
  Italic,
  Strikethrough,
  Code2,
} from "lucide-react";

const EMOJI_OPTIONS = [
  { emoji: "\u{1F600}", name: "grinning", category: "Smileys" },
  { emoji: "\u{1F602}", name: "laughing", category: "Smileys" },
  { emoji: "\u{1F923}", name: "rofl", category: "Smileys" },
  { emoji: "\u{1F60D}", name: "heart eyes", category: "Smileys" },
  { emoji: "\u{1F970}", name: "smiling hearts", category: "Smileys" },
  { emoji: "\u{1F60E}", name: "cool", category: "Smileys" },
  { emoji: "\u{1F914}", name: "thinking", category: "Smileys" },
  { emoji: "\u{1F622}", name: "crying", category: "Smileys" },
  { emoji: "\u{1F62E}", name: "surprised", category: "Smileys" },
  { emoji: "\u{1F44D}", name: "thumbs up", category: "Gestures" },
  { emoji: "\u{1F44E}", name: "thumbs down", category: "Gestures" },
  { emoji: "\u{1F44F}", name: "clapping", category: "Gestures" },
  { emoji: "\u{1F64C}", name: "celebration", category: "Gestures" },
  { emoji: "\u{1F91D}", name: "handshake", category: "Gestures" },
  { emoji: "\u{1F4AA}", name: "strong", category: "Gestures" },
  { emoji: "\u{1F44B}", name: "wave", category: "Gestures" },
  { emoji: "\u2764\uFE0F", name: "heart", category: "Symbols" },
  { emoji: "\u{1F525}", name: "fire", category: "Symbols" },
  { emoji: "\u{1F389}", name: "party", category: "Symbols" },
  { emoji: "\u{1F680}", name: "rocket", category: "Symbols" },
  { emoji: "\u{1F4AF}", name: "100", category: "Symbols" },
  { emoji: "\u{1F31F}", name: "star", category: "Symbols" },
  { emoji: "\u{1F440}", name: "eyes", category: "Symbols" },
  { emoji: "\u{1F4A1}", name: "idea", category: "Symbols" },
  { emoji: "\u{1F389}", name: "celebrate", category: "Symbols" },
];
const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const formatFileSize = (bytes) => {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function MessageComposer({
  onSend,
  onTypingChange,
  channelName = "channel",
  replyTo,
  onCancelReply,
  members = [],
  uploading = false,
  uploadProgress = 0,
}) {
  const [message, setMessage] = useState("");
  const [mentionQuery, setMentionQuery] = useState(null);
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const [selectedMentions, setSelectedMentions] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fileError, setFileError] = useState("");
  const [sendError, setSendError] = useState("");
  const [sending, setSending] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [emojiSearch, setEmojiSearch] = useState("");

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const previewUrlsRef = useRef(new Set());
  const emojiPickerRef = useRef(null);
  const cursorPositionRef = useRef({ start: 0, end: 0 });

  const revokePreviewUrl = (url) => {
    if (!url) return;

    URL.revokeObjectURL(url);
    previewUrlsRef.current.delete(url);
  };

  useEffect(() => {
    const previewUrls = previewUrlsRef.current;

    return () => {
      previewUrls.forEach((url) => {
        URL.revokeObjectURL(url);
      });

      previewUrls.clear();
    };
  }, []);


  useEffect(() => {
    if (!emojiPickerOpen) return;

    const handleOutsideClick = (event) => {
      if (!emojiPickerRef.current?.contains(event.target)) {
        setEmojiPickerOpen(false);
        setEmojiSearch("");
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setEmojiPickerOpen(false);
        setEmojiSearch("");
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [emojiPickerOpen]);
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
    cursorPositionRef.current = {
      start: cursor,
      end: event.target.selectionEnd,
    };

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


  const applyFormatting = (type) => {
    const formats = {
      bold: ["**", "**"],
      italic: ["*", "*"],
      strike: ["~~", "~~"],
      code: ["`", "`"],
      codeBlock: ["```\n", "\n```"],
    };

    const [prefix, suffix] = formats[type];
    const textarea = textareaRef.current;

    const start = textarea?.selectionStart ??
      cursorPositionRef.current.start;
    const end = textarea?.selectionEnd ??
      cursorPositionRef.current.end;

    const selectedText = message.slice(start, end);
    const replacement = `${prefix}${selectedText}${suffix}`;

    const updatedMessage =
      message.slice(0, start) +
      replacement +
      message.slice(end);

    const nextStart = start + prefix.length;
    const nextEnd = selectedText
      ? nextStart + selectedText.length
      : nextStart;

    setMessage(updatedMessage);

    setSelectedMentions((previous) =>
      previous.filter((mention) =>
        updatedMessage.includes(mention.token),
      ),
    );

    setMentionQuery(null);
    onTypingChange?.(Boolean(updatedMessage.trim()));

    cursorPositionRef.current = {
      start: nextStart,
      end: nextEnd,
    };

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(
        nextStart,
        nextEnd,
      );
    });
  };
  const filteredEmojis = EMOJI_OPTIONS.filter((item) => {
    const query = emojiSearch.trim().toLowerCase();

    return (
      !query ||
      item.name.includes(query) ||
      item.category.toLowerCase().includes(query)
    );
  });

  const handleInsertEmoji = (emoji) => {
    const textarea = textareaRef.current;

    const start = textarea?.selectionStart ??
      cursorPositionRef.current.start;
    const end = textarea?.selectionEnd ??
      cursorPositionRef.current.end;

    const updatedMessage =
      message.slice(0, start) + emoji + message.slice(end);

    const nextCursor = start + emoji.length;

    setMessage(updatedMessage);

    setSelectedMentions((previous) =>
      previous.filter((mention) =>
        updatedMessage.includes(mention.token),
      ),
    );

    setMentionQuery(null);
    setEmojiPickerOpen(false);
    setEmojiSearch("");
    onTypingChange?.(Boolean(updatedMessage.trim()));

    cursorPositionRef.current = {
      start: nextCursor,
      end: nextCursor,
    };

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(
        nextCursor,
        nextCursor,
      );
    });
  };
  const handleFileSelection = (event) => {
    const files = Array.from(event.target.files || []);

    setFileError("");

    const remainingSlots = MAX_FILES - selectedFiles.length;

    if (files.length > remainingSlots) {
      setFileError(`You can attach up to ${MAX_FILES} files per message.`);
    }

    const acceptedFiles = files.slice(0, remainingSlots);

    const validFiles = [];

    for (const file of acceptedFiles) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setFileError(`${file.name}: Unsupported file type.`);
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        setFileError(`${file.name}: File size cannot exceed 10 MB.`);
        continue;
      }

      if (file.size === 0) {
        setFileError(`${file.name}: Empty files cannot be uploaded.`);
        continue;
      }

      const preview = file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : null;

      if (preview) {
        previewUrlsRef.current.add(preview);
      }

      validFiles.push({
        id: `${file.name}-${file.lastModified}-${Math.random()}`,
        file,
        preview,
      });
    }

    setSelectedFiles((previous) => [
      ...previous,
      ...validFiles,
    ]);

    event.target.value = "";
  };

  const handleRemoveFile = (id) => {
    const target = selectedFiles.find((item) => item.id === id);

    if (target?.preview) {
      revokePreviewUrl(target.preview);
    }

    setSelectedFiles((previous) =>
      previous.filter((item) => item.id !== id),
    );

    setFileError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const content = message.trim();

    if (
      (!content && selectedFiles.length === 0) ||
      uploading ||
      sending
    ) {
      return;
    }

    const mentionIds = [
      ...new Set(
        selectedMentions
          .filter((mention) => content.includes(mention.token))
          .map((mention) => mention.id),
      ),
    ];

    const files = selectedFiles.map((item) => item.file);

    onTypingChange?.(false);
    setSendError("");
    setSending(true);

    try {
      const result = await onSend?.(
        content,
        replyTo?._id || null,
        mentionIds,
        files,
      );

      if (result === false || result == null) {
        throw new Error("Message could not be sent. Please try again.");
      }

      setMessage("");
      setSelectedMentions([]);
      setMentionQuery(null);

      selectedFiles.forEach((item) => {
        if (item.preview) {
          revokePreviewUrl(item.preview);
        }
      });

      setSelectedFiles([]);
      setFileError("");
      setSendError("");
    } catch (error) {
      setSendError(
        error.message || "Message could not be sent. Your draft is preserved."
      );
    } finally {
      setSending(false);
    }
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
        handleSelectMention(filteredMembers[activeMentionIndex]);
        return;
      }
    }

    if (event.key === "Escape") {
      setMentionQuery(null);
      setEmojiPickerOpen(false);
      setEmojiSearch("");
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
  };

  const canSend =
    Boolean(message.trim()) || selectedFiles.length > 0;

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
                        {replyTo.content || "Attachment"}
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

          {/* Selected attachments */}
          <AnimatePresence>
            {selectedFiles.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden border-b border-[var(--border)]"
              >
                <div className="flex flex-wrap gap-3 p-3">
                  {selectedFiles.map((item) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="group relative flex w-full max-w-[220px] items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-2"
                    >
                      {item.preview ? (
                        <img
                          src={item.preview}
                          width={48} height={48}
                          alt={item.file.name}
                          className="h-12 w-12 shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500">
                          <FileText size={23} />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-[var(--text)]">
                          {item.file.name}
                        </p>
                        <p className="text-[11px] text-[var(--muted)]">
                          {formatFileSize(item.file.size)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveFile(item.id)}
                        disabled={uploading}
                        aria-label={`Remove ${item.file.name}`}
                        className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] shadow-sm transition hover:bg-red-500 hover:text-white disabled:opacity-40"
                      >
                        <X size={13} />
                      </button>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Upload progress */}
          <AnimatePresence>
            {uploading && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden border-b border-[var(--border)] px-4 py-3"
              >
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 font-medium text-[var(--text)]">
                    <Upload size={14} className="text-indigo-500" />
                    Uploading attachments...
                  </span>
                  <span className="font-semibold text-indigo-500">
                    {uploadProgress}%
                  </span>
                </div>

                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-hover)]">
                  <motion.div
                    className="h-full rounded-full bg-indigo-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${uploadProgress}%` }}
                    transition={{ duration: 0.2 }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-2 px-3 pt-3 sm:px-4">
            <button
              type="button"
              aria-label="More options"
              onClick={() => fileInputRef.current?.click()}
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
                            width={36} height={36}
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
                onSelect={(event) => {
                  cursorPositionRef.current = {
                    start: event.target.selectionStart,
                    end: event.target.selectionEnd,
                  };
                }}
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
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.webp,.pdf,.txt,.doc,.docx,.xls,.xlsx"
                onChange={handleFileSelection}
                className="hidden"
              />

              <button
                type="button"
                aria-label="Attach file"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || selectedFiles.length >= MAX_FILES}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Paperclip size={19} />
              </button>

              <div ref={emojiPickerRef} className="relative">
                <button
                  type="button"
                  aria-label="Add emoji"
                  aria-expanded={emojiPickerOpen}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setEmojiPickerOpen((previous) => !previous);
                    setEmojiSearch("");
                  }}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
                    emojiPickerOpen
                      ? "bg-indigo-500/10 text-indigo-500"
                      : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--primary)]"
                  }`}
                >
                  <Smile size={19} />
                </button>

                <AnimatePresence>
                  {emojiPickerOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.96 }}
                      transition={{ duration: 0.16 }}
                      className="absolute bottom-full left-0 z-[100] mb-3 w-[min(320px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg)] shadow-2xl"
                    >
                      <div className="border-b border-[var(--border)] p-3">
                        <p className="mb-2 text-sm font-semibold text-[var(--text)]">
                          Choose an emoji
                        </p>

                        <input
                          type="text"
                          value={emojiSearch}
                          onChange={(event) => setEmojiSearch(event.target.value)}
                          placeholder="Search emojis..."
                          aria-label="Search emojis"
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted)] focus:border-indigo-500"
                        />
                      </div>

                      <div className="custom-scrollbar max-h-60 overflow-y-auto p-3">
                        {filteredEmojis.length > 0 ? (
                          ["Smileys", "Gestures", "Symbols"].map((category) => {
                            const categoryEmojis = filteredEmojis.filter(
                              (item) => item.category === category
                            );

                            if (!categoryEmojis.length) return null;

                            return (
                              <div key={category} className="mb-3 last:mb-0">
                                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                                  {category}
                                </p>

                                <div className="grid grid-cols-7 gap-1">
                                  {categoryEmojis.map((item, index) => (
                                    <button
                                      key={`${category}-${item.name}-${index}`}
                                      type="button"
                                      title={item.name}
                                      aria-label={item.name}
                                      onMouseDown={(event) => event.preventDefault()}
                                      // eslint-disable-next-line react-hooks/refs
                                      onClick={() => handleInsertEmoji(item.emoji)}
                                      className="flex h-9 w-9 items-center justify-center rounded-lg text-xl transition hover:scale-110 hover:bg-[var(--surface-hover)] active:scale-95"
                                    >
                                      {item.emoji}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <p className="py-8 text-center text-sm text-[var(--muted)]">
                            No emojis found.
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="mx-1 h-5 w-px bg-[var(--border)]" />

              {[
                { type: "bold", label: "Bold", icon: Bold },
                { type: "italic", label: "Italic", icon: Italic },
                { type: "strike", label: "Strikethrough", icon: Strikethrough },
                { type: "code", label: "Inline code", icon: Code2 },
                { type: "codeBlock", label: "Code block", icon: Code2 },
              ].map(({ type, label, icon: Icon }) => (
                <button
                  key={type}
                  type="button"
                  aria-label={label}
                  title={label}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applyFormatting(type)}
                  disabled={uploading || sending}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--surface-hover)] hover:text-indigo-500 disabled:opacity-40"
                >
                  <Icon size={16} />
                </button>
              ))}
              {selectedFiles.length > 0 && (
                <span className="ml-1 text-[11px] text-[var(--muted)]">
                  {selectedFiles.length}/{MAX_FILES} files
                </span>
              )}
            </div>

            <motion.button
              type="submit"
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.92 }}
              disabled={!canSend || uploading || sending}
              aria-label={sending ? "Sending message" : "Send message"}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {sending ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <Send size={18} />
              )}
            </motion.button>
          </div>

          {sendError && (
            <div
              role="alert"
              className="border-t border-red-500/20 bg-red-500/5 px-4 py-2 text-xs text-red-500"
            >
              <div className="flex items-center justify-between gap-3">
                <span>{sendError}</span>
                <span className="shrink-0 font-semibold">
                  Draft preserved
                </span>
              </div>
            </div>
          )}

          {fileError && (
            <p className="border-t border-red-500/20 px-4 py-2 text-xs text-red-500">
              {fileError}
            </p>
          )}
        </div>

        <p className="mt-2 hidden text-center text-[11px] text-[var(--muted)] sm:block">
          Type @ to mention a teammate {"\u00B7"} Enter to send {"\u00B7"} Shift + Enter for a new line
        </p>
      </div>
    </form>
  );
}





