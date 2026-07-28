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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      daily_checkin_fields: {
        Row: {
          created_at: string
          fields: Json
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fields?: Json
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          fields?: Json
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      domains: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          key: string
          label: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          key: string
          label: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          key?: string
          label?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          confidence: number | null
          constraints: string | null
          created_at: string
          domain_id: string | null
          id: string
          known_obstacles: string | null
          outcome: string
          priority: number | null
          starting_state: string | null
          status: string
          success_criteria: string | null
          target_date: string | null
          updated_at: string
          user_id: string
          why: string | null
        }
        Insert: {
          confidence?: number | null
          constraints?: string | null
          created_at?: string
          domain_id?: string | null
          id?: string
          known_obstacles?: string | null
          outcome: string
          priority?: number | null
          starting_state?: string | null
          status?: string
          success_criteria?: string | null
          target_date?: string | null
          updated_at?: string
          user_id: string
          why?: string | null
        }
        Update: {
          confidence?: number | null
          constraints?: string | null
          created_at?: string
          domain_id?: string | null
          id?: string
          known_obstacles?: string | null
          outcome?: string
          priority?: number | null
          starting_state?: string | null
          status?: string
          success_criteria?: string | null
          target_date?: string | null
          updated_at?: string
          user_id?: string
          why?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goals_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_responses: {
        Row: {
          coaching: Json
          completed_steps: string[]
          created_at: string
          goals: Json
          id: string
          identity: Json
          learning: Json
          nutrition: Json
          recovery: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          coaching?: Json
          completed_steps?: string[]
          created_at?: string
          goals?: Json
          id?: string
          identity?: Json
          learning?: Json
          nutrition?: Json
          recovery?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          coaching?: Json
          completed_steps?: string[]
          created_at?: string
          goals?: Json
          id?: string
          identity?: Json
          learning?: Json
          nutrition?: Json
          recovery?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      personalization_profiles: {
        Row: {
          created_at: string
          explanation_depth: string | null
          id: string
          never_recommend: Json
          planning_style: string | null
          reminder_preference: string | null
          reschedule_missed_tasks: boolean | null
          tone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          explanation_depth?: string | null
          id?: string
          never_recommend?: Json
          planning_style?: string | null
          reminder_preference?: string | null
          reschedule_missed_tasks?: boolean | null
          tone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          explanation_depth?: string | null
          id?: string
          never_recommend?: Json
          planning_style?: string | null
          reminder_preference?: string | null
          reschedule_missed_tasks?: boolean | null
          tone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      phases: {
        Row: {
          created_at: string
          ends_on: string | null
          goal_id: string | null
          id: string
          is_current: boolean
          mission: string | null
          name: string
          starts_on: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ends_on?: string | null
          goal_id?: string | null
          id?: string
          is_current?: boolean
          mission?: string | null
          name: string
          starts_on?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ends_on?: string | null
          goal_id?: string | null
          id?: string
          is_current?: boolean
          mission?: string | null
          name?: string
          starts_on?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "phases_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          bed_time: string | null
          created_at: string
          full_name: string | null
          grocery_day: number | null
          id: string
          learning_time_minutes_per_week: number | null
          meal_prep_day: number | null
          onboarding_completed_at: string | null
          school_commitments: string | null
          time_zone: string | null
          units: string | null
          updated_at: string
          wake_time: string | null
          weekly_review_day: number | null
          work_hours_note: string | null
          work_status: string | null
        }
        Insert: {
          bed_time?: string | null
          created_at?: string
          full_name?: string | null
          grocery_day?: number | null
          id: string
          learning_time_minutes_per_week?: number | null
          meal_prep_day?: number | null
          onboarding_completed_at?: string | null
          school_commitments?: string | null
          time_zone?: string | null
          units?: string | null
          updated_at?: string
          wake_time?: string | null
          weekly_review_day?: number | null
          work_hours_note?: string | null
          work_status?: string | null
        }
        Update: {
          bed_time?: string | null
          created_at?: string
          full_name?: string | null
          grocery_day?: number | null
          id?: string
          learning_time_minutes_per_week?: number | null
          meal_prep_day?: number | null
          onboarding_completed_at?: string | null
          school_commitments?: string | null
          time_zone?: string | null
          units?: string | null
          updated_at?: string
          wake_time?: string | null
          weekly_review_day?: number | null
          work_hours_note?: string | null
          work_status?: string | null
        }
        Relationships: []
      }
      weekly_outcomes: {
        Row: {
          created_at: string
          goal_id: string | null
          id: string
          outcome_text: string
          status: string
          updated_at: string
          user_id: string
          week_start: string
        }
        Insert: {
          created_at?: string
          goal_id?: string | null
          id?: string
          outcome_text: string
          status?: string
          updated_at?: string
          user_id: string
          week_start: string
        }
        Update: {
          created_at?: string
          goal_id?: string | null
          id?: string
          outcome_text?: string
          status?: string
          updated_at?: string
          user_id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_outcomes_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
