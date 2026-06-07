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
      applicants: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          interview_date: string | null
          interview_time: string | null
          notes: string | null
          phone: string | null
          status: Database["public"]["Enums"]["applicant_status"]
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          interview_date?: string | null
          interview_time?: string | null
          notes?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["applicant_status"]
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          interview_date?: string | null
          interview_time?: string | null
          notes?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["applicant_status"]
        }
        Relationships: []
      }
      payroll_entries: {
        Row: {
          activated_lines: number
          created_at: string
          directv_sales: number
          gross_commission: number
          id: string
          internet_sales: number
          pay_period_end: string | null
          pay_period_start: string | null
          raw_lines: number
          rep_name: string
        }
        Insert: {
          activated_lines?: number
          created_at?: string
          directv_sales?: number
          gross_commission?: number
          id?: string
          internet_sales?: number
          pay_period_end?: string | null
          pay_period_start?: string | null
          raw_lines?: number
          rep_name: string
        }
        Update: {
          activated_lines?: number
          created_at?: string
          directv_sales?: number
          gross_commission?: number
          id?: string
          internet_sales?: number
          pay_period_end?: string | null
          pay_period_start?: string | null
          raw_lines?: number
          rep_name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
        }
        Relationships: []
      }
      sales: {
        Row: {
          activation_status: string
          created_at: string
          customer_name: string
          id: string
          lines: number
          notes: string | null
          package_type: string
          photo_url: string | null
          rep_id: string
          sale_date: string
          sale_type: string
          spm_number: string
          status: string
        }
        Insert: {
          activation_status?: string
          created_at?: string
          customer_name: string
          id?: string
          lines?: number
          notes?: string | null
          package_type: string
          photo_url?: string | null
          rep_id: string
          sale_date?: string
          sale_type: string
          spm_number: string
          status?: string
        }
        Update: {
          activation_status?: string
          created_at?: string
          customer_name?: string
          id?: string
          lines?: number
          notes?: string | null
          package_type?: string
          photo_url?: string | null
          rep_id?: string
          sale_date?: string
          sale_type?: string
          spm_number?: string
          status?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          directv_rate: number
          id: string
          internet_rate: number
          phone_line_rate: number
        }
        Insert: {
          directv_rate?: number
          id?: string
          internet_rate?: number
          phone_line_rate?: number
        }
        Update: {
          directv_rate?: number
          id?: string
          internet_rate?: number
          phone_line_rate?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner" | "rep"
      applicant_status:
        | "Applied"
        | "Interview Scheduled"
        | "Interview Completed"
        | "Hired"
        | "Rejected"
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
      app_role: ["owner", "rep"],
      applicant_status: [
        "Applied",
        "Interview Scheduled",
        "Interview Completed",
        "Hired",
        "Rejected",
      ],
    },
  },
} as const
