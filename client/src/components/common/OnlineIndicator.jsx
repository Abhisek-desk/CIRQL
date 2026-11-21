export default function OnlineIndicator({ online = false, className = "" }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full border-2 border-[var(--sidebar)] ${
        online ? "bg-emerald-500" : "bg-zinc-400"
      } ${className}`}
      aria-label={online ? "Online" : "Offline"}
    />
  );
}
