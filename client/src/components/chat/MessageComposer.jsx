import { useState } from "react";
import { motion } from "motion/react";
import {
  Paperclip,
  Smile,
  Send,
  Plus,
} from "lucide-react";

export default function MessageComposer({ onSend }) {
  const [message, setMessage] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();

    const content = message.trim();

    if (!content) return;

    onSend?.(content);
    setMessage("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="shrink-0 border-t border-[var(--border)] bg-[var(--bg)] px-3 py-3 sm:px-5 sm:py-4"
    >
      <div className="mx-auto max-w-4xl">
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm transition-all focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-500/10">

          {/* Message input */}
          <div className="flex items-center gap-2 px-3 pt-3 sm:px-4">
            <button
              type="button"
              aria-label="More options"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[var(--muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--primary)]"
            >
              <Plus size={21} />
            </button>

            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  handleSubmit(event);
                }
              }}
              placeholder="Message #general..."
              rows={1}
              className="max-h-32 min-h-10 min-w-0 flex-1 resize-none bg-transparent py-2.5 text-sm leading-6 text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
            />
          </div>

          {/* Bottom toolbar */}
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
          Press Enter to send · Shift + Enter for a new line
        </p>
      </div>
    </form>
  );
}