import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import toast from "react-hot-toast";

import AuthLayout from "../components/auth/AuthLayout";
import AuthInput from "../components/auth/AuthInput";
import AuthButton from "../components/auth/AuthButton";
import authService from "../services/authService";
import { setCredentials } from "../features/auth/authSlice";

export default function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    setForm({
      ...form,
      [event.target.name]: event.target.value,
    });

    setErrors({
      ...errors,
      [event.target.name]: "",
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const nextErrors = {};

    if (!form.email.trim()) nextErrors.email = "Email is required";
    if (!form.password) nextErrors.password = "Password is required";

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    try {
      setLoading(true);

      const data = await authService.login(form);

      if (!data.accessToken || !data.user) {
        throw new Error("Unexpected login response from server");
      }

      dispatch(setCredentials({
        user: data.user,
        accessToken: data.accessToken,
      }));

      toast.success("Welcome back!");
      navigate("/", { replace: true });
    } catch (error) {
      toast.error(
        error.response?.data?.message || error.message || "Login failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue to your CIRQL workspace."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthInput
          label="Email address"
          name="email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          value={form.email}
          onChange={handleChange}
          error={errors.email}
        />

        <AuthInput
          label="Password"
          name="password"
          type="password"
          placeholder="Enter your password"
          autoComplete="current-password"
          value={form.password}
          onChange={handleChange}
          error={errors.password}
        />

        <div className="flex justify-end">
          <span className="text-xs text-[var(--muted)]">
            Forgot password? Coming soon
          </span>
        </div>

        <AuthButton type="submit" loading={loading}>
          Sign in
        </AuthButton>
      </form>

      <p className="mt-7 text-center text-sm text-[var(--muted)]">
        Don't have an account?{" "}
        <Link
          to="/register"
          className="font-semibold text-indigo-500 hover:text-violet-500"
        >
          Create account
        </Link>
      </p>
    </AuthLayout>
  );
}
