import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

console.log("🚀 RAD Flow starting...");
if (!import.meta.env.VITE_SUPABASE_URL) {
  alert("CRITICAL ERROR: VITE_SUPABASE_URL is missing in Netlify environment variables!");
}
createRoot(document.getElementById("root")!).render(<App />);
