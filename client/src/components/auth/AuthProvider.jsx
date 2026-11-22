import { useEffect } from "react";
import { useDispatch } from "react-redux";
import authService from "../../services/authService";
import {
  setCredentials,
  logout,
} from "../../features/auth/authSlice";

export default function AuthProvider({ children }) {
  const dispatch = useDispatch();

  useEffect(() => {
    let active = true;

    const restoreSession = async () => {
      try {
        let token = localStorage.getItem("cirql-access-token");

        if (token) {
          try {
            const response = await authService.getMe();

            if (active) {
              dispatch(setCredentials({
                user: response.user,
                accessToken: token,
              }));
            }

            return;
          } catch {
            // The access token may have expired. Try the refresh cookie.
          }
        }

        const refreshResponse = await authService.refresh();
        token = refreshResponse.accessToken;

        if (!token) {
          throw new Error("Session refresh failed");
        }

        localStorage.setItem("cirql-access-token", token);

        const userResponse = await authService.getMe();

        if (active) {
          dispatch(setCredentials({
            user: userResponse.user,
            accessToken: token,
          }));
        }
      } catch {
        if (active) {
          dispatch(logout());
        }
      }
    };

    restoreSession();

    const handleExpired = () => {
      dispatch(logout());
    };

    window.addEventListener("cirql:auth-expired", handleExpired);

    return () => {
      active = false;
      window.removeEventListener("cirql:auth-expired", handleExpired);
    };
  }, [dispatch]);

  return children;
}

