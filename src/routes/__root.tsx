import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpleado } from "@/lib/empleado-store";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Página no encontrada</h2>
        <Link to="/" className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-primary-foreground">
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Ocurrió un error</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 rounded-md bg-primary px-4 py-2 text-primary-foreground"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#9b1c1c" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "El Punto" },
      { title: "El Punto · Gestión Financiera" },
      { name: "description", content: "Dashboard financiero para negocio de comida en universidad" },
      { property: "og:title", content: "El Punto · Gestión Financiera" },
      { name: "twitter:title", content: "El Punto · Gestión Financiera" },
      { property: "og:description", content: "Dashboard financiero para negocio de comida en universidad" },
      { name: "twitter:description", content: "Dashboard financiero para negocio de comida en universidad" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/04294515-601c-47c8-a4fc-02b2bb3cfe48/id-preview-99b53f78--32456ab7-4b5b-4c02-8e9c-69d46328044b.lovable.app-1778650030094.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/04294515-601c-47c8-a4fc-02b2bb3cfe48/id-preview-99b53f78--32456ab7-4b5b-4c02-8e9c-69d46328044b.lovable.app-1778650030094.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    // 1. Manejo de "Recordarme" (Limpiar sesión si no se seleccionó y es ventana nueva)
    const rememberMe = localStorage.getItem("remember_me") === "true";
    const activeSession = sessionStorage.getItem("active_session") === "true";
    
    if (!rememberMe && !activeSession) {
      supabase.auth.signOut();
    } else {
      sessionStorage.setItem("active_session", "true");
    }

    // 2. Escuchar cambios de autenticación para redirigir si la sesión expira
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        useEmpleado.getState().logout();
        router.navigate({ to: "/login", replace: true });
      }
    });

    // 3. Controlar la inactividad: recuperar sesión al volver a la pestaña (útil en tablets)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        supabase.auth.getSession();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [router]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  );
}
