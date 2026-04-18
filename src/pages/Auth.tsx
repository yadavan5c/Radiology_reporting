import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // If it's a simple username, convert to a virtual email
      const finalEmail = email.includes("@") ? email : `${email.toLowerCase().replace(/\s+/g, "")}@radflow.ai`;
      
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({ email: finalEmail, password });
        if (error) throw error;
        
        if (data.session) {
          toast.success("Account created! Redirecting...");
          setTimeout(() => navigate("/"), 1000);
        } else {
          const { error: signInErr } = await supabase.auth.signInWithPassword({ email: finalEmail, password });
          if (!signInErr) {
            navigate("/");
          } else {
            toast.success("Account created. Please try signing in now.");
          }
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: finalEmail, password });
        if (error) throw error;
        toast.success("Logged in successfully!");
        navigate("/");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = () => {
    setEmail("admin");
    setPassword("password123");
    toast.info("Demo credentials loaded. Click Access System.");
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
            {isSignUp ? "Create your diagnostic account" : "Sign in to the intelligence command center"}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleAuth}>
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
              {loading ? "Processing..." : isSignUp ? "Create Account" : "Access System"}
            </Button>
            
            <div className="relative w-full py-2">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border/50"></span></div>
              <div className="relative flex justify-center text-[10px] uppercase"><span className="bg-card px-2 text-muted-foreground font-semibold tracking-widest">Diagnostic Access</span></div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full h-11 border-primary/20 hover:bg-primary/5 text-primary font-medium"
              onClick={handleGuestLogin}
              disabled={loading}
            >
              🚀 Load Demo Credentials
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setIsSignUp(!isSignUp)}
            >
              {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
