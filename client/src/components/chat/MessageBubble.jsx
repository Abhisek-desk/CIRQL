import { motion } from "motion/react";
import { Smile, Reply, MoreHorizontal } from "lucide-react";

export default function MessageBubble({ message, isOwn = false }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.22 }}
      className={`group flex gap-3 px-4 py-3 transition-colors hover:bg-[var(--surface)]/50 ${isOwn ? "flex-row-reverse" : ""}`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 font-bold text-white">
        {message.name?.charAt(0) || "U"}
      </div>

      <div className={`min-w-0 max-w-[85%] md:max-w-[75%] ${isOwn ? "text-right" : ""}`}>
        <div className={`mb-1 flex flex-wrap items-center gap-2 ${isOwn ? "justify-end" : ""}`}>
          <span className="text-sm font-semibold text-[var(--text)]">
            {message.name}
          </span>
          <span className="text-xs text-[var(--muted)]">{message.time}</span>
        </div>

        <div className={`rounded-2xl px-4 py-3 text-left text-sm leading-6 ${
          isOwn
            ? "rounded-tr-sm bg-indigo-600 text-white"
            : "rounded-tl-sm border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-sm"
        }`}>
          {message.content}
        </div>

        <div className={`mt-2 flex gap-2 opacity-0 transition group-hover:opacity-100 ${isOwn ? "justify-end" : ""}`}>
          <button className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--surface-hover)]">
            <Smile size={15} />
          </button>
          <button className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--surface-hover)]">
            <Reply size={15} />
          </button>
          <button className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--surface-hover)]">
            <MoreHorizontal size={15} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
