import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("cirql-access-token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config; 
});

let refreshPromise = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const requestUrl = originalRequest?.url || "";

    const excludedRoutes = [
      "/auth/login",
      "/auth/register",
      "/auth/refresh",
      "/auth/logout",
      "/auth/forgot-password",
      "/auth/reset-password",
    ];

    const isAuthRoute = excludedRoutes.some((route) =>
      requestUrl.includes(route)
    );

    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      isAuthRoute
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = axios
          .post(`${baseURL}/auth/refresh`, {}, {
            withCredentials: true,
          })
          .then((response) => {
            const newToken = response.data.accessToken;

            if (!newToken) {
              throw new Error("Refresh response did not contain an access token");
            }

            localStorage.setItem("cirql-access-token", newToken);
            return newToken;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }

      const newToken = await refreshPromise;

      originalRequest.headers.Authorization = `Bearer ${newToken}`;

      return api(originalRequest);
    } catch (refreshError) {
      localStorage.removeItem("cirql-access-token");
      window.dispatchEvent(new Event("cirql:auth-expired"));

      return Promise.reject(refreshError);
    }
  }
);

export default api;
