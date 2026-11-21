import { motion } from "motion/react";
import { Plus, Hash, Settings } from "lucide-react";

export default function WorkspaceSidebar({
  workspaces = [],
  selectedWorkspace,
  onSelectWorkspace,
  onCreateWorkspace,
}) {
  const workspaceColors = [
    "#6366f1",
    "#8b5cf6",
    "#0d9488",
    "#db2777",
    "#2563eb",
  ];

  return (
    <motion.aside
      initial={{ x: -60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.35 }}
      className="flex h-full w-[72px] shrink-0 flex-col items-center gap-4 overflow-hidden border-r border-[var(--border)] bg-[var(--sidebar)] py-5"
    >
      {/* CIRQL logo */}
      <div className="mb-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-xl font-black text-white shadow-lg shadow-indigo-600/20">
        C
      </div>

      {/* Workspace list */}
      <div className="hide-scrollbar flex min-h-0 max-h-[55vh] w-full flex-col items-center gap-4 overflow-y-auto px-2">
        {workspaces.map((workspace, index) => {
          const active = selectedWorkspace?._id === workspace._id;

          return (
            <motion.button
              key={workspace._id}
              type="button"
              title={workspace.name}
              onClick={() => onSelectWorkspace(workspace)}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              transition={{ duration: 0.18 }}
              className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border-2 text-sm font-bold text-white transition-all duration-200 ${
                active
                  ? "border-indigo-300 shadow-lg shadow-indigo-500/30"
                  : "border-transparent opacity-75 hover:opacity-100"
              }`}
              style={{
                backgroundColor: workspaceColors[index % workspaceColors.length],
              }}
            >
              {workspace.name?.charAt(0).toUpperCase()}
            </motion.button>
          );
        })}
      </div>

      {/* Create workspace */}
      <motion.button
        type="button"
        onClick={onCreateWorkspace}
        title="Create workspace"
        whileHover={{ scale: 1.1, rotate: 90 }}
        whileTap={{ scale: 0.9 }}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-dashed border-[var(--muted)] text-[var(--muted)] transition hover:border-indigo-500 hover:text-indigo-500"
      >
        <Plus size={21} />
      </motion.button>

      {/* Bottom actions */}
      <div className="mt-auto flex shrink-0 flex-col gap-3">
        <button
          type="button"
          title="Channels"
          className="rounded-xl p-3 text-[var(--muted)] transition hover:bg-[var(--surface)]"
        >
          <Hash size={19} />
        </button>

        <button
          type="button"
          title="Settings"
          className="rounded-xl p-3 text-[var(--muted)] transition hover:bg-[var(--surface)]"
        >
          <Settings size={19} />
        </button>
      </div>
    </motion.aside>
  );
}