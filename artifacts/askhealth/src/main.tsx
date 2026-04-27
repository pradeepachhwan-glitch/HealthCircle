import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Register the PWA service worker. We only register on the deployed site (not in
// the workspace iframe) so the SW doesn't intercept the dev preview lifecycle.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((err) => {
        console.warn("[PWA] Service worker registration failed:", err);
      });
  });
}
