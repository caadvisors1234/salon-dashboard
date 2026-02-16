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
      batch_logs: {
        Row: {
          completed_at: string | null
          error_message: string | null
          executed_at: string
          id: string
          job_type: string
          metadata: Json | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          executed_at?: string
          id?: string
          job_type: string
          metadata?: Json | null
          status: string
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          executed_at?: string
          id?: string
          job_type?: string
          metadata?: Json | null
          status?: string
        }
        Relationships: []
      }
      daily_metrics: {
        Row: {
          created_at: string
          date: string
          id: string
          location_id: string
          metric_type: string
          value: number
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          location_id: string
          metric_type: string
          value: number
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          location_id?: string
          metric_type?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_metrics_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      gbp_accounts: {
        Row: {
          account_name: string | null
          created_at: string
          gbp_account_id: string
          google_oauth_token_id: string
          id: string
        }
        Insert: {
          account_name?: string | null
          created_at?: string
          gbp_account_id: string
          google_oauth_token_id: string
          id?: string
        }
        Update: {
          account_name?: string | null
          created_at?: string
          gbp_account_id?: string
          google_oauth_token_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gbp_accounts_google_oauth_token_id_fkey"
            columns: ["google_oauth_token_id"]
            isOneToOne: false
            referencedRelation: "google_oauth_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      google_oauth_tokens: {
        Row: {
          access_token_encrypted: string
          created_at: string
          google_email: string
          id: string
          is_valid: boolean
          refresh_token_encrypted: string
          scopes: string
          token_expiry: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_encrypted: string
          created_at?: string
          google_email: string
          id?: string
          is_valid?: boolean
          refresh_token_encrypted: string
          scopes: string
          token_expiry: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_encrypted?: string
          created_at?: string
          google_email?: string
          id?: string
          is_valid?: boolean
          refresh_token_encrypted?: string
          scopes?: string
          token_expiry?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_oauth_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      hpb_monthly_metrics: {
        Row: {
          acr: number | null
          acr_area_avg: number | null
          blog_pv: number | null
          blog_pv_area_avg: number | null
          booking_count: number | null
          booking_count_area_avg: number | null
          booking_revenue: number | null
          booking_revenue_area_avg: number | null
          coupon_menu_pv: number | null
          coupon_menu_pv_area_avg: number | null
          created_at: string
          cvr: number | null
          cvr_area_avg: number | null
          id: string
          location_id: string
          salon_pv: number | null
          salon_pv_area_avg: number | null
          style_pv: number | null
          style_pv_area_avg: number | null
          total_pv: number | null
          total_pv_area_avg: number | null
          updated_at: string
          year_month: string
        }
        Insert: {
          acr?: number | null
          acr_area_avg?: number | null
          blog_pv?: number | null
          blog_pv_area_avg?: number | null
          booking_count?: number | null
          booking_count_area_avg?: number | null
          booking_revenue?: number | null
          booking_revenue_area_avg?: number | null
          coupon_menu_pv?: number | null
          coupon_menu_pv_area_avg?: number | null
          created_at?: string
          cvr?: number | null
          cvr_area_avg?: number | null
          id?: string
          location_id: string
          salon_pv?: number | null
          salon_pv_area_avg?: number | null
          style_pv?: number | null
          style_pv_area_avg?: number | null
          total_pv?: number | null
          total_pv_area_avg?: number | null
          updated_at?: string
          year_month: string
        }
        Update: {
          acr?: number | null
          acr_area_avg?: number | null
          blog_pv?: number | null
          blog_pv_area_avg?: number | null
          booking_count?: number | null
          booking_count_area_avg?: number | null
          booking_revenue?: number | null
          booking_revenue_area_avg?: number | null
          coupon_menu_pv?: number | null
          coupon_menu_pv_area_avg?: number | null
          created_at?: string
          cvr?: number | null
          cvr_area_avg?: number | null
          id?: string
          location_id?: string
          salon_pv?: number | null
          salon_pv_area_avg?: number | null
          style_pv?: number | null
          style_pv_area_avg?: number | null
          total_pv?: number | null
          total_pv_area_avg?: number | null
          updated_at?: string
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "hpb_monthly_metrics_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      hpb_upload_logs: {
        Row: {
          error_message: string | null
          file_name: string
          file_path: string | null
          id: string
          location_id: string
          record_count: number | null
          status: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          error_message?: string | null
          file_name: string
          file_path?: string | null
          id?: string
          location_id: string
          record_count?: number | null
          status: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          error_message?: string | null
          file_name?: string
          file_path?: string | null
          id?: string
          location_id?: string
          record_count?: number | null
          status?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "hpb_upload_logs_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hpb_upload_logs_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          created_at: string
          gbp_location_id: string | null
          id: string
          is_active: boolean
          name: string
          org_id: string
          place_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          gbp_location_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          place_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          gbp_location_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          place_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_keywords: {
        Row: {
          created_at: string
          id: string
          insights_threshold: number | null
          insights_value: number | null
          insights_value_type: string
          keyword: string
          location_id: string
          year_month: string
        }
        Insert: {
          created_at?: string
          id?: string
          insights_threshold?: number | null
          insights_value?: number | null
          insights_value_type: string
          keyword: string
          location_id: string
          year_month: string
        }
        Update: {
          created_at?: string
          id?: string
          insights_threshold?: number | null
          insights_value?: number | null
          insights_value_type?: string
          keyword?: string
          location_id?: string
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_keywords_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      rating_snapshots: {
        Row: {
          created_at: string
          date: string
          id: string
          location_id: string
          rating: number | null
          review_count: number | null
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          location_id: string
          rating?: number | null
          review_count?: number | null
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          location_id?: string
          rating?: number | null
          review_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rating_snapshots_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_org_assignments: {
        Row: {
          created_at: string
          id: string
          org_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_org_assignments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_org_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          id: string
          org_id: string | null
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          id: string
          org_id?: string | null
          role: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          org_id?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_accessible_org_ids: { Args: never; Returns: string[] }
      get_user_role: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
