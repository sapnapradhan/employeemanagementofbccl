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
      employee_profiles: {
        Row: {
          aadhaar: string | null
          aadhaar_back_url: string | null
          aadhaar_front_url: string | null
          aadhaar_number: string | null
          aadhaar_verified_at: string | null
          aadhaar_verified_by: string | null
          account_number: string | null
          address: string | null
          approved_at: string | null
          bank_name: string | null
          created_at: string
          deleted_at: string | null
          department: string | null
          designation: string | null
          dob: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          employee_code: string
          father_name: string | null
          id: string
          ifsc: string | null
          name: string
          pan_front_url: string | null
          pan_number: string | null
          pan_verified_at: string | null
          pan_verified_by: string | null
          phone: string | null
          photo_url: string | null
          qualification: string | null
          rejection_reason: string | null
          salary: number | null
          status: string
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          aadhaar?: string | null
          aadhaar_back_url?: string | null
          aadhaar_front_url?: string | null
          aadhaar_number?: string | null
          aadhaar_verified_at?: string | null
          aadhaar_verified_by?: string | null
          account_number?: string | null
          address?: string | null
          approved_at?: string | null
          bank_name?: string | null
          created_at?: string
          deleted_at?: string | null
          department?: string | null
          designation?: string | null
          dob?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_code: string
          father_name?: string | null
          id?: string
          ifsc?: string | null
          name: string
          pan_front_url?: string | null
          pan_number?: string | null
          pan_verified_at?: string | null
          pan_verified_by?: string | null
          phone?: string | null
          photo_url?: string | null
          qualification?: string | null
          rejection_reason?: string | null
          salary?: number | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          aadhaar?: string | null
          aadhaar_back_url?: string | null
          aadhaar_front_url?: string | null
          aadhaar_number?: string | null
          aadhaar_verified_at?: string | null
          aadhaar_verified_by?: string | null
          account_number?: string | null
          address?: string | null
          approved_at?: string | null
          bank_name?: string | null
          created_at?: string
          deleted_at?: string | null
          department?: string | null
          designation?: string | null
          dob?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_code?: string
          father_name?: string | null
          id?: string
          ifsc?: string | null
          name?: string
          pan_front_url?: string | null
          pan_number?: string | null
          pan_verified_at?: string | null
          pan_verified_by?: string | null
          phone?: string | null
          photo_url?: string | null
          qualification?: string | null
          rejection_reason?: string | null
          salary?: number | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      form16_documents: {
        Row: {
          created_at: string
          deductions: Json | null
          employee_profile_id: string
          file_path: string | null
          financial_year: string
          gross_salary: number | null
          id: string
          notes: string | null
          source: string
          tds: number | null
          updated_at: string
          uploaded_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          deductions?: Json | null
          employee_profile_id: string
          file_path?: string | null
          financial_year: string
          gross_salary?: number | null
          id?: string
          notes?: string | null
          source: string
          tds?: number | null
          updated_at?: string
          uploaded_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          deductions?: Json | null
          employee_profile_id?: string
          file_path?: string | null
          financial_year?: string
          gross_salary?: number | null
          id?: string
          notes?: string | null
          source?: string
          tds?: number | null
          updated_at?: string
          uploaded_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "form16_documents_employee_profile_id_fkey"
            columns: ["employee_profile_id"]
            isOneToOne: false
            referencedRelation: "employee_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form16_documents_employee_profile_id_fkey"
            columns: ["employee_profile_id"]
            isOneToOne: false
            referencedRelation: "employee_self_view"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          read_at: string | null
          related_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          related_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          related_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profile_change_requests: {
        Row: {
          changes: Json
          created_at: string
          file_moves: Json
          id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          changes?: Json
          created_at?: string
          file_moves?: Json
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          changes?: Json
          created_at?: string
          file_moves?: Json
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      employee_self_view: {
        Row: {
          aadhaar_back_url: string | null
          aadhaar_front_url: string | null
          aadhaar_masked: string | null
          aadhaar_verified_at: string | null
          account_number_masked: string | null
          address: string | null
          approved_at: string | null
          bank_name: string | null
          created_at: string | null
          department: string | null
          designation: string | null
          dob: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          employee_code: string | null
          father_name: string | null
          id: string | null
          ifsc: string | null
          name: string | null
          pan_front_url: string | null
          pan_masked: string | null
          pan_verified_at: string | null
          phone: string | null
          photo_url: string | null
          qualification: string | null
          rejection_reason: string | null
          salary: number | null
          status: string | null
          submitted_at: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          aadhaar_back_url?: string | null
          aadhaar_front_url?: string | null
          aadhaar_masked?: never
          aadhaar_verified_at?: string | null
          account_number_masked?: never
          address?: string | null
          approved_at?: string | null
          bank_name?: string | null
          created_at?: string | null
          department?: string | null
          designation?: string | null
          dob?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_code?: string | null
          father_name?: string | null
          id?: string | null
          ifsc?: string | null
          name?: string | null
          pan_front_url?: string | null
          pan_masked?: never
          pan_verified_at?: string | null
          phone?: string | null
          photo_url?: string | null
          qualification?: string | null
          rejection_reason?: string | null
          salary?: number | null
          status?: string | null
          submitted_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          aadhaar_back_url?: string | null
          aadhaar_front_url?: string | null
          aadhaar_masked?: never
          aadhaar_verified_at?: string | null
          account_number_masked?: never
          address?: string | null
          approved_at?: string | null
          bank_name?: string | null
          created_at?: string | null
          department?: string | null
          designation?: string | null
          dob?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_code?: string | null
          father_name?: string | null
          id?: string | null
          ifsc?: string | null
          name?: string | null
          pan_front_url?: string | null
          pan_masked?: never
          pan_verified_at?: string | null
          phone?: string | null
          photo_url?: string | null
          qualification?: string | null
          rejection_reason?: string | null
          salary?: number | null
          status?: string | null
          submitted_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_exists: { Args: never; Returns: boolean }
      approve_change_request: { Args: { _req_id: string }; Returns: undefined }
      bulk_form16_lookup: {
        Args: { _pan: string }
        Returns: {
          employee_name: string
          employee_profile_id: string
          match_status: string
          user_id: string
        }[]
      }
      bulk_form16_lookup_code: {
        Args: { _code: string }
        Returns: {
          employee_name: string
          employee_profile_id: string
          match_status: string
          pan_number: string
          user_id: string
        }[]
      }
      bulk_form16_upload_finalize: {
        Args: {
          _file_path: string
          _financial_year: string
          _notes?: string
          _pan: string
        }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      notify_user: {
        Args: {
          _body: string
          _related_id?: string
          _title: string
          _type: string
          _user_id: string
        }
        Returns: undefined
      }
      reject_change_request: {
        Args: { _reason: string; _req_id: string }
        Returns: undefined
      }
      verify_aadhaar: { Args: { _user_id: string }; Returns: undefined }
      verify_pan: { Args: { _user_id: string }; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
