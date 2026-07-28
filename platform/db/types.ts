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
      action_events: {
        Row: {
          action_id: string
          created_at: string
          from_status: string | null
          id: string
          reason: string | null
          to_status: string
          user_id: string
        }
        Insert: {
          action_id: string
          created_at?: string
          from_status?: string | null
          id?: string
          reason?: string | null
          to_status: string
          user_id: string
        }
        Update: {
          action_id?: string
          created_at?: string
          from_status?: string | null
          id?: string
          reason?: string | null
          to_status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_events_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "daily_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_actions: {
        Row: {
          created_at: string
          date: string
          description: string | null
          domain_id: string | null
          goal_id: string | null
          id: string
          is_required: boolean
          priority: number | null
          skip_reason: string | null
          source: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          description?: string | null
          domain_id?: string | null
          goal_id?: string | null
          id?: string
          is_required?: boolean
          priority?: number | null
          skip_reason?: string | null
          source?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          description?: string | null
          domain_id?: string | null
          goal_id?: string | null
          id?: string
          is_required?: boolean
          priority?: number | null
          skip_reason?: string | null
          source?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_actions_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_actions_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
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
      generated_parameters: {
        Row: {
          approved: boolean
          approved_at: string | null
          assumptions: string[]
          confidence: number
          created_at: string
          domain: string
          id: string
          name: string
          range_max: number | null
          range_min: number | null
          rationale: string
          requires_professional_approval: boolean
          requires_user_approval: boolean
          review_date: string | null
          safety_bounds: string[]
          source: string
          unit: string | null
          updated_at: string
          user_id: string
          value: Json
        }
        Insert: {
          approved?: boolean
          approved_at?: string | null
          assumptions?: string[]
          confidence: number
          created_at?: string
          domain: string
          id?: string
          name: string
          range_max?: number | null
          range_min?: number | null
          rationale: string
          requires_professional_approval?: boolean
          requires_user_approval?: boolean
          review_date?: string | null
          safety_bounds?: string[]
          source: string
          unit?: string | null
          updated_at?: string
          user_id: string
          value: Json
        }
        Update: {
          approved?: boolean
          approved_at?: string | null
          assumptions?: string[]
          confidence?: number
          created_at?: string
          domain?: string
          id?: string
          name?: string
          range_max?: number | null
          range_min?: number | null
          rationale?: string
          requires_professional_approval?: boolean
          requires_user_approval?: boolean
          review_date?: string | null
          safety_bounds?: string[]
          source?: string
          unit?: string | null
          updated_at?: string
          user_id?: string
          value?: Json
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
      grocery_items: {
        Row: {
          created_at: string
          grocery_list_id: string
          id: string
          is_checked: boolean
          name: string
          needed_for: string[]
          quantity: number | null
          section: string
          unit: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          grocery_list_id: string
          id?: string
          is_checked?: boolean
          name: string
          needed_for?: string[]
          quantity?: number | null
          section?: string
          unit?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          grocery_list_id?: string
          id?: string
          is_checked?: boolean
          name?: string
          needed_for?: string[]
          quantity?: number | null
          section?: string
          unit?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grocery_items_grocery_list_id_fkey"
            columns: ["grocery_list_id"]
            isOneToOne: false
            referencedRelation: "grocery_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      grocery_lists: {
        Row: {
          created_at: string
          id: string
          meal_plan_id: string | null
          status: string
          user_id: string
          week_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          meal_plan_id?: string | null
          status?: string
          user_id: string
          week_start: string
        }
        Update: {
          created_at?: string
          id?: string
          meal_plan_id?: string | null
          status?: string
          user_id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "grocery_lists_meal_plan_id_fkey"
            columns: ["meal_plan_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          id: string
          name: string
          quantity: number
          unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          name: string
          quantity?: number
          unit?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          name?: string
          quantity?: number
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meal_plan_items: {
        Row: {
          created_at: string
          day_of_week: number
          id: string
          meal_plan_id: string
          meal_type: string
          recipe_id: string
          servings: number
          user_id: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          id?: string
          meal_plan_id: string
          meal_type: string
          recipe_id: string
          servings?: number
          user_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          id?: string
          meal_plan_id?: string
          meal_type?: string
          recipe_id?: string
          servings?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_items_meal_plan_id_fkey"
            columns: ["meal_plan_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_items_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plans: {
        Row: {
          calorie_target: number | null
          created_at: string
          id: string
          protein_target: number | null
          status: string
          updated_at: string
          user_id: string
          week_start: string
        }
        Insert: {
          calorie_target?: number | null
          created_at?: string
          id?: string
          protein_target?: number | null
          status?: string
          updated_at?: string
          user_id: string
          week_start: string
        }
        Update: {
          calorie_target?: number | null
          created_at?: string
          id?: string
          protein_target?: number | null
          status?: string
          updated_at?: string
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      nutrition_logs: {
        Row: {
          calories: number | null
          carbohydrates: number | null
          created_at: string
          date: string
          fat: number | null
          fiber: number | null
          food: string
          id: string
          meal: string
          notes: string | null
          protein: number | null
          quantity: number | null
          saved_meal_label: string | null
          unit: string | null
          user_id: string
        }
        Insert: {
          calories?: number | null
          carbohydrates?: number | null
          created_at?: string
          date: string
          fat?: number | null
          fiber?: number | null
          food: string
          id?: string
          meal: string
          notes?: string | null
          protein?: number | null
          quantity?: number | null
          saved_meal_label?: string | null
          unit?: string | null
          user_id: string
        }
        Update: {
          calories?: number | null
          carbohydrates?: number | null
          created_at?: string
          date?: string
          fat?: number | null
          fiber?: number | null
          food?: string
          id?: string
          meal?: string
          notes?: string | null
          protein?: number | null
          quantity?: number | null
          saved_meal_label?: string | null
          unit?: string | null
          user_id?: string
        }
        Relationships: []
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
      prep_plans: {
        Row: {
          container_count: number | null
          created_at: string
          estimated_minutes: number | null
          id: string
          meal_plan_id: string | null
          status: string
          user_id: string
          week_start: string
        }
        Insert: {
          container_count?: number | null
          created_at?: string
          estimated_minutes?: number | null
          id?: string
          meal_plan_id?: string | null
          status?: string
          user_id: string
          week_start: string
        }
        Update: {
          container_count?: number | null
          created_at?: string
          estimated_minutes?: number | null
          id?: string
          meal_plan_id?: string | null
          status?: string
          user_id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "prep_plans_meal_plan_id_fkey"
            columns: ["meal_plan_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      prep_steps: {
        Row: {
          created_at: string
          id: string
          instruction: string
          prep_plan_id: string
          step_number: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          instruction: string
          prep_plan_id: string
          step_number: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          instruction?: string
          prep_plan_id?: string
          step_number?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prep_steps_prep_plan_id_fkey"
            columns: ["prep_plan_id"]
            isOneToOne: false
            referencedRelation: "prep_plans"
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
      recipes: {
        Row: {
          calories: number
          carbs_g: number
          cook_minutes: number
          created_at: string
          dietary_tags: string[]
          fat_g: number
          fiber_g: number | null
          id: string
          ingredients: Json
          instructions: string[]
          meal_type: string
          name: string
          prep_minutes: number
          protein_g: number
          servings: number
          storage_instructions: string | null
        }
        Insert: {
          calories: number
          carbs_g: number
          cook_minutes?: number
          created_at?: string
          dietary_tags?: string[]
          fat_g: number
          fiber_g?: number | null
          id?: string
          ingredients: Json
          instructions?: string[]
          meal_type: string
          name: string
          prep_minutes?: number
          protein_g: number
          servings?: number
          storage_instructions?: string | null
        }
        Update: {
          calories?: number
          carbs_g?: number
          cook_minutes?: number
          created_at?: string
          dietary_tags?: string[]
          fat_g?: number
          fiber_g?: number | null
          id?: string
          ingredients?: Json
          instructions?: string[]
          meal_type?: string
          name?: string
          prep_minutes?: number
          protein_g?: number
          servings?: number
          storage_instructions?: string | null
        }
        Relationships: []
      }
      recovery_logs: {
        Row: {
          approved_exercises: string | null
          brace_compliance: boolean | null
          created_at: string
          date: string
          elevation: boolean | null
          energy: number | null
          ice: boolean | null
          id: string
          medication_adherence: boolean | null
          mobility: string | null
          notes: string | null
          pain: number | null
          swelling: number | null
          user_id: string
          warning_signs: boolean
          warning_signs_notes: string | null
        }
        Insert: {
          approved_exercises?: string | null
          brace_compliance?: boolean | null
          created_at?: string
          date: string
          elevation?: boolean | null
          energy?: number | null
          ice?: boolean | null
          id?: string
          medication_adherence?: boolean | null
          mobility?: string | null
          notes?: string | null
          pain?: number | null
          swelling?: number | null
          user_id: string
          warning_signs?: boolean
          warning_signs_notes?: string | null
        }
        Update: {
          approved_exercises?: string | null
          brace_compliance?: boolean | null
          created_at?: string
          date?: string
          elevation?: boolean | null
          energy?: number | null
          ice?: boolean | null
          id?: string
          medication_adherence?: boolean | null
          mobility?: string | null
          notes?: string | null
          pain?: number | null
          swelling?: number | null
          user_id?: string
          warning_signs?: boolean
          warning_signs_notes?: string | null
        }
        Relationships: []
      }
      sleep_logs: {
        Row: {
          bedtime: string | null
          created_at: string
          date: string
          id: string
          interruptions: number | null
          notes: string | null
          quality: number | null
          source: string
          total_duration_minutes: number | null
          user_id: string
          wake_time: string | null
        }
        Insert: {
          bedtime?: string | null
          created_at?: string
          date: string
          id?: string
          interruptions?: number | null
          notes?: string | null
          quality?: number | null
          source?: string
          total_duration_minutes?: number | null
          user_id: string
          wake_time?: string | null
        }
        Update: {
          bedtime?: string | null
          created_at?: string
          date?: string
          id?: string
          interruptions?: number | null
          notes?: string | null
          quality?: number | null
          source?: string
          total_duration_minutes?: number | null
          user_id?: string
          wake_time?: string | null
        }
        Relationships: []
      }
      study_sessions: {
        Row: {
          created_at: string
          date: string
          duration_minutes: number | null
          focus: number | null
          id: string
          link: string | null
          next_step: string | null
          output: string | null
          reflection: string | null
          task: string
          track: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          duration_minutes?: number | null
          focus?: number | null
          id?: string
          link?: string | null
          next_step?: string | null
          output?: string | null
          reflection?: string | null
          task: string
          track?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          duration_minutes?: number | null
          focus?: number | null
          id?: string
          link?: string | null
          next_step?: string | null
          output?: string | null
          reflection?: string | null
          task?: string
          track?: string | null
          user_id?: string
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
      weight_logs: {
        Row: {
          created_at: string
          id: string
          logged_at: string
          notes: string | null
          source: string
          unit: string
          user_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          logged_at?: string
          notes?: string | null
          source?: string
          unit: string
          user_id: string
          weight: number
        }
        Update: {
          created_at?: string
          id?: string
          logged_at?: string
          notes?: string | null
          source?: string
          unit?: string
          user_id?: string
          weight?: number
        }
        Relationships: []
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
