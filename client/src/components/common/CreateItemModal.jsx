import { useEffect, useState } from "react";
import { AnimatePresence, m as motion } from "motion/react";
import { X } from "lucide-react";

export default function CreateItemModal({
  open,
  onClose,
  onSubmit,
  title,
  description,
  isChannel = false,
}) {
  const [name, setName] = useState("");
  const [details, setDetails] = useState("");
  const [type, setType] = useState("public");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setDetails("");
      setType("public");
      setLoading(false);
    }
  }, [open]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (name.trim().length < 2) return;

    try {
      setLoading(true);
      await onSubmit({
        name: name.trim(),
        description: details.trim(),
        ...(isChannel ? { type } : {}),
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.97 }}
            className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl"
          >
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-[var(--text)]">
                  {title}
                </h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {description}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-hover)]"
              >
                <X size={19} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--text)]">
                  Name
                </label>
                <input
                  autoFocus
                  required
                  minLength={2}
                  maxLength={50}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={isChannel ? "e.g. development" : "e.g. Design Team"}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--text)] outline-none transition focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--text)]">
                  Description <span className="text-[var(--muted)]">(optional)</span>
                </label>
                <textarea
                  value={details}
                  onChange={(event) => setDetails(event.target.value)}
                  maxLength={300}
                  rows={3}
                  placeholder="What is this space for?"
                  className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--text)] outline-none focus:border-indigo-500"
                />
              </div>

              {isChannel && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--text)]">
                    Channel visibility
                  </label>
                  <select
                    value={type}
                    onChange={(event) => setType(event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--text)] outline-none"
                  >
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                  </select>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || name.trim().length < 2}
                className="flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
              >
                {loading ? "Creating..." : `Create ${isChannel ? "channel" : "workspace"}`}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

