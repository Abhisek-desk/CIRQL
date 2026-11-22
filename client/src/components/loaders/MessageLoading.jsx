import { m as motion } from "motion/react";

export default function MessageLoading() {
  return (
    <div className="space-y-7 p-5">
      {[1, 2, 3, 4].map((item) => (
        <div key={item} className="flex gap-3">
          <motion.div
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 1.3, repeat: Infinity }}
            className="h-10 w-10 shrink-0 rounded-full bg-[var(--surface-hover)]"
          />
          <div className="flex flex-1 flex-col gap-3">
            {[0, 1, 2].map((line) => (
              <motion.div
                key={line}
                animate={{ opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 1.3, repeat: Infinity, delay: line * 0.15 }}
                className={`h-3 rounded-full bg-[var(--surface-hover)] ${line === 0 ? "w-28" : line === 1 ? "w-3/4" : "w-1/2"}`}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

