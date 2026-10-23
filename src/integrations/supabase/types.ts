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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin_emails: {
        Row: {
          created_at: string
          email: string
        }
        Insert: {
          created_at?: string
          email: string
        }
        Update: {
          created_at?: string
          email?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          id: string
          metadata: Json
          resource_id: string | null
          resource_type: string | null
          user_id: string
        }
        Insert: {
          action: string
          actor_user_id: string
          created_at?: string
          id?: string
          metadata?: Json
          resource_id?: string | null
          resource_type?: string | null
          user_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          resource_id?: string | null
          resource_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      caregiver_permissions: {
        Row: {
          caregiver_user_id: string
          created_at: string
          id: string
          owner_user_id: string
          revoked_at: string | null
          scope: string
          status: string
        }
        Insert: {
          caregiver_user_id: string
          created_at?: string
          id?: string
          owner_user_id: string
          revoked_at?: string | null
          scope: string
          status?: string
        }
        Update: {
          caregiver_user_id?: string
          created_at?: string
          id?: string
          owner_user_id?: string
          revoked_at?: string | null
          scope?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "caregiver_permissions_caregiver_user_id_fkey"
            columns: ["caregiver_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caregiver_permissions_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dose_events: {
        Row: {
          created_at: string
          id: string
          medication_id: string
          schedule_id: string
          scheduled_at: string
          scheduled_date: string
          scheduled_time: string
          skipped_at: string | null
          status: string
          taken_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          medication_id: string
          schedule_id: string
          scheduled_at: string
          scheduled_date: string
          scheduled_time: string
          skipped_at?: string | null
          status?: string
          taken_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          medication_id?: string
          schedule_id?: string
          scheduled_at?: string
          scheduled_date?: string
          scheduled_time?: string
          skipped_at?: string | null
          status?: string
          taken_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dose_events_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dose_events_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "medication_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dose_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_schedules: {
        Row: {
          active: boolean
          created_at: string
          dose_amount: string
          doses_per_day: number
          duration_days: number | null
          end_date: string | null
          frequency: string
          id: string
          medication_id: string
          start_date: string
          time_of_day: string[]
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          dose_amount?: string
          doses_per_day?: number
          duration_days?: number | null
          end_date?: string | null
          frequency?: string
          id?: string
          medication_id: string
          start_date?: string
          time_of_day?: string[]
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          dose_amount?: string
          doses_per_day?: number
          duration_days?: number | null
          end_date?: string | null
          frequency?: string
          id?: string
          medication_id?: string
          start_date?: string
          time_of_day?: string[]
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medication_schedules_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: true
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_schedules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          created_at: string
          dosage: string
          end_date: string | null
          form: string
          id: string
          instructions: string
          name: string
          prescription_item_id: string | null
          route: string
          source: string
          start_date: string
          status: string
          strength: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dosage?: string
          end_date?: string | null
          form?: string
          id?: string
          instructions?: string
          name: string
          prescription_item_id?: string | null
          route?: string
          source?: string
          start_date?: string
          status?: string
          strength?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dosage?: string
          end_date?: string | null
          form?: string
          id?: string
          instructions?: string
          name?: string
          prescription_item_id?: string | null
          route?: string
          source?: string
          start_date?: string
          status?: string
          strength?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medications_prescription_item_id_fkey"
            columns: ["prescription_item_id"]
            isOneToOne: false
            referencedRelation: "prescription_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          discreet_mode: boolean
          email_enabled: boolean
          escalate: boolean
          id: string
          missed_window: number
          push_enabled: boolean
          quiet_end: string
          quiet_start: string
          refill_days: number
          snooze_minutes: number
          sound: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          discreet_mode?: boolean
          email_enabled?: boolean
          escalate?: boolean
          id?: string
          missed_window?: number
          push_enabled?: boolean
          quiet_end?: string
          quiet_start?: string
          refill_days?: number
          snooze_minutes?: number
          sound?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          discreet_mode?: boolean
          email_enabled?: boolean
          escalate?: boolean
          id?: string
          missed_window?: number
          push_enabled?: boolean
          quiet_end?: string
          quiet_start?: string
          refill_days?: number
          snooze_minutes?: number
          sound?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          medication_id: string | null
          order_id: string
          quantity: number
          refill_reference: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          medication_id?: string | null
          order_id: string
          quantity?: number
          refill_reference?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          medication_id?: string | null
          order_id?: string
          quantity?: number
          refill_reference?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          id: string
          pharmacy: string
          status: string
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pharmacy?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pharmacy?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      prescription_items: {
        Row: {
          confidence: number | null
          created_at: string
          dosage: string | null
          duration: string | null
          frequency: string | null
          id: string
          instructions: string | null
          medication_name: string
          prescription_id: string
          quantity: string | null
          refill_count: number | null
          strength: string | null
          timing: string | null
          updated_at: string
          user_id: string
          user_verified: boolean
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          dosage?: string | null
          duration?: string | null
          frequency?: string | null
          id?: string
          instructions?: string | null
          medication_name?: string
          prescription_id: string
          quantity?: string | null
          refill_count?: number | null
          strength?: string | null
          timing?: string | null
          updated_at?: string
          user_id: string
          user_verified?: boolean
        }
        Update: {
          confidence?: number | null
          created_at?: string
          dosage?: string | null
          duration?: string | null
          frequency?: string | null
          id?: string
          instructions?: string | null
          medication_name?: string
          prescription_id?: string
          quantity?: string | null
          refill_count?: number | null
          strength?: string | null
          timing?: string | null
          updated_at?: string
          user_id?: string
          user_verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "prescription_items_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          deleted_at: string | null
          extracted_text: string | null
          id: string
          image_storage_key: string | null
          overall_confidence: number | null
          processed_at: string | null
          processing_status: string
          uploaded_at: string
          user_id: string
        }
        Insert: {
          deleted_at?: string | null
          extracted_text?: string | null
          id?: string
          image_storage_key?: string | null
          overall_confidence?: number | null
          processed_at?: string | null
          processing_status?: string
          uploaded_at?: string
          user_id: string
        }
        Update: {
          deleted_at?: string | null
          extracted_text?: string | null
          id?: string
          image_storage_key?: string | null
          overall_confidence?: number | null
          processed_at?: string | null
          processing_status?: string
          uploaded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          mfa_enabled: boolean
          name: string
          onboarded: boolean
          status: string
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id: string
          mfa_enabled?: boolean
          name?: string
          onboarded?: boolean
          status?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          mfa_enabled?: boolean
          name?: string
          onboarded?: boolean
          status?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      recycling_submissions: {
        Row: {
          bottles: number
          created_at: string
          expired: number
          id: string
          note: string
          status: string
          tracking_number: string
          updated_at: string
          user_id: string
          verified_at: string | null
          verified_by: string | null
          verified_count: number | null
          wrappers: number
        }
        Insert: {
          bottles?: number
          created_at?: string
          expired?: number
          id?: string
          note?: string
          status?: string
          tracking_number?: string
          updated_at?: string
          user_id: string
          verified_at?: string | null
          verified_by?: string | null
          verified_count?: number | null
          wrappers?: number
        }
        Update: {
          bottles?: number
          created_at?: string
          expired?: number
          id?: string
          note?: string
          status?: string
          tracking_number?: string
          updated_at?: string
          user_id?: string
          verified_at?: string | null
          verified_by?: string | null
          verified_count?: number | null
          wrappers?: number
        }
        Relationships: [
          {
            foreignKeyName: "recycling_submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      refills: {
        Row: {
          created_at: string
          estimated_runout_date: string | null
          id: string
          last_refill_date: string | null
          medication_id: string
          quantity: number
          refill_status: string
          remaining_quantity: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          estimated_runout_date?: string | null
          id?: string
          last_refill_date?: string | null
          medication_id: string
          quantity?: number
          refill_status?: string
          remaining_quantity?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          estimated_runout_date?: string | null
          id?: string
          last_refill_date?: string | null
          medication_id?: string
          quantity?: number
          refill_status?: string
          remaining_quantity?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "refills_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: true
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refills_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          medication_id: string | null
          notification_time: string | null
          quiet_hours_enabled: boolean
          reminder_type: string
          schedule_id: string | null
          snooze_minutes: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          medication_id?: string | null
          notification_time?: string | null
          quiet_hours_enabled?: boolean
          reminder_type?: string
          schedule_id?: string | null
          snooze_minutes?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          medication_id?: string | null
          notification_time?: string | null
          quiet_hours_enabled?: boolean
          reminder_type?: string
          schedule_id?: string | null
          snooze_minutes?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "medication_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_claims: {
        Row: {
          created_at: string
          id: string
          seeds: string[]
          ship_address: string
          ship_name: string
          ship_phone: string
          status: string
          tier: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          seeds?: string[]
          ship_address?: string
          ship_name?: string
          ship_phone?: string
          status?: string
          tier: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          seeds?: string[]
          ship_address?: string
          ship_name?: string
          ship_phone?: string
          status?: string
          tier?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_devices: {
        Row: {
          created_at: string
          device_name: string
          id: string
          last_seen_at: string
          platform: string
          push_token: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_name?: string
          id?: string
          last_seen_at?: string
          platform?: string
          push_token?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_name?: string
          id?: string
          last_seen_at?: string
          platform?: string
          push_token?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
