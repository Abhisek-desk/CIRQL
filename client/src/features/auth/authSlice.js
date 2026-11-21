import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  user: null,
  accessToken: localStorage.getItem("cirql-access-token"),
  isAuthenticated: false,
  isLoading: true,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.isAuthenticated = true;
      state.isLoading = false;

      localStorage.setItem(
        "cirql-access-token",
        action.payload.accessToken
      );
    },

    setUser: (state, action) => {
      state.user = action.payload;
      state.isAuthenticated = Boolean(action.payload);
      state.isLoading = false;
    },

    setAccessToken: (state, action) => {
      state.accessToken = action.payload;
      localStorage.setItem("cirql-access-token", action.payload);
    },

    logout: (state) => {
      state.user = null;
      state.accessToken = null;
      state.isAuthenticated = false;
      state.isLoading = false;

      localStorage.removeItem("cirql-access-token");
    },

    setAuthLoading: (state, action) => {
      state.isLoading = action.payload;
    },
  },
});

export const {
  setCredentials,
  setUser,
  setAccessToken,
  logout,
  setAuthLoading,
} = authSlice.actions;

export default authSlice.reducer;
