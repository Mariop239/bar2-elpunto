import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { useEmpleado } from "@/lib/empleado-store";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: AppLayout,
});

function AppLayout() {
  const empleado = useEmpleado((s) => s.empleado);
  // Hydration guard for persisted store
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);

  if (!hydrated) return null;
  if (!empleado) {
    if (typeof window !== "undefined") window.location.href = "/pin";
    return null;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
