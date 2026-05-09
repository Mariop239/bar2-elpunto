import type { AuthError } from "@supabase/supabase-js";

export function formatAuthError(error: AuthError | { code?: string; message?: string } | null): string {
  if (!error) return "";
  const code = (error as { code?: string }).code;
  const msg = error.message ?? "";

  switch (code) {
    case "invalid_credentials":
      return "Correo o contraseña incorrectos. Verifica e intenta de nuevo.";
    case "email_not_confirmed":
      return "Este correo no ha sido confirmado. Pide al administrador confirmarlo desde el panel.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Demasiados intentos. Espera un minuto antes de volver a intentar.";
    case "user_not_found":
      return "No existe una cuenta con ese correo en este dispositivo.";
    case "user_banned":
      return "Esta cuenta está deshabilitada. Contacta al administrador.";
    case "validation_failed":
      return "Datos inválidos. Revisa el correo y la contraseña.";
    default:
      if (/confirm/i.test(msg)) return "Correo no confirmado. Confírmalo desde el panel de administración.";
      if (/invalid/i.test(msg)) return "Correo o contraseña incorrectos.";
      return msg || "Error desconocido al iniciar sesión.";
  }
}
