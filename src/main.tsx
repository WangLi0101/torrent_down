import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { PreferencesProvider } from "./context/PreferencesContext";
import { SnackbarProvider } from "./hooks/useSnackbar";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SnackbarProvider>
      <PreferencesProvider>
        <App />
      </PreferencesProvider>
    </SnackbarProvider>
  </React.StrictMode>,
);