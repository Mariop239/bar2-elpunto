import { createFileRoute, Outlet, redirect, Navigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { useEmpleado } from "@/lib/empleado-store";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: AppLayout,
});

function AppLayout() {
  const empleado = useEmpleado((s) => s.empleado);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const unsub = useEmpleado.persist.onFinishHydration(() => setHydrated(true));
    setHydrated(useEmpleado.persist.hasHydrated());
    return unsub;
  }, []);

  if (!hydrated) return null;
  if (!empleado) {
    return <Navigate to="/pin" replace />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
