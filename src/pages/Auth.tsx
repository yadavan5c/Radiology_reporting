import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const navigate = useNavigate();

  const handleBypassAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // EMERGENCY BYPASS LOGIC
    // We store a flag in localStorage to bypass the ProtectedRoute check
    localStorage.setItem("radflow_auth_bypass", "true");
    localStorage.setItem("radflow_user_name", email || "Guest");
    
    toast.success("Access Granted (Bypass Mode)");
    setTimeout(() => {
      navigate("/");
      setLoading(false);
    }, 500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_100%)] from-primary/5">
      <Card className="w-full max-w-md border-border/50 shadow-2xl backdrop-blur-sm bg-card/80">
        <CardHeader className="space-y-2 text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center shadow-lg overflow-hidden border-2 border-primary/20">
               {!logoError ? (
                 <img 
                   src="/logo.png" 
                   alt="Logo" 
                   className="h-full w-full object-cover" 
                   onError={() => setLogoError(true)} 
                 />
               ) : (
                 <div className="text-white font-bold text-2xl uppercase tracking-tighter">RF</div>
               )}
            </div>
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight text-foreground">RAD FLOW</CardTitle>
          <CardDescription className="text-muted-foreground/80">
            Intelligence Command Center Access
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleBypassAuth}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Username or Name"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-background/50 h-11 border-border/50 focus:border-primary/50"
              />
            </div>
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-background/50 h-11 border-border/50 focus:border-primary/50"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full font-semibold h-11 shadow-lg shadow-primary/20 bg-primary hover:bg-primary-glow transition-all" disabled={loading}>
              {loading ? "Accessing..." : "Access System"}
            </Button>
            
            <div className="relative w-full py-2">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border/50"></span></div>
              <div className="relative flex justify-center text-[10px] uppercase"><span className="bg-card px-2 text-muted-foreground font-semibold tracking-widest">Diagnostic Access</span></div>
            </div>

            <p className="text-[10px] text-center text-muted-foreground opacity-50 px-4">
              Hackathon Mode Enabled: Any credentials will be accepted.
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
