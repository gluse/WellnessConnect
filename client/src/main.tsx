import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./components/provider/service-editor.css";
import "./components/forms-phase2.css";
import "./lib/i18n";
import { installServiceNavigationTracking } from "./components/provider/service-navigation-guard";

// Register before router subscribers so a dirty editor can restore Back/Forward
// navigation before React renders another workspace or route.
const stopServiceNavigationTracking = installServiceNavigationTracking();
if (import.meta.hot) import.meta.hot.dispose(stopServiceNavigationTracking);
createRoot(document.getElementById("root")!).render(<App />);
import "./components/forms-phase3.css";
import "./components/forms-auth.css";
import "./components/search-page.css";
