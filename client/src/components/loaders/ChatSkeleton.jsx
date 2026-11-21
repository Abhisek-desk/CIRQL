import { motion } from "motion/react";

const SkeletonLine = ({ width = "w-full" }) => (
  <motion.div
    animate={{ opacity: [0.35, 0.7, 0.35] }}
    transition={{ duration: 1.4, repeat: Infinity }}
    className={`h-3 ${width} rounded-full bg-[var(--surface-hover)]`}
  />
);

export default function ChatSkeleton() {
  return (
    <div className="space-y-7 p-6">
      {[1, 2, 3, 4].map((item) => (
        <div key={item} className="flex gap-3">
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-[var(--surface-hover)]" />

          <div className="flex flex-1 flex-col gap-3">
            <SkeletonLine width="w-32" />
            <SkeletonLine width="w-3/4" />
            <SkeletonLine width="w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}