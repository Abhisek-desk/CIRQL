import { m as motion } from "motion/react";

export default function TypingIndicator({ names = [] }) {
  if (!names.length) return null;

  let label;

  if (names.length === 1) {
    label = `${names[0]} is typing`;
  } else if (names.length === 2) {
    label = `${names[0]} and ${names[1]} are typing`;
  } else {
    label = `${names[0]} and ${names.length - 1} others are typing`;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      className="flex items-center gap-3 px-5 py-3 text-xs text-[var(--muted)]"
    >
      <span>{label}</span>

      <div className="flex gap-1">
        {[0, 1, 2].map((item) => (
          <motion.span
            key={item}
            animate={{ y: [0, -4, 0] }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: item * 0.15,
            }}
            className="h-1.5 w-1.5 rounded-full bg-indigo-500"
          />
        ))}
      </div>
    </motion.div>
  );
}
