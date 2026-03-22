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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      empresas: {
        Row: {
          configuracion: Json | null
          created_at: string
          id: string
          logo_url: string | null
          nit: string | null
          nombre: string
          updated_at: string
        }
        Insert: {
          configuracion?: Json | null
          created_at?: string
          id?: string
          logo_url?: string | null
          nit?: string | null
          nombre: string
          updated_at?: string
        }
        Update: {
          configuracion?: Json | null
          created_at?: string
          id?: string
          logo_url?: string | null
          nit?: string | null
          nombre?: string
          updated_at?: string
        }
        Relationships: []
      }
      examenes_clinicos: {
        Row: {
          created_at: string
          fecha_examen: string
          id: string
          observaciones: Json | null
          optometrista_id: string
          paciente_id: string
          ra_od_adicion: number | null
          ra_od_cilindro: number | null
          ra_od_eje: number | null
          ra_od_esfera: number | null
          ra_oi_adicion: number | null
          ra_oi_cilindro: number | null
          ra_oi_eje: number | null
          ra_oi_esfera: number | null
          rf_od_adicion: number | null
          rf_od_cilindro: number | null
          rf_od_eje: number | null
          rf_od_esfera: number | null
          rf_oi_adicion: number | null
          rf_oi_cilindro: number | null
          rf_oi_eje: number | null
          rf_oi_esfera: number | null
          sucursal_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          fecha_examen?: string
          id?: string
          observaciones?: Json | null
          optometrista_id: string
          paciente_id: string
          ra_od_adicion?: number | null
          ra_od_cilindro?: number | null
          ra_od_eje?: number | null
          ra_od_esfera?: number | null
          ra_oi_adicion?: number | null
          ra_oi_cilindro?: number | null
          ra_oi_eje?: number | null
          ra_oi_esfera?: number | null
          rf_od_adicion?: number | null
          rf_od_cilindro?: number | null
          rf_od_eje?: number | null
          rf_od_esfera?: number | null
          rf_oi_adicion?: number | null
          rf_oi_cilindro?: number | null
          rf_oi_eje?: number | null
          rf_oi_esfera?: number | null
          sucursal_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          fecha_examen?: string
          id?: string
          observaciones?: Json | null
          optometrista_id?: string
          paciente_id?: string
          ra_od_adicion?: number | null
          ra_od_cilindro?: number | null
          ra_od_eje?: number | null
          ra_od_esfera?: number | null
          ra_oi_adicion?: number | null
          ra_oi_cilindro?: number | null
          ra_oi_eje?: number | null
          ra_oi_esfera?: number | null
          rf_od_adicion?: number | null
          rf_od_cilindro?: number | null
          rf_od_eje?: number | null
          rf_od_esfera?: number | null
          rf_oi_adicion?: number | null
          rf_oi_cilindro?: number | null
          rf_oi_eje?: number | null
          rf_oi_esfera?: number | null
          sucursal_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "examenes_clinicos_optometrista_id_fkey"
            columns: ["optometrista_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "examenes_clinicos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "examenes_clinicos_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "examenes_clinicos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      inventario_aros: {
        Row: {
          activo: boolean
          color: string | null
          created_at: string
          id: string
          marca: string
          modelo: string | null
          precio: number
          stock: number
          sucursal_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          color?: string | null
          created_at?: string
          id?: string
          marca: string
          modelo?: string | null
          precio?: number
          stock?: number
          sucursal_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          color?: string | null
          created_at?: string
          id?: string
          marca?: string
          modelo?: string | null
          precio?: number
          stock?: number
          sucursal_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventario_aros_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventario_aros_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      inventario_lentes: {
        Row: {
          activo: boolean
          created_at: string
          id: string
          material: string | null
          precio: number
          stock: number
          sucursal_id: string
          tenant_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          id?: string
          material?: string | null
          precio?: number
          stock?: number
          sucursal_id: string
          tenant_id: string
          tipo: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          id?: string
          material?: string | null
          precio?: number
          stock?: number
          sucursal_id?: string
          tenant_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventario_lentes_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventario_lentes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      laboratorio_estados: {
        Row: {
          created_at: string
          estado: Database["public"]["Enums"]["lab_estado"]
          id: string
          laboratorio_externo: string | null
          notas: string | null
          orden_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          estado?: Database["public"]["Enums"]["lab_estado"]
          id?: string
          laboratorio_externo?: string | null
          notas?: string | null
          orden_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          estado?: Database["public"]["Enums"]["lab_estado"]
          id?: string
          laboratorio_externo?: string | null
          notas?: string | null
          orden_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "laboratorio_estados_orden_id_fkey"
            columns: ["orden_id"]
            isOneToOne: false
            referencedRelation: "ordenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laboratorio_estados_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      orden_detalle: {
        Row: {
          cantidad: number
          created_at: string
          descripcion: string | null
          id: string
          orden_id: string
          precio_unitario: number
          producto_id: string | null
          subtotal: number
          tipo_producto: Database["public"]["Enums"]["tipo_producto"]
        }
        Insert: {
          cantidad?: number
          created_at?: string
          descripcion?: string | null
          id?: string
          orden_id: string
          precio_unitario?: number
          producto_id?: string | null
          subtotal?: number
          tipo_producto: Database["public"]["Enums"]["tipo_producto"]
        }
        Update: {
          cantidad?: number
          created_at?: string
          descripcion?: string | null
          id?: string
          orden_id?: string
          precio_unitario?: number
          producto_id?: string | null
          subtotal?: number
          tipo_producto?: Database["public"]["Enums"]["tipo_producto"]
        }
        Relationships: [
          {
            foreignKeyName: "orden_detalle_orden_id_fkey"
            columns: ["orden_id"]
            isOneToOne: false
            referencedRelation: "ordenes"
            referencedColumns: ["id"]
          },
        ]
      }
      ordenes: {
        Row: {
          asesor_id: string
          created_at: string
          descuento: number
          estado: Database["public"]["Enums"]["orden_estado"]
          examen_id: string | null
          id: string
          idempotency_key: string
          notas: string | null
          paciente_id: string
          subtotal: number
          sucursal_id: string
          tenant_id: string
          tipo: Database["public"]["Enums"]["orden_tipo"]
          total: number
          updated_at: string
        }
        Insert: {
          asesor_id: string
          created_at?: string
          descuento?: number
          estado?: Database["public"]["Enums"]["orden_estado"]
          examen_id?: string | null
          id?: string
          idempotency_key: string
          notas?: string | null
          paciente_id: string
          subtotal?: number
          sucursal_id: string
          tenant_id: string
          tipo?: Database["public"]["Enums"]["orden_tipo"]
          total?: number
          updated_at?: string
        }
        Update: {
          asesor_id?: string
          created_at?: string
          descuento?: number
          estado?: Database["public"]["Enums"]["orden_estado"]
          examen_id?: string | null
          id?: string
          idempotency_key?: string
          notas?: string | null
          paciente_id?: string
          subtotal?: number
          sucursal_id?: string
          tenant_id?: string
          tipo?: Database["public"]["Enums"]["orden_tipo"]
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ordenes_asesor_id_fkey"
            columns: ["asesor_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordenes_examen_id_fkey"
            columns: ["examen_id"]
            isOneToOne: false
            referencedRelation: "examenes_clinicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordenes_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordenes_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordenes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      pacientes: {
        Row: {
          acepta_marketing: boolean
          created_at: string
          email: string | null
          etiquetas_medicas: Json | null
          fecha_nacimiento: string | null
          id: string
          nombre: string
          profesion: string | null
          sucursal_id: string
          telefono: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          acepta_marketing?: boolean
          created_at?: string
          email?: string | null
          etiquetas_medicas?: Json | null
          fecha_nacimiento?: string | null
          id?: string
          nombre: string
          profesion?: string | null
          sucursal_id: string
          telefono?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          acepta_marketing?: boolean
          created_at?: string
          email?: string | null
          etiquetas_medicas?: Json | null
          fecha_nacimiento?: string | null
          id?: string
          nombre?: string
          profesion?: string | null
          sucursal_id?: string
          telefono?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pacientes_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pacientes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      sucursales: {
        Row: {
          activa: boolean
          created_at: string
          direccion: string | null
          id: string
          nombre: string
          telefono: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          activa?: boolean
          created_at?: string
          direccion?: string | null
          id?: string
          nombre: string
          telefono?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          activa?: boolean
          created_at?: string
          direccion?: string | null
          id?: string
          nombre?: string
          telefono?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sucursales_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      tratamientos: {
        Row: {
          activo: boolean
          created_at: string
          descripcion: string | null
          id: string
          nombre: string
          precio: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre: string
          precio?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre?: string
          precio?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tratamientos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios: {
        Row: {
          activo: boolean
          created_at: string
          email: string
          id: string
          nombre: string
          rol: Database["public"]["Enums"]["user_role"]
          sucursal_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          email: string
          id: string
          nombre: string
          rol?: Database["public"]["Enums"]["user_role"]
          sucursal_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          email?: string
          id?: string
          nombre?: string
          rol?: Database["public"]["Enums"]["user_role"]
          sucursal_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          attempts: number
          created_at: string
          event_type: string
          id: string
          last_error: string | null
          payload: Json
          processed_at: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          event_type: string
          id?: string
          last_error?: string | null
          payload?: Json
          processed_at?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          event_type?: string
          id?: string
          last_error?: string | null
          payload?: Json
          processed_at?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      lab_estado: "pendiente" | "en_laboratorio" | "recibido" | "entregado"
      orden_estado: "borrador" | "confirmada" | "facturada" | "cancelada"
      orden_tipo: "proforma" | "orden_trabajo"
      tipo_producto: "aro" | "lente" | "tratamiento"
      user_role:
        | "administrador"
        | "optometrista"
        | "asesor_visual"
        | "laboratorio"
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
      lab_estado: ["pendiente", "en_laboratorio", "recibido", "entregado"],
      orden_estado: ["borrador", "confirmada", "facturada", "cancelada"],
      orden_tipo: ["proforma", "orden_trabajo"],
      tipo_producto: ["aro", "lente", "tratamiento"],
      user_role: [
        "administrador",
        "optometrista",
        "asesor_visual",
        "laboratorio",
      ],
    },
  },
} as const
