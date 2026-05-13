import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { formatAuthError } from "@/lib/auth-errors";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) throw redirect({ to: "/pin" });
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setErrorCode(null);
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      const message = "Ingresa el correo y la contraseña para continuar.";
      setErrorMsg(message);
      setErrorCode("Campos requeridos");
      toast.error(message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
    setLoading(false);
    if (error) {
      const friendly = formatAuthError(error);
      setErrorMsg(friendly);
      setErrorCode((error as { code?: string }).code ?? `HTTP ${error.status ?? "?"}`);
      toast.error(friendly);
      return;
    }
    toast.success("Dispositivo conectado");
    navigate({ to: "/pin", replace: true });
  };

  return (
    <div className="min-h-screen grid place-items-center bg-background px-4">
      <Card className="w-full max-w-sm p-6 space-y-5">
        <div className="text-center">
          <h1 className="text-2xl font-bold">El Punto</h1>
          <p className="text-sm text-muted-foreground">Inicia sesión del dispositivo</p>
        </div>

        {errorMsg && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No se pudo iniciar sesión</AlertTitle>
            <AlertDescription className="space-y-1">
              <p>{errorMsg}</p>
              {errorCode && (
                <p className="text-xs opacity-70">
                  Código: {errorCode} · Correo: {email.trim() || "(vacío)"}
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Correo</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-12" autoComplete="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="h-12" autoComplete="current-password" />
          </div>
          <Button type="submit" disabled={loading} className="w-full h-12 text-base">
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
        <p className="text-xs text-center text-muted-foreground">
          Solo el administrador crea cuentas de dispositivo.
        </p>
      </Card>
    </div>
  );
}
