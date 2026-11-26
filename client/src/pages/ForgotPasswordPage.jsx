import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react";

import AuthLayout from "../components/auth/AuthLayout";
import AuthInput from "../components/auth/AuthInput";
import AuthButton from "../components/auth/AuthButton";
import authService from "../services/authService";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const normalizedEmail = email.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Enter a valid email address");
      return;
    }

    try {
      setLoading(true);
      setError("");

      await authService.forgotPassword({
        email: normalizedEmail,
      });

      setSubmitted(true);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
        "Unable to process your request. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title={submitted ? "Check your inbox" : "Forgot your password?"}
      subtitle={
        submitted
          ? "If an account exists with that email, a reset link has been sent."
          : "No worries. Enter your email and we'll send you a password reset link."
      }
    >
      {submitted ? (
        <div className="space-y-6">
          <div className="flex flex-col items-center rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-8 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 size={34} />
            </div>

            <h3 className="text-lg font-bold">Request received</h3>

            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Check your email for further instructions. If you don't see it,
              check your spam folder too.
            </p>
          </div>

          <Link
            to="/login"
            className="flex h-12 items-center justify-center gap-2 rounded-xl border border-[var(--border)] text-sm font-semibold transition hover:border-indigo-500 hover:text-indigo-500"
          >
            <ArrowLeft size={17} />
            Back to sign in
          </Link>
        </div>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="space-y-5">
            <AuthInput
              label="Email address"
              name="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setError("");
              }}
              error={error}
            />

            <AuthButton type="submit" loading={loading}>
              <Mail size={17} />
              Send reset link
            </AuthButton>
          </form>

          <p className="mt-7 text-center text-sm text-[var(--muted)]">
            Remember your password?{" "}
            <Link
              to="/login"
              className="font-semibold text-indigo-500 hover:text-violet-500"
            >
              Sign in
            </Link>
          </p>
        </>
      )}
    </AuthLayout>
  );
}
