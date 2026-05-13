import { create } from "zustand";
import { persist } from "zustand/middleware";

export type EmpleadoActivo = {
  id: string;
  nombre: string;
  rol: "admin" | "empleado";
  loggedAt: number;
};

type State = {
  empleado: EmpleadoActivo | null;
  setEmpleado: (e: EmpleadoActivo | null) => void;
  logout: () => void;
  checkExpiration: () => void;
};

const EXPIRATION_TIME_MS = 24 * 60 * 60 * 1000; // 24 horas continuas

export const useEmpleado = create<State>()(
  persist(
    (set, get) => ({
      empleado: null,
      setEmpleado: (empleado) => set({ empleado }),
      logout: () => set({ empleado: null }),
      checkExpiration: () => {
        const emp = get().empleado;
        if (emp) {
          if (Date.now() - emp.loggedAt > EXPIRATION_TIME_MS) {
            set({ empleado: null });
          }
        }
      }
    }),
    { name: "empleado-activo" }
  )
);
