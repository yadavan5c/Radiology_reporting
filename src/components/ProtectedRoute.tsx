import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function ProtectedRoute() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f172a", color: "white" }}>Loading...</div>;
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  return <Outlet />;
}
