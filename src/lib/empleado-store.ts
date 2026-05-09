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
};

export const useEmpleado = create<State>()(
  persist(
    (set) => ({
      empleado: null,
      setEmpleado: (empleado) => set({ empleado }),
      logout: () => set({ empleado: null }),
    }),
    { name: "empleado-activo" }
  )
);
