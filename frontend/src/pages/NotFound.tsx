import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const location = useLocation();

  useEffect(() => {
    console.error("404:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <p className="text-6xl font-bold font-mono text-primary mb-2">404</p>
        <p className="text-sm text-muted-foreground mb-6">Page not found</p>
        <a href="/">
          <Button variant="outline" size="sm" className="text-xs">Back to Home</Button>
        </a>
      </div>
    </div>
  );
}
