import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Sign up first (in case user doesn't exist)
    const { data: upData, error: upErr } = await supabase.auth.signUp({ email, password });
    
    // Then sign in
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error && !upData?.user) {
      alert(error.message);
    } else {
      navigate("/");
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f172a", color: "white", fontFamily: "sans-serif" }}>
      <div style={{ background: "#1e293b", padding: "2rem", borderRadius: "1rem", width: "100%", maxWidth: "400px", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)" }}>
        <h1 style={{ textAlign: "center", fontSize: "1.875rem", fontWeight: "bold", marginBottom: "1.5rem" }}>RAD FLOW</h1>
        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <input 
            type="email" 
            placeholder="Email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            style={{ padding: "0.75rem", borderRadius: "0.5rem", border: "1px solid #334155", background: "#0f172a", color: "white" }} 
            required 
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            style={{ padding: "0.75rem", borderRadius: "0.5rem", border: "1px solid #334155", background: "#0f172a", color: "white" }} 
            required 
          />
          <button 
            type="submit" 
            disabled={loading}
            style={{ padding: "0.75rem", borderRadius: "0.5rem", border: "none", background: "#3b82f6", color: "white", fontWeight: "bold", cursor: "pointer" }}
          >
            {loading ? "Loading..." : "Enter App"}
          </button>
        </form>
      </div>
    </div>
  );
}
