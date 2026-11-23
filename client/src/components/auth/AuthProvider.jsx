import { useEffect } from "react";
import { useDispatch } from "react-redux";

import authService from "../../services/authService";

import {
  setCredentials,
  logout,
} from "../../features/auth/authSlice";

// Share session restoration between React Strict Mode effect executions.
let sessionRestorePromise = null;

const restoreSession = () => {
  if (!sessionRestorePromise) {
    sessionRestorePromise = (async () => {
      // No access token means there is no known active session.
      // Do not unnecessarily call the refresh endpoint.
      const existingToken = localStorage.getItem("cirql-access-token");

      if (!existingToken) {
        return null;
      }

      try {
        // If the token is valid, getMe succeeds.
        // If expired, the Axios interceptor attempts one refresh.
        const response = await authService.getMe();

        // Read again because Axios may have refreshed the token.
        const latestToken = localStorage.getItem("cirql-access-token");

        if (!latestToken || !response.user) {
          return null;
        }

        return {
          user: response.user,
          accessToken: latestToken,
        };
      } catch {
        return null;
      }
    })().finally(() => {
      sessionRestorePromise = null;
    });
  }

  return sessionRestorePromise;
};

export default function AuthProvider({ children }) {
  const dispatch = useDispatch();

  useEffect(() => {
    let active = true;

    const initializeSession = async () => {
      const session = await restoreSession();

      if (!active) return;

      if (session) {
        dispatch(
          setCredentials({
            user: session.user,
            accessToken: session.accessToken,
          }),
        );
      } else {
        dispatch(logout());
      }
    };

    initializeSession();

    const handleExpired = () => {
      dispatch(logout());
    };

    window.addEventListener("cirql:auth-expired", handleExpired);

    return () => {
      active = false;

      window.removeEventListener(
        "cirql:auth-expired",
        handleExpired,
      );
    };
  }, [dispatch]);

  return children;
}