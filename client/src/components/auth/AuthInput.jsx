import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export default function AuthInput({
  label,
  type = "text",
  error,
  id,
  ...props
}) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";

  const inputId = id || props.name;
  const errorId = `${inputId}-error`;

  return (
    <div className="space-y-2">
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-[var(--text)]"
      >
        {label}
      </label>

      <div className="relative">
        <input
          {...props}
          id={inputId}
          type={isPassword ? (visible ? "text" : "password") : type}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={`h-12 w-full rounded-xl border bg-[var(--surface)] px-4 text-sm text-[var(--text)] outline-none transition placeholder:text-[var(--muted)] focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 ${
            error ? "border-red-500" : "border-[var(--border)]"
          } ${isPassword ? "pr-12" : ""}`}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible(!visible)}
            aria-label={visible ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-indigo-500"
          >
            {visible ? <EyeOff size={19} /> : <Eye size={19} />}
          </button>
        )}
      </div>

      {error && (
        <p id={errorId} className="text-xs text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}