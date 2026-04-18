import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function ProtectedRoute() {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      // 1. Check for Bypass Flag (Hackathon Mode)
      const bypass = localStorage.getItem("radflow_auth_bypass");
      if (bypass === "true") {
        setIsAuthenticated(true);
        setLoading(false);
        return;
      }

      // 2. Fallback to Supabase
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsAuthenticated(true);
      }
      setLoading(false);
    }
    
    checkAuth();
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f172a", color: "white", fontFamily: "sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>RAD FLOW</h1>
          <p style={{ opacity: 0.6 }}>Securing diagnostic session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return <Outlet />;
}
