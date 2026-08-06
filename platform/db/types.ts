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
      activity_daily_summaries: {
        Row: {
          created_at: string
          day: string
          day_of_week: number | null
          heart_rate_avg_bpm: number | null
          heart_rate_sample_count: number
          id: string
          is_weekend: boolean | null
          sleep_logged: boolean
          sleep_quality: number | null
          sleep_total_duration_minutes: number | null
          steps_most_active_local_hour: number | null
          steps_total: number
          timezone: string
          updated_at: string
          user_id: string
          weight_first_value: number | null
          weight_last_logged_at: string | null
          weight_last_value: number | null
          weight_logged: boolean
          weight_unit: string | null
          workout_activity_types: string[]
          workout_count: number
          workout_first_start_at: string | null
          workout_first_start_local_hour: number | null
          workout_last_start_at: string | null
          workout_total_minutes: number
        }
        Insert: {
          created_at?: string
          day: string
          day_of_week?: number | null
          heart_rate_avg_bpm?: number | null
          heart_rate_sample_count?: number
          id?: string
          is_weekend?: boolean | null
          sleep_logged?: boolean
          sleep_quality?: number | null
          sleep_total_duration_minutes?: number | null
          steps_most_active_local_hour?: number | null
          steps_total?: number
          timezone?: string
          updated_at?: string
          user_id: string
          weight_first_value?: number | null
          weight_last_logged_at?: string | null
          weight_last_value?: number | null
          weight_logged?: boolean
          weight_unit?: string | null
          workout_activity_types?: string[]
          workout_count?: number
          workout_first_start_at?: string | null
          workout_first_start_local_hour?: number | null
          workout_last_start_at?: string | null
          workout_total_minutes?: number
        }
        Update: {
          created_at?: string
          day?: string
          day_of_week?: number | null
          heart_rate_avg_bpm?: number | null
          heart_rate_sample_count?: number
          id?: string
          is_weekend?: boolean | null
          sleep_logged?: boolean
          sleep_quality?: number | null
          sleep_total_duration_minutes?: number | null
          steps_most_active_local_hour?: number | null
          steps_total?: number
          timezone?: string
          updated_at?: string
          user_id?: string
          weight_first_value?: number | null
          weight_last_logged_at?: string | null
          weight_last_value?: number | null
          weight_logged?: boolean
          weight_unit?: string | null
          workout_activity_types?: string[]
          workout_count?: number
          workout_first_start_at?: string | null
          workout_first_start_local_hour?: number | null
          workout_last_start_at?: string | null
          workout_total_minutes?: number
        }
        Relationships: []
      }
      admin_actions: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          detail: Json | null
          id: string
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          detail?: Json | null
          id?: string
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          detail?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      ai_runs: {
        Row: {
          created_at: string
          error: string | null
          id: string
          model: string
          purpose: string
          success: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          model: string
          purpose: string
          success: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          model?: string
          purpose?: string
          success?: boolean
          user_id?: string
        }
        Relationships: []
      }
      calendar_connections: {
        Row: {
          access_token_encrypted: string | null
          connected_at: string
          external_account_email: string | null
          id: string
          provider: string
          refresh_token_encrypted: string
          scope: string
          token_expires_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_encrypted?: string | null
          connected_at?: string
          external_account_email?: string | null
          id?: string
          provider: string
          refresh_token_encrypted: string
          scope: string
          token_expires_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_encrypted?: string | null
          connected_at?: string
          external_account_email?: string | null
          id?: string
          provider?: string
          refresh_token_encrypted?: string
          scope?: string
          token_expires_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      custom_timeline_events: {
        Row: {
          completed_at: string | null
          created_at: string
          date: string
          end_time: string | null
          id: string
          notes: string | null
          scheduled_time: string | null
          title: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          date: string
          end_time?: string | null
          id?: string
          notes?: string | null
          scheduled_time?: string | null
          title: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          date?: string
          end_time?: string | null
          id?: string
          notes?: string | null
          scheduled_time?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
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
      exercise_logs: {
        Row: {
          archetype: string | null
          created_at: string
          date: string
          duration_minutes: number | null
          id: string
          notes: string | null
          perceived_exertion: number | null
          user_id: string
        }
        Insert: {
          archetype?: string | null
          created_at?: string
          date: string
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          perceived_exertion?: number | null
          user_id: string
        }
        Update: {
          archetype?: string | null
          created_at?: string
          date?: string
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          perceived_exertion?: number | null
          user_id?: string
        }
        Relationships: []
      }
      exercise_progressions: {
        Row: {
          exercise_id: string
          id: string
          related_exercise_id: string
          relation: string
        }
        Insert: {
          exercise_id: string
          id?: string
          related_exercise_id: string
          relation: string
        }
        Update: {
          exercise_id?: string
          id?: string
          related_exercise_id?: string
          relation?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_progressions_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_progressions_related_exercise_id_fkey"
            columns: ["related_exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          aliases: string[]
          archetype_tags: string[]
          canonical_name: string
          compound: boolean
          contraindication_notes: string | null
          created_at: string
          difficulty: string
          equipment_required: string[]
          id: string
          image_url: string | null
          instructions: string | null
          limitation_tags: string[]
          modality: string | null
          movement_pattern: string
          movement_patterns: string[]
          name: string
          primary_muscle_groups: string[]
          secondary_muscle_groups: string[]
          setup_requirements: string[]
          status: string
          unilateral: boolean
          video_url: string | null
        }
        Insert: {
          aliases?: string[]
          archetype_tags?: string[]
          canonical_name: string
          compound?: boolean
          contraindication_notes?: string | null
          created_at?: string
          difficulty: string
          equipment_required?: string[]
          id?: string
          image_url?: string | null
          instructions?: string | null
          limitation_tags?: string[]
          modality?: string | null
          movement_pattern: string
          movement_patterns?: string[]
          name: string
          primary_muscle_groups?: string[]
          secondary_muscle_groups?: string[]
          setup_requirements?: string[]
          status?: string
          unilateral?: boolean
          video_url?: string | null
        }
        Update: {
          aliases?: string[]
          archetype_tags?: string[]
          canonical_name?: string
          compound?: boolean
          contraindication_notes?: string | null
          created_at?: string
          difficulty?: string
          equipment_required?: string[]
          id?: string
          image_url?: string | null
          instructions?: string | null
          limitation_tags?: string[]
          modality?: string | null
          movement_pattern?: string
          movement_patterns?: string[]
          name?: string
          primary_muscle_groups?: string[]
          secondary_muscle_groups?: string[]
          setup_requirements?: string[]
          status?: string
          unilateral?: boolean
          video_url?: string | null
        }
        Relationships: []
      }
      expert_claims: {
        Row: {
          applicable_goals: string[]
          applicable_levels: string[]
          claim_type: string
          confidence: string
          created_at: string
          excluded_conditions: string[]
          exercise_id: string | null
          expert_id: string
          id: string
          movement_pattern: string | null
          normalized_claim: string
          page_number: number | null
          required_equipment: string[]
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          short_rationale: string
          source_id: string
          superseded_by: string | null
          timestamp_seconds: number | null
          topic: string
          updated_at: string
          valid_from: string
          valid_until: string | null
          verbatim_excerpt: string | null
        }
        Insert: {
          applicable_goals?: string[]
          applicable_levels?: string[]
          claim_type: string
          confidence: string
          created_at?: string
          excluded_conditions?: string[]
          exercise_id?: string | null
          expert_id: string
          id?: string
          movement_pattern?: string | null
          normalized_claim: string
          page_number?: number | null
          required_equipment?: string[]
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          short_rationale: string
          source_id: string
          superseded_by?: string | null
          timestamp_seconds?: number | null
          topic: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
          verbatim_excerpt?: string | null
        }
        Update: {
          applicable_goals?: string[]
          applicable_levels?: string[]
          claim_type?: string
          confidence?: string
          created_at?: string
          excluded_conditions?: string[]
          exercise_id?: string | null
          expert_id?: string
          id?: string
          movement_pattern?: string | null
          normalized_claim?: string
          page_number?: number | null
          required_equipment?: string[]
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          short_rationale?: string
          source_id?: string
          superseded_by?: string | null
          timestamp_seconds?: number | null
          topic?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
          verbatim_excerpt?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expert_claims_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_claims_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "experts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_claims_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_claims_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "expert_claims"
            referencedColumns: ["id"]
          },
        ]
      }
      experts: {
        Row: {
          affiliations: Json
          coaching_evidence: Json
          created_at: string
          credentials: Json
          entity_type: string
          evidence_score: number | null
          id: string
          inclusion_reason: string | null
          name: string
          official_channels: Json
          practice_score: number | null
          reach_score: number | null
          reputation_score: number | null
          research_profiles: Json
          reviewed_at: string | null
          reviewed_by: string | null
          roles: string[]
          slug: string
          specialties: string[]
          specialty_scores: Json
          status: string
          transparency_score: number | null
          updated_at: string
        }
        Insert: {
          affiliations?: Json
          coaching_evidence?: Json
          created_at?: string
          credentials?: Json
          entity_type: string
          evidence_score?: number | null
          id?: string
          inclusion_reason?: string | null
          name: string
          official_channels?: Json
          practice_score?: number | null
          reach_score?: number | null
          reputation_score?: number | null
          research_profiles?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          roles?: string[]
          slug: string
          specialties?: string[]
          specialty_scores?: Json
          status?: string
          transparency_score?: number | null
          updated_at?: string
        }
        Update: {
          affiliations?: Json
          coaching_evidence?: Json
          created_at?: string
          credentials?: Json
          entity_type?: string
          evidence_score?: number | null
          id?: string
          inclusion_reason?: string | null
          name?: string
          official_channels?: Json
          practice_score?: number | null
          reach_score?: number | null
          reputation_score?: number | null
          research_profiles?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          roles?: string[]
          slug?: string
          specialties?: string[]
          specialty_scores?: Json
          status?: string
          transparency_score?: number | null
          updated_at?: string
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
      heart_rate_logs: {
        Row: {
          bpm: number
          created_at: string
          dedup_key: string | null
          device: string | null
          id: string
          imported_at: string | null
          logged_at: string
          source: string
          user_id: string
          user_override: boolean
        }
        Insert: {
          bpm: number
          created_at?: string
          dedup_key?: string | null
          device?: string | null
          id?: string
          imported_at?: string | null
          logged_at: string
          source: string
          user_id: string
          user_override?: boolean
        }
        Update: {
          bpm?: number
          created_at?: string
          dedup_key?: string | null
          device?: string | null
          id?: string
          imported_at?: string | null
          logged_at?: string
          source?: string
          user_id?: string
          user_override?: boolean
        }
        Relationships: []
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
      limitation_rules: {
        Row: {
          action: string
          created_at: string
          exercise_id: string | null
          id: string
          limitation_tag: string
          movement_pattern: string | null
          rationale: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_id: string | null
          status: string
          substitute_movement_pattern: string | null
          updated_at: string
        }
        Insert: {
          action: string
          created_at?: string
          exercise_id?: string | null
          id?: string
          limitation_tag: string
          movement_pattern?: string | null
          rationale: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_id?: string | null
          status?: string
          substitute_movement_pattern?: string | null
          updated_at?: string
        }
        Update: {
          action?: string
          created_at?: string
          exercise_id?: string | null
          id?: string
          limitation_tag?: string
          movement_pattern?: string | null
          rationale?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_id?: string | null
          status?: string
          substitute_movement_pattern?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "limitation_rules_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "limitation_rules_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plan_items: {
        Row: {
          completed_at: string | null
          created_at: string
          day_of_week: number
          end_time: string | null
          id: string
          meal_plan_id: string
          meal_type: string
          notes: string | null
          nutrition_log_id: string | null
          recipe_id: string
          scheduled_time: string | null
          servings: number
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          day_of_week: number
          end_time?: string | null
          id?: string
          meal_plan_id: string
          meal_type: string
          notes?: string | null
          nutrition_log_id?: string | null
          recipe_id: string
          scheduled_time?: string | null
          servings?: number
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          day_of_week?: number
          end_time?: string | null
          id?: string
          meal_plan_id?: string
          meal_type?: string
          notes?: string | null
          nutrition_log_id?: string | null
          recipe_id?: string
          scheduled_time?: string | null
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
            foreignKeyName: "meal_plan_items_nutrition_log_id_fkey"
            columns: ["nutrition_log_id"]
            isOneToOne: false
            referencedRelation: "nutrition_logs"
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
      memories: {
        Row: {
          confidence: number
          content: string
          created_at: string
          evidence: string | null
          id: string
          last_confirmed_at: string | null
          review_date: string | null
          type: string
          user_confirmed: boolean
          user_id: string
        }
        Insert: {
          confidence?: number
          content: string
          created_at?: string
          evidence?: string | null
          id?: string
          last_confirmed_at?: string | null
          review_date?: string | null
          type: string
          user_confirmed?: boolean
          user_id: string
        }
        Update: {
          confidence?: number
          content?: string
          created_at?: string
          evidence?: string | null
          id?: string
          last_confirmed_at?: string | null
          review_date?: string | null
          type?: string
          user_confirmed?: boolean
          user_id?: string
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
          exercise: Json
          goals: Json
          id: string
          identity: Json
          learning: Json
          nutrition: Json
          recovery: Json | null
          sleep: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          coaching?: Json
          completed_steps?: string[]
          created_at?: string
          exercise?: Json
          goals?: Json
          id?: string
          identity?: Json
          learning?: Json
          nutrition?: Json
          recovery?: Json | null
          sleep?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          coaching?: Json
          completed_steps?: string[]
          created_at?: string
          exercise?: Json
          goals?: Json
          id?: string
          identity?: Json
          learning?: Json
          nutrition?: Json
          recovery?: Json | null
          sleep?: Json
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
          admin_role: string | null
          bed_time: string | null
          created_at: string
          full_name: string | null
          grocery_day: number | null
          id: string
          is_admin: boolean
          is_trainer: boolean
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
          admin_role?: string | null
          bed_time?: string | null
          created_at?: string
          full_name?: string | null
          grocery_day?: number | null
          id: string
          is_admin?: boolean
          is_trainer?: boolean
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
          admin_role?: string | null
          bed_time?: string | null
          created_at?: string
          full_name?: string | null
          grocery_day?: number | null
          id?: string
          is_admin?: boolean
          is_trainer?: boolean
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
      program_session_exercises: {
        Row: {
          cardio_intensity: string | null
          coaching_notes: string | null
          created_at: string
          duration_minutes: number | null
          exercise_id: string
          exercise_order: number
          id: string
          intensity_type: string | null
          intensity_value: string | null
          primary_exercise_id: string | null
          reps_max: number | null
          reps_min: number | null
          session_id: string
          sets: number | null
        }
        Insert: {
          cardio_intensity?: string | null
          coaching_notes?: string | null
          created_at?: string
          duration_minutes?: number | null
          exercise_id: string
          exercise_order?: number
          id?: string
          intensity_type?: string | null
          intensity_value?: string | null
          primary_exercise_id?: string | null
          reps_max?: number | null
          reps_min?: number | null
          session_id: string
          sets?: number | null
        }
        Update: {
          cardio_intensity?: string | null
          coaching_notes?: string | null
          created_at?: string
          duration_minutes?: number | null
          exercise_id?: string
          exercise_order?: number
          id?: string
          intensity_type?: string | null
          intensity_value?: string | null
          primary_exercise_id?: string | null
          reps_max?: number | null
          reps_min?: number | null
          session_id?: string
          sets?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "program_session_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_session_exercises_primary_exercise_id_fkey"
            columns: ["primary_exercise_id"]
            isOneToOne: false
            referencedRelation: "program_session_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_session_exercises_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "program_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      program_sessions: {
        Row: {
          id: string
          name: string | null
          phase_id: string
          session_index: number
          session_type: string | null
        }
        Insert: {
          id?: string
          name?: string | null
          phase_id: string
          session_index: number
          session_type?: string | null
        }
        Update: {
          id?: string
          name?: string | null
          phase_id?: string
          session_index?: number
          session_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "program_sessions_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "training_program_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      program_sources: {
        Row: {
          created_at: string
          id: string
          organization: string
          program_id: string
          retrieved_at: string
          title: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization: string
          program_id: string
          retrieved_at: string
          title: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          organization?: string
          program_id?: string
          retrieved_at?: string
          title?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_sources_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "training_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_templates: {
        Row: {
          created_at: string
          days_per_week_max: number
          days_per_week_min: number
          description: string | null
          equipment_context: string
          experience_tier: string
          goal: string
          id: string
          is_active: boolean
          limitation_compatible_tags: string[]
          name: string
          session_duration_band: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          days_per_week_max: number
          days_per_week_min: number
          description?: string | null
          equipment_context: string
          experience_tier: string
          goal: string
          id?: string
          is_active?: boolean
          limitation_compatible_tags?: string[]
          name: string
          session_duration_band: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          days_per_week_max?: number
          days_per_week_min?: number
          description?: string | null
          equipment_context?: string
          experience_tier?: string
          goal?: string
          id?: string
          is_active?: boolean
          limitation_compatible_tags?: string[]
          name?: string
          session_duration_band?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      prompt_events: {
        Row: {
          answered: boolean
          dismissed: boolean
          id: string
          memory_id: string | null
          shown_at: string
          trigger_id: string
          user_id: string
        }
        Insert: {
          answered?: boolean
          dismissed?: boolean
          id?: string
          memory_id?: string | null
          shown_at?: string
          trigger_id: string
          user_id: string
        }
        Update: {
          answered?: boolean
          dismissed?: boolean
          id?: string
          memory_id?: string | null
          shown_at?: string
          trigger_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompt_events_memory_id_fkey"
            columns: ["memory_id"]
            isOneToOne: false
            referencedRelation: "memories"
            referencedColumns: ["id"]
          },
        ]
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
          status: string
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
          status?: string
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
          status?: string
          storage_instructions?: string | null
        }
        Relationships: []
      }
      recommendations: {
        Row: {
          accepted: boolean | null
          confidence: number | null
          created_at: string
          field: string
          id: string
          previous_value: Json | null
          proposed_value: Json | null
          reason: string
          user_id: string
          weekly_review_id: string | null
        }
        Insert: {
          accepted?: boolean | null
          confidence?: number | null
          created_at?: string
          field: string
          id?: string
          previous_value?: Json | null
          proposed_value?: Json | null
          reason: string
          user_id: string
          weekly_review_id?: string | null
        }
        Update: {
          accepted?: boolean | null
          confidence?: number | null
          created_at?: string
          field?: string
          id?: string
          previous_value?: Json | null
          proposed_value?: Json | null
          reason?: string
          user_id?: string
          weekly_review_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_weekly_review_id_fkey"
            columns: ["weekly_review_id"]
            isOneToOne: false
            referencedRelation: "weekly_reviews"
            referencedColumns: ["id"]
          },
        ]
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
      schedule_events: {
        Row: {
          created_at: string
          date: string
          id: string
          kind: string
          label: string
          reference_id: string | null
          scheduled_time: string
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          kind: string
          label: string
          reference_id?: string | null
          scheduled_time: string
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          kind?: string
          label?: string
          reference_id?: string | null
          scheduled_time?: string
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sleep_logs: {
        Row: {
          bedtime: string | null
          created_at: string
          date: string
          dedup_key: string | null
          device: string | null
          id: string
          imported_at: string | null
          interruptions: number | null
          notes: string | null
          quality: number | null
          source: string
          total_duration_minutes: number | null
          user_id: string
          user_override: boolean
          wake_time: string | null
        }
        Insert: {
          bedtime?: string | null
          created_at?: string
          date: string
          dedup_key?: string | null
          device?: string | null
          id?: string
          imported_at?: string | null
          interruptions?: number | null
          notes?: string | null
          quality?: number | null
          source?: string
          total_duration_minutes?: number | null
          user_id: string
          user_override?: boolean
          wake_time?: string | null
        }
        Update: {
          bedtime?: string | null
          created_at?: string
          date?: string
          dedup_key?: string | null
          device?: string | null
          id?: string
          imported_at?: string | null
          interruptions?: number | null
          notes?: string | null
          quality?: number | null
          source?: string
          total_duration_minutes?: number | null
          user_id?: string
          user_override?: boolean
          wake_time?: string | null
        }
        Relationships: []
      }
      sources: {
        Row: {
          accessed_at: string
          canonical_url: string
          created_at: string
          expert_id: string | null
          id: string
          organization: string
          published_at: string | null
          source_type: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          accessed_at: string
          canonical_url: string
          created_at?: string
          expert_id?: string | null
          id?: string
          organization: string
          published_at?: string | null
          source_type: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          accessed_at?: string
          canonical_url?: string
          created_at?: string
          expert_id?: string | null
          id?: string
          organization?: string
          published_at?: string | null
          source_type?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sources_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "experts"
            referencedColumns: ["id"]
          },
        ]
      }
      step_logs: {
        Row: {
          count: number
          created_at: string
          dedup_key: string | null
          device: string | null
          id: string
          imported_at: string | null
          logged_at: string
          source: string
          user_id: string
          user_override: boolean
        }
        Insert: {
          count: number
          created_at?: string
          dedup_key?: string | null
          device?: string | null
          id?: string
          imported_at?: string | null
          logged_at: string
          source: string
          user_id: string
          user_override?: boolean
        }
        Update: {
          count?: number
          created_at?: string
          dedup_key?: string | null
          device?: string | null
          id?: string
          imported_at?: string | null
          logged_at?: string
          source?: string
          user_id?: string
          user_override?: boolean
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
      template_phases: {
        Row: {
          focus: string | null
          id: string
          intensity_style: string | null
          is_final: boolean
          length_weeks: number
          name: string
          phase_order: number
          template_id: string
        }
        Insert: {
          focus?: string | null
          id?: string
          intensity_style?: string | null
          is_final?: boolean
          length_weeks: number
          name: string
          phase_order: number
          template_id: string
        }
        Update: {
          focus?: string | null
          id?: string
          intensity_style?: string | null
          is_final?: boolean
          length_weeks?: number
          name?: string
          phase_order?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_phases_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "program_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      template_sessions: {
        Row: {
          id: string
          name: string
          phase_id: string
          session_index: number
          session_type: string | null
        }
        Insert: {
          id?: string
          name: string
          phase_id: string
          session_index: number
          session_type?: string | null
        }
        Update: {
          id?: string
          name?: string
          phase_id?: string
          session_index?: number
          session_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "template_sessions_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "template_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      template_slots: {
        Row: {
          coaching_notes: string | null
          duration_minutes_max: number | null
          duration_minutes_min: number | null
          effort_target: string | null
          id: string
          is_optional: boolean
          modality: string
          movement_pattern: string
          reps_max: number | null
          reps_min: number | null
          rest_seconds: number | null
          session_id: string
          sets_max: number | null
          sets_min: number | null
          slot_label: string
          slot_order: number
        }
        Insert: {
          coaching_notes?: string | null
          duration_minutes_max?: number | null
          duration_minutes_min?: number | null
          effort_target?: string | null
          id?: string
          is_optional?: boolean
          modality: string
          movement_pattern: string
          reps_max?: number | null
          reps_min?: number | null
          rest_seconds?: number | null
          session_id: string
          sets_max?: number | null
          sets_min?: number | null
          slot_label: string
          slot_order: number
        }
        Update: {
          coaching_notes?: string | null
          duration_minutes_max?: number | null
          duration_minutes_min?: number | null
          effort_target?: string | null
          id?: string
          is_optional?: boolean
          modality?: string
          movement_pattern?: string
          reps_max?: number | null
          reps_min?: number | null
          rest_seconds?: number | null
          session_id?: string
          sets_max?: number | null
          sets_min?: number | null
          slot_label?: string
          slot_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "template_slots_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "template_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_clients: {
        Row: {
          client_id: string
          ended_at: string | null
          id: string
          started_at: string
          status: string
          trainer_id: string
        }
        Insert: {
          client_id: string
          ended_at?: string | null
          id?: string
          started_at?: string
          status?: string
          trainer_id: string
        }
        Update: {
          client_id?: string
          ended_at?: string | null
          id?: string
          started_at?: string
          status?: string
          trainer_id?: string
        }
        Relationships: []
      }
      trainer_invite_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string | null
          id: string
          revoked_at: string | null
          trainer_id: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          revoked_at?: string | null
          trainer_id: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          revoked_at?: string | null
          trainer_id?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      trainer_profiles: {
        Row: {
          bio: string | null
          created_at: string
          is_discoverable: boolean
          location_city: string | null
          location_region: string | null
          specialties: string[]
          trainer_id: string
          updated_at: string
          years_experience: number | null
        }
        Insert: {
          bio?: string | null
          created_at?: string
          is_discoverable?: boolean
          location_city?: string | null
          location_region?: string | null
          specialties?: string[]
          trainer_id: string
          updated_at?: string
          years_experience?: number | null
        }
        Update: {
          bio?: string | null
          created_at?: string
          is_discoverable?: boolean
          location_city?: string | null
          location_region?: string | null
          specialties?: string[]
          trainer_id?: string
          updated_at?: string
          years_experience?: number | null
        }
        Relationships: []
      }
      trainer_requests: {
        Row: {
          client_id: string
          created_at: string
          id: string
          message: string | null
          responded_at: string | null
          status: string
          trainer_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          message?: string | null
          responded_at?: string | null
          status?: string
          trainer_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          message?: string | null
          responded_at?: string | null
          status?: string
          trainer_id?: string
        }
        Relationships: []
      }
      training_program_phases: {
        Row: {
          focus: string | null
          id: string
          intensity_style: string | null
          is_final: boolean
          length_weeks: number
          name: string
          phase_order: number
          program_id: string
        }
        Insert: {
          focus?: string | null
          id?: string
          intensity_style?: string | null
          is_final?: boolean
          length_weeks?: number
          name: string
          phase_order: number
          program_id: string
        }
        Update: {
          focus?: string | null
          id?: string
          intensity_style?: string | null
          is_final?: boolean
          length_weeks?: number
          name?: string
          phase_order?: number
          program_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_program_phases_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "training_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      training_programs: {
        Row: {
          archetype: string
          created_at: string
          description: string | null
          display_order: number
          equipment_required: string[]
          experience_level: string | null
          id: string
          is_active: boolean
          methodology_note: string | null
          name: string
          sessions_per_week_max: number
          sessions_per_week_min: number
          slug: string
        }
        Insert: {
          archetype: string
          created_at?: string
          description?: string | null
          display_order?: number
          equipment_required?: string[]
          experience_level?: string | null
          id?: string
          is_active?: boolean
          methodology_note?: string | null
          name: string
          sessions_per_week_max: number
          sessions_per_week_min: number
          slug: string
        }
        Update: {
          archetype?: string
          created_at?: string
          description?: string | null
          display_order?: number
          equipment_required?: string[]
          experience_level?: string | null
          id?: string
          is_active?: boolean
          methodology_note?: string | null
          name?: string
          sessions_per_week_max?: number
          sessions_per_week_min?: number
          slug?: string
        }
        Relationships: []
      }
      weekly_adaptation_responses: {
        Row: {
          created_at: string
          disliked_exercise_ids: string[]
          id: string
          liked_exercise_ids: string[]
          next_week_preference: string | null
          pain_location: string | null
          pain_or_discomfort: string | null
          perceived_difficulty: string | null
          planned_sessions_completed: number | null
          recovery_quality: string | null
          submitted_at: string | null
          user_id: string
          week_start: string
          workout_plan_id: string
        }
        Insert: {
          created_at?: string
          disliked_exercise_ids?: string[]
          id?: string
          liked_exercise_ids?: string[]
          next_week_preference?: string | null
          pain_location?: string | null
          pain_or_discomfort?: string | null
          perceived_difficulty?: string | null
          planned_sessions_completed?: number | null
          recovery_quality?: string | null
          submitted_at?: string | null
          user_id: string
          week_start: string
          workout_plan_id: string
        }
        Update: {
          created_at?: string
          disliked_exercise_ids?: string[]
          id?: string
          liked_exercise_ids?: string[]
          next_week_preference?: string | null
          pain_location?: string | null
          pain_or_discomfort?: string | null
          perceived_difficulty?: string | null
          planned_sessions_completed?: number | null
          recovery_quality?: string | null
          submitted_at?: string | null
          user_id?: string
          week_start?: string
          workout_plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_adaptation_responses_workout_plan_id_fkey"
            columns: ["workout_plan_id"]
            isOneToOne: false
            referencedRelation: "workout_plans"
            referencedColumns: ["id"]
          },
        ]
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
      weekly_reviews: {
        Row: {
          answers: Json
          approved_at: string | null
          brief: Json | null
          created_at: string
          id: string
          metrics: Json
          status: string
          user_id: string
          week_start: string
        }
        Insert: {
          answers?: Json
          approved_at?: string | null
          brief?: Json | null
          created_at?: string
          id?: string
          metrics?: Json
          status?: string
          user_id: string
          week_start: string
        }
        Update: {
          answers?: Json
          approved_at?: string | null
          brief?: Json | null
          created_at?: string
          id?: string
          metrics?: Json
          status?: string
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      weight_logs: {
        Row: {
          created_at: string
          dedup_key: string | null
          device: string | null
          id: string
          imported_at: string | null
          logged_at: string
          notes: string | null
          source: string
          unit: string
          user_id: string
          user_override: boolean
          weight: number
        }
        Insert: {
          created_at?: string
          dedup_key?: string | null
          device?: string | null
          id?: string
          imported_at?: string | null
          logged_at?: string
          notes?: string | null
          source?: string
          unit: string
          user_id: string
          user_override?: boolean
          weight: number
        }
        Update: {
          created_at?: string
          dedup_key?: string | null
          device?: string | null
          id?: string
          imported_at?: string | null
          logged_at?: string
          notes?: string | null
          source?: string
          unit?: string
          user_id?: string
          user_override?: boolean
          weight?: number
        }
        Relationships: []
      }
      workout_logs: {
        Row: {
          activity_type: string
          created_at: string
          dedup_key: string | null
          device: string | null
          duration_minutes: number
          end_date: string
          id: string
          imported_at: string | null
          source: string
          start_date: string
          total_distance_meters: number | null
          total_energy_burned_kcal: number | null
          user_id: string
          user_override: boolean
        }
        Insert: {
          activity_type: string
          created_at?: string
          dedup_key?: string | null
          device?: string | null
          duration_minutes: number
          end_date: string
          id?: string
          imported_at?: string | null
          source: string
          start_date: string
          total_distance_meters?: number | null
          total_energy_burned_kcal?: number | null
          user_id: string
          user_override?: boolean
        }
        Update: {
          activity_type?: string
          created_at?: string
          dedup_key?: string | null
          device?: string | null
          duration_minutes?: number
          end_date?: string
          id?: string
          imported_at?: string | null
          source?: string
          start_date?: string
          total_distance_meters?: number | null
          total_energy_burned_kcal?: number | null
          user_id?: string
          user_override?: boolean
        }
        Relationships: []
      }
      workout_plan_item_alternatives: {
        Row: {
          cardio_intensity: string | null
          coaching_notes: string | null
          created_at: string
          duration_minutes: number | null
          exercise_id: string
          id: string
          intensity_type: string | null
          intensity_value: string | null
          provenance: Json | null
          rank: number
          reps_max: number | null
          reps_min: number | null
          score: number | null
          sets: number | null
          workout_plan_item_id: string
        }
        Insert: {
          cardio_intensity?: string | null
          coaching_notes?: string | null
          created_at?: string
          duration_minutes?: number | null
          exercise_id: string
          id?: string
          intensity_type?: string | null
          intensity_value?: string | null
          provenance?: Json | null
          rank: number
          reps_max?: number | null
          reps_min?: number | null
          score?: number | null
          sets?: number | null
          workout_plan_item_id: string
        }
        Update: {
          cardio_intensity?: string | null
          coaching_notes?: string | null
          created_at?: string
          duration_minutes?: number | null
          exercise_id?: string
          id?: string
          intensity_type?: string | null
          intensity_value?: string | null
          provenance?: Json | null
          rank?: number
          reps_max?: number | null
          reps_min?: number | null
          score?: number | null
          sets?: number | null
          workout_plan_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_plan_item_alternatives_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_plan_item_alternatives_workout_plan_item_id_fkey"
            columns: ["workout_plan_item_id"]
            isOneToOne: false
            referencedRelation: "workout_plan_items"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_plan_items: {
        Row: {
          cardio_intensity: string | null
          coaching_notes: string | null
          completed_at: string | null
          created_at: string
          day_of_week: number
          duration_minutes: number | null
          exercise_id: string
          id: string
          intensity_type: string | null
          intensity_value: string | null
          notes: string | null
          program_session_exercise_id: string | null
          provenance: Json | null
          reps: number | null
          reps_max: number | null
          reps_min: number | null
          scheduled_time: string | null
          session_order: number
          sets: number | null
          substituted: boolean
          template_slot_id: string | null
          user_id: string
          workout_plan_id: string
        }
        Insert: {
          cardio_intensity?: string | null
          coaching_notes?: string | null
          completed_at?: string | null
          created_at?: string
          day_of_week: number
          duration_minutes?: number | null
          exercise_id: string
          id?: string
          intensity_type?: string | null
          intensity_value?: string | null
          notes?: string | null
          program_session_exercise_id?: string | null
          provenance?: Json | null
          reps?: number | null
          reps_max?: number | null
          reps_min?: number | null
          scheduled_time?: string | null
          session_order?: number
          sets?: number | null
          substituted?: boolean
          template_slot_id?: string | null
          user_id: string
          workout_plan_id: string
        }
        Update: {
          cardio_intensity?: string | null
          coaching_notes?: string | null
          completed_at?: string | null
          created_at?: string
          day_of_week?: number
          duration_minutes?: number | null
          exercise_id?: string
          id?: string
          intensity_type?: string | null
          intensity_value?: string | null
          notes?: string | null
          program_session_exercise_id?: string | null
          provenance?: Json | null
          reps?: number | null
          reps_max?: number | null
          reps_min?: number | null
          scheduled_time?: string | null
          session_order?: number
          sets?: number | null
          substituted?: boolean
          template_slot_id?: string | null
          user_id?: string
          workout_plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_plan_items_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_plan_items_program_session_exercise_id_fkey"
            columns: ["program_session_exercise_id"]
            isOneToOne: false
            referencedRelation: "program_session_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_plan_items_template_slot_id_fkey"
            columns: ["template_slot_id"]
            isOneToOne: false
            referencedRelation: "template_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_plan_items_workout_plan_id_fkey"
            columns: ["workout_plan_id"]
            isOneToOne: false
            referencedRelation: "workout_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_plans: {
        Row: {
          created_at: string
          id: string
          phase_focus: string | null
          phase_week_number: number | null
          program_id: string | null
          program_phase_id: string | null
          sessions_per_week: number | null
          status: string
          updated_at: string
          user_id: string
          week_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          phase_focus?: string | null
          phase_week_number?: number | null
          program_id?: string | null
          program_phase_id?: string | null
          sessions_per_week?: number | null
          status?: string
          updated_at?: string
          user_id: string
          week_start: string
        }
        Update: {
          created_at?: string
          id?: string
          phase_focus?: string | null
          phase_week_number?: number | null
          program_id?: string | null
          program_phase_id?: string | null
          sessions_per_week?: number | null
          status?: string
          updated_at?: string
          user_id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_plans_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "training_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_plans_program_phase_id_fkey"
            columns: ["program_phase_id"]
            isOneToOne: false
            referencedRelation: "training_program_phases"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_visible_profile_names: {
        Args: { target_ids: string[] }
        Returns: {
          full_name: string
          id: string
        }[]
      }
      is_admin: { Args: { uid: string }; Returns: boolean }
      is_admin_owner: { Args: { uid: string }; Returns: boolean }
      is_trainer: { Args: { uid: string }; Returns: boolean }
      is_trainer_of: {
        Args: { p_client_id: string; p_trainer_id: string }
        Returns: boolean
      }
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
