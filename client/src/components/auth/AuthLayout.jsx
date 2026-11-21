import { motion } from "motion/react";
import { MessageCircle, Zap, Users, ShieldCheck } from "lucide-react";
import ThemeToggle from "../common/ThemeToggle";

export default function AuthLayout({ children, title, subtitle }) {
  return (
    <div className="relative flex min-h-dvh overflow-hidden bg-[var(--bg)] text-[var(--text)]">

      <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl" />

      <div className="absolute right-5 top-5 z-20">
        <ThemeToggle />
      </div>

      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden border-r border-[var(--border)] bg-[var(--sidebar)] p-12 lg:flex xl:p-16">

        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/25">
              <MessageCircle size={25} />
            </div>
            <span className="text-2xl font-black tracking-tight">CIRQL</span>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mt-28 max-w-lg"
          >
            <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-4 py-2 text-xs font-semibold text-indigo-500">
              CONNECT. COLLABORATE. CREATE.
            </span>

            <h1 className="mt-7 text-5xl font-black leading-tight xl:text-6xl">
              Great work
              <br />
              happens
              <br />
              <span className="bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-transparent">
                together.
              </span>
            </h1>

            <p className="mt-6 max-w-md text-base leading-7 text-[var(--muted)]">
              Bring your team, conversations and ideas together in one
              beautifully connected workspace.
            </p>
          </motion.div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: Zap, label: "Real-time" },
            { icon: Users, label: "Teamwork" },
            { icon: ShieldCheck, label: "Secure" },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 p-4"
            >
              <Icon size={21} className="mb-3 text-indigo-500" />
              <p className="text-sm font-semibold">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="relative flex min-h-dvh flex-1 items-center justify-center px-5 py-20 sm:px-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="mb-9 lg:hidden">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white">
                <MessageCircle size={23} />
              </div>
              <span className="text-2xl font-black">CIRQL</span>
            </div>
          </div>

          <h2 className="text-3xl font-black tracking-tight">{title}</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">{subtitle}</p>

          <div className="mt-8">{children}</div>

          <p className="mt-9 text-center text-xs text-[var(--muted)]">
            © {new Date().getFullYear()} CIRQL. Built for better teamwork.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
