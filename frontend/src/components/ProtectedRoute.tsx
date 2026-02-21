import { Navigate } from "react-router-dom";
import { useWallet } from "@/contexts/WalletContext";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isConnected } = useWallet();
  if (!isConnected) return <Navigate to="/" replace />;
  return <>{children}</>;
}
