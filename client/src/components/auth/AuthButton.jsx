import { motion } from "motion/react";
import { LoaderCircle, ArrowRight } from "lucide-react";

export default function AuthButton({ children, loading, ...props }) {
  return (
    <motion.button
      whileHover={{ scale: loading ? 1 : 1.015 }}
      whileTap={{ scale: loading ? 1 : 0.98 }}
      disabled={loading}
      {...props}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? (
        <>
          <LoaderCircle size={18} className="animate-spin" />
          Please wait...
        </>
      ) : (
        <>
          {children}
          <ArrowRight size={17} />
        </>
      )}
    </motion.button>
  );
}
