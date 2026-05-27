export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      abonos: {
        Row: {
          cliente_id: string
          created_at: string
          empleado_id: string | null
          id: string
          metodo_pago: Database["public"]["Enums"]["metodo_pago"]
          monto: number
          transaccion_id: string | null
        }
        Insert: {
          cliente_id: string
          created_at?: string
          empleado_id?: string | null
          id?: string
          metodo_pago: Database["public"]["Enums"]["metodo_pago"]
          monto: number
          transaccion_id?: string | null
        }
        Update: {
          cliente_id?: string
          created_at?: string
          empleado_id?: string | null
          id?: string
          metodo_pago?: Database["public"]["Enums"]["metodo_pago"]
          monto?: number
          transaccion_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "abonos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abonos_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abonos_transaccion_id_fkey"
            columns: ["transaccion_id"]
            isOneToOne: false
            referencedRelation: "transacciones"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias: {
        Row: {
          color: string
          created_at: string
          id: string
          nombre: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          nombre: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          created_at: string
          id: string
          nombre: string
          saldo_total: number
          telefono: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          nombre: string
          saldo_total?: number
          telefono?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          nombre?: string
          saldo_total?: number
          telefono?: string | null
        }
        Relationships: []
      }
      deudas: {
        Row: {
          cantidad: number
          cliente_id: string
          created_at: string
          empleado_id: string | null
          estado: Database["public"]["Enums"]["estado_deuda"]
          id: string
          monto: number
          pagado_at: string | null
          precio_unitario: number
          producto_id: string | null
          producto_nombre: string
          registrado_por: string | null
        }
        Insert: {
          cantidad?: number
          cliente_id: string
          created_at?: string
          empleado_id?: string | null
          estado?: Database["public"]["Enums"]["estado_deuda"]
          id?: string
          monto: number
          pagado_at?: string | null
          precio_unitario: number
          producto_id?: string | null
          producto_nombre: string
          registrado_por?: string | null
        }
        Update: {
          cantidad?: number
          cliente_id?: string
          created_at?: string
          empleado_id?: string | null
          estado?: Database["public"]["Enums"]["estado_deuda"]
          id?: string
          monto?: number
          pagado_at?: string | null
          precio_unitario?: number
          producto_id?: string | null
          producto_nombre?: string
          registrado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deudas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deudas_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deudas_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      empleados: {
        Row: {
          activo: boolean
          created_at: string
          id: string
          nombre: string
          pin_hash: string
          rol: Database["public"]["Enums"]["rol_empleado"]
        }
        Insert: {
          activo?: boolean
          created_at?: string
          id?: string
          nombre: string
          pin_hash: string
          rol?: Database["public"]["Enums"]["rol_empleado"]
        }
        Update: {
          activo?: boolean
          created_at?: string
          id?: string
          nombre?: string
          pin_hash?: string
          rol?: Database["public"]["Enums"]["rol_empleado"]
        }
        Relationships: []
      }
      historial_cajas: {
        Row: {
          bancos: number
          billetes: number
          caja_inicial: number
          created_at: string
          empleado_id: string | null
          fecha: string
          id: string
          monedas: Json
          total_arqueo: number
          total_egresos: number
          venta_real: number
        }
        Insert: {
          bancos?: number
          billetes?: number
          caja_inicial?: number
          created_at?: string
          empleado_id?: string | null
          fecha: string
          id?: string
          monedas?: Json
          total_arqueo?: number
          total_egresos?: number
          venta_real?: number
        }
        Update: {
          bancos?: number
          billetes?: number
          caja_inicial?: number
          created_at?: string
          empleado_id?: string | null
          fecha?: string
          id?: string
          monedas?: Json
          total_arqueo?: number
          total_egresos?: number
          venta_real?: number
        }
        Relationships: []
      }
      productos: {
        Row: {
          activo: boolean
          categoria_id: string | null
          created_at: string
          id: string
          nombre: string
          precio: number
        }
        Insert: {
          activo?: boolean
          categoria_id?: string | null
          created_at?: string
          id?: string
          nombre: string
          precio: number
        }
        Update: {
          activo?: boolean
          categoria_id?: string | null
          created_at?: string
          id?: string
          nombre?: string
          precio?: number
        }
        Relationships: [
          {
            foreignKeyName: "productos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      transacciones: {
        Row: {
          abono_id: string | null
          created_at: string
          descripcion: string | null
          empleado_id: string | null
          id: string
          metodo_pago: Database["public"]["Enums"]["metodo_pago"] | null
          monto: number
          origen: string
          registrado_por: string | null
          tipo: Database["public"]["Enums"]["tipo_transaccion"]
        }
        Insert: {
          abono_id?: string | null
          created_at?: string
          descripcion?: string | null
          empleado_id?: string | null
          id?: string
          metodo_pago?: Database["public"]["Enums"]["metodo_pago"] | null
          monto: number
          origen?: string
          registrado_por?: string | null
          tipo: Database["public"]["Enums"]["tipo_transaccion"]
        }
        Update: {
          abono_id?: string | null
          created_at?: string
          descripcion?: string | null
          empleado_id?: string | null
          id?: string
          metodo_pago?: Database["public"]["Enums"]["metodo_pago"] | null
          monto?: number
          origen?: string
          registrado_por?: string | null
          tipo?: Database["public"]["Enums"]["tipo_transaccion"]
        }
        Relationships: [
          {
            foreignKeyName: "transacciones_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      aplicar_abono: {
        Args: {
          p_cliente: string
          p_empleado: string
          p_metodo: Database["public"]["Enums"]["metodo_pago"]
          p_monto: number
        }
        Returns: string
      }
      recalcular_egresos_caja: { Args: { p_fecha: string }; Returns: undefined }
      recalcular_saldo_cliente: {
        Args: { p_cliente: string }
        Returns: undefined
      }
    }
    Enums: {
      estado_deuda: "pendiente" | "pagado"
      metodo_pago: "efectivo" | "transferencia"
      rol_empleado: "admin" | "empleado"
      tipo_transaccion: "ingreso" | "gasto" | "costo" | "fondo_caja"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      estado_deuda: ["pendiente", "pagado"],
      metodo_pago: ["efectivo", "transferencia"],
      rol_empleado: ["admin", "empleado"],
      tipo_transaccion: ["ingreso", "gasto", "costo", "fondo_caja"],
    },
  },
} as const
