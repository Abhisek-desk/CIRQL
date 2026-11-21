import React from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider } from "./context/ThemeContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
        <h1 className="p-10 text-3xl font-bold">
          CIRQL
        </h1>
      </div>
    </ThemeProvider>
  </React.StrictMode>
);