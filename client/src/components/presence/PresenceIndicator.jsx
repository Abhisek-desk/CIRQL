import { m as motion } from "motion/react";

export default function PresenceIndicator({
  online = false,
  size = "sm",
  className = "",
}) {
  const dimensions = size === "lg" ? "h-3 w-3" : "h-2.5 w-2.5";

  return (
    <span
      title={online ? "Online" : "Offline"}
      className={`absolute bottom-0 right-0 flex ${dimensions} items-center justify-center rounded-full border-2 border-[var(--sidebar)] ${
        online ? "bg-emerald-500" : "bg-zinc-400"
      } ${className}`}
    >
      {online && (
        <motion.span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-emerald-400"
          animate={{ scale: [1, 1.8], opacity: [0.5, 0] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        />
      )}
    </span>
  );
}

