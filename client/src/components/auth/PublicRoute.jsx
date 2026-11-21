import { Navigate, Outlet } from "react-router-dom";
import { useSelector } from "react-redux";

export default function PublicRoute() {
  const { isAuthenticated, isLoading } = useSelector(
    (state) => state.auth
  );

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-indigo-500/20 border-t-indigo-500" />
      </div>
    );
  }

  return isAuthenticated
    ? <Navigate to="/" replace />
    : <Outlet />;
}
