import { motion } from "motion/react";

export default function TypingIndicator({ name = "Someone" }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3 text-xs text-[var(--muted)]">
      <span>{name} is typing</span>
      <div className="flex gap-1">
        {[0, 1, 2].map((item) => (
          <motion.span
            key={item}
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: item * 0.15 }}
            className="h-1.5 w-1.5 rounded-full bg-indigo-500"
          />
        ))}
      </div>
    </div>
  );
}
