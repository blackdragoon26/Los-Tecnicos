import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WalletProvider } from "@/contexts/WalletContext";
import Navbar from "@/components/Navbar";
import EnergyBackground from "@/components/EnergyBackground";
import ProtectedRoute from "@/components/ProtectedRoute";
import Landing from "@/pages/Landing";
// RoleSelect is now inline in Dashboard
import Dashboard from "@/pages/Dashboard";
import Marketplace from "@/pages/Marketplace";
import Analytics from "@/pages/Analytics";
import NetworkPage from "@/pages/Network";
import FormulaPlayground from "@/pages/Formula";
import Products from "@/pages/Products";
import Onboarding from "@/pages/Onboarding";
import DebugTransfer from "@/pages/DebugTransfer";
import About from "@/pages/About";
import NotFound from "@/pages/NotFound";
import RegisterDevice from "@/pages/RegisterDevice";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <WalletProvider>
        <BrowserRouter>
          <EnergyBackground />
          <Navbar />
          <Toaster />
          <Sonner />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/about" element={<About />} />
            <Route path="/products" element={<Products />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/formula" element={<FormulaPlayground />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/network" element={<NetworkPage />} />
            <Route path="/debug" element={<DebugTransfer />} />
            {/* role-select merged into /dashboard */}
            <Route
              path="/dashboard"
              element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
            />
            <Route
              path="/marketplace"
              element={<ProtectedRoute><Marketplace /></ProtectedRoute>}
            />
            <Route
              path="/device/register"
              element={<ProtectedRoute><RegisterDevice /></ProtectedRoute>}
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </WalletProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
