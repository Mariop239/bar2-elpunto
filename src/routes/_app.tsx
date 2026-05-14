import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { useEmpleado } from "@/lib/empleado-store";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AuthSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

function AppLayout() {
  const empleado = useEmpleado((s) => s.empleado);
  const [hydrated, setHydrated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  // 1. Hidratar el store de empleado desde localStorage
  useEffect(() => {
    const unsub = useEmpleado.persist.onFinishHydration(() => setHydrated(true));
    setHydrated(useEmpleado.persist.hasHydrated());
    return unsub;
  }, []);

  // 2. Verificar la sesión de Supabase explícitamente desde localStorage
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setHasSession(!!data.session);
      setIsCheckingAuth(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setHasSession(!!session);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (hydrated) {
      useEmpleado.getState().checkExpiration();
      const interval = setInterval(() => {
        useEmpleado.getState().checkExpiration();
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [hydrated]);

  // Mientras se verifica la auth o se hidrata el store, mostrar spinner. NUNCA redirigir.
  if (isCheckingAuth || !hydrated) return <AuthSpinner />;

  if (!hasSession) return <Navigate to="/login" replace />;
  if (!empleado) return <Navigate to="/pin" replace />;

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
