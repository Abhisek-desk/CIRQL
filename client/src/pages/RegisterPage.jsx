import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import toast from "react-hot-toast";

import AuthLayout from "../components/auth/AuthLayout";
import AuthInput from "../components/auth/AuthInput";
import AuthButton from "../components/auth/AuthButton";
import authService from "../services/authService";
import { setCredentials } from "../features/auth/authSlice";

export default function RegisterPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
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

    if (form.name.trim().length < 2) {
      nextErrors.name = "Name must contain at least 2 characters";
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      nextErrors.email = "Enter a valid email address";
    }

    if (form.password.length < 8) {
      nextErrors.password = "Password must contain at least 8 characters";
    }

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    try {
      setLoading(true);

      const data = await authService.register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });

      if (!data.accessToken || !data.user) {
        throw new Error("Unexpected registration response from server");
      }

      dispatch(setCredentials({
        user: data.user,
        accessToken: data.accessToken,
      }));

      toast.success("Your CIRQL account is ready!");
      navigate("/", { replace: true });
    } catch (error) {
      toast.error(
        error.response?.data?.message || error.message || "Registration failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start collaborating with your team today."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthInput
          label="Full name"
          name="name"
          placeholder="Your name"
          autoComplete="name"
          value={form.name}
          onChange={handleChange}
          error={errors.name}
        />

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
          placeholder="At least 8 characters"
          autoComplete="new-password"
          value={form.password}
          onChange={handleChange}
          error={errors.password}
        />

        <AuthButton type="submit" loading={loading}>
          Create account
        </AuthButton>
      </form>

      <p className="mt-7 text-center text-sm text-[var(--muted)]">
        Already have an account?{" "}
        <Link
          to="/login"
          className="font-semibold text-indigo-500 hover:text-violet-500"
        >
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
