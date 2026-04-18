import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

window.onerror = function(msg, url, lineNo, columnNo, error) {
  const errDiv = document.createElement("div");
  errDiv.style.cssText = "position:fixed; top:0; left:0; width:100%; background:red; color:white; padding:20px; z-index:9999; font-family:monospace;";
  errDiv.innerHTML = "<b>RUNTIME ERROR:</b><br/>" + msg + "<br/><br/>Please check Netlify Environment Variables.";
  document.body.appendChild(errDiv);
  return false;
};

console.log("🚀 RAD Flow starting...");
if (!import.meta.env.VITE_SUPABASE_URL) {
  const envErr = document.createElement("div");
  envErr.style.cssText = "position:fixed; top:50px; left:0; width:100%; background:orange; color:black; padding:20px; z-index:9999; font-family:monospace;";
  envErr.innerHTML = "<b>CONFIG ERROR:</b> VITE_SUPABASE_URL is missing in Netlify Site Settings!";
  document.body.appendChild(envErr);
}
createRoot(document.getElementById("root")!).render(<App />);
