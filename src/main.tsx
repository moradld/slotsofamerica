import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { preloadSiteSettings } from "./lib/preloadSettings";

preloadSiteSettings().finally(() => {
  createRoot(document.getElementById("root")!).render(<App />);
});
