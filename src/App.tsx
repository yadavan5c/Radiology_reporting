import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/Layout";
import OpsCommandCenter from "./pages/OpsCommandCenter";
import ProviderPortal from "./pages/ProviderPortal";
import RadiologistManagement from "./pages/RadiologistManagement";
import NotFound from "./pages/NotFound.tsx";
import Auth from "./pages/Auth";
import ProtectedRoute from "@/components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<OpsCommandCenter />} />
              <Route path="/provider" element={<ProviderPortal />} />
              <Route path="/radiologists" element={<RadiologistManagement />} />
            </Route>
          </Route>
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
