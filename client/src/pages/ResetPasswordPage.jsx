import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, LockKeyhole } from "lucide-react";

import AuthLayout from "../components/auth/AuthLayout";
import AuthInput from "../components/auth/AuthInput";
import AuthButton from "../components/auth/AuthButton";
import authService from "../services/authService";

export default function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setErrors((previous) => ({
      ...previous,
      [name]: "",
      form: "",
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const nextErrors = {};

    if (form.password.length < 8) {
      nextErrors.password = "Password must contain at least 8 characters";
    } else if (form.password.length > 72) {
      nextErrors.password = "Password cannot exceed 72 characters";
    }

    if (!form.confirmPassword) {
      nextErrors.confirmPassword = "Please confirm your password";
    } else if (form.password !== form.confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match";
    }

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    try {
      setLoading(true);
      setErrors({});

      await authService.resetPassword({
        token,
        password: form.password,
      });

      setSuccess(true);
    } catch (error) {
      setErrors({
        form:
          error.response?.data?.message ||
          "This reset link is invalid or expired. Please request a new one.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title={success ? "Password updated!" : "Create a new password"}
      subtitle={
        success
          ? "Your CIRQL account is now protected with your new password."
          : "Choose a strong password that you don't use elsewhere."
      }
    >
      {success ? (
        <div className="space-y-6">
          <div className="flex flex-col items-center rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-8 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 size={34} />
            </div>

            <h3 className="text-lg font-bold">Password changed successfully</h3>

            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              You can now sign in using your new password.
            </p>
          </div>

          <AuthButton type="button" onClick={() => navigate("/login", { replace: true })}>
            Continue to sign in
          </AuthButton>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <AuthInput
            label="New password"
            name="password"
            type="password"
            placeholder="At least 8 characters"
            autoComplete="new-password"
            value={form.password}
            onChange={handleChange}
            error={errors.password}
          />

          <AuthInput
            label="Confirm new password"
            name="confirmPassword"
            type="password"
            placeholder="Enter your password again"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={handleChange}
            error={errors.confirmPassword}
          />

          {errors.form && (
            <div
              role="alert"
              className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-500"
            >
              {errors.form}
            </div>
          )}

          <AuthButton type="submit" loading={loading}>
            <LockKeyhole size={17} />
            Reset password
          </AuthButton>

          <p className="text-center text-xs text-[var(--muted)]">
            Your reset link is valid for a limited time and can only be used once.
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
