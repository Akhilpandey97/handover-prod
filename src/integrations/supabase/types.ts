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
      checklist_items: {
        Row: {
          comment: string | null
          comment_at: string | null
          comment_by: string | null
          completed: boolean | null
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          current_responsibility:
            | Database["public"]["Enums"]["responsibility_party"]
            | null
          id: string
          owner_team: Database["public"]["Enums"]["team_role"]
          phase: Database["public"]["Enums"]["project_phase"]
          project_id: string
          sort_order: number | null
          title: string
        }
        Insert: {
          comment?: string | null
          comment_at?: string | null
          comment_by?: string | null
          completed?: boolean | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          current_responsibility?:
            | Database["public"]["Enums"]["responsibility_party"]
            | null
          id?: string
          owner_team: Database["public"]["Enums"]["team_role"]
          phase: Database["public"]["Enums"]["project_phase"]
          project_id: string
          sort_order?: number | null
          title: string
        }
        Update: {
          comment?: string | null
          comment_at?: string | null
          comment_by?: string | null
          completed?: boolean | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          current_responsibility?:
            | Database["public"]["Enums"]["responsibility_party"]
            | null
          id?: string
          owner_team?: Database["public"]["Enums"]["team_role"]
          phase?: Database["public"]["Enums"]["project_phase"]
          project_id?: string
          sort_order?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_responsibility_logs: {
        Row: {
          checklist_item_id: string
          created_at: string | null
          ended_at: string | null
          id: string
          party: Database["public"]["Enums"]["responsibility_party"]
          started_at: string
        }
        Insert: {
          checklist_item_id: string
          created_at?: string | null
          ended_at?: string | null
          id?: string
          party: Database["public"]["Enums"]["responsibility_party"]
          started_at?: string
        }
        Update: {
          checklist_item_id?: string
          created_at?: string | null
          ended_at?: string | null
          id?: string
          party?: Database["public"]["Enums"]["responsibility_party"]
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_responsibility_logs_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "checklist_items"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          id: string
          name: string
          team: Database["public"]["Enums"]["team_role"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id: string
          name: string
          team: Database["public"]["Enums"]["team_role"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          team?: Database["public"]["Enums"]["team_role"]
          updated_at?: string | null
        }
        Relationships: []
      }
      project_responsibility_logs: {
        Row: {
          created_at: string | null
          ended_at: string | null
          id: string
          party: Database["public"]["Enums"]["responsibility_party"]
          phase: Database["public"]["Enums"]["project_phase"]
          project_id: string
          started_at: string
        }
        Insert: {
          created_at?: string | null
          ended_at?: string | null
          id?: string
          party: Database["public"]["Enums"]["responsibility_party"]
          phase: Database["public"]["Enums"]["project_phase"]
          project_id: string
          started_at?: string
        }
        Update: {
          created_at?: string | null
          ended_at?: string | null
          id?: string
          party?: Database["public"]["Enums"]["responsibility_party"]
          phase?: Database["public"]["Enums"]["project_phase"]
          project_id?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_responsibility_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          aov: number | null
          arr: number | null
          brand_url: string | null
          brd_link: string | null
          category: string | null
          created_at: string | null
          created_by: string | null
          current_owner_team: Database["public"]["Enums"]["team_role"] | null
          current_phase: Database["public"]["Enums"]["project_phase"] | null
          current_phase_comment: string | null
          current_responsibility:
            | Database["public"]["Enums"]["responsibility_party"]
            | null
          expected_go_live_date: string | null
          go_live_date: string | null
          go_live_percent: number | null
          id: string
          integration_checklist_link: string | null
          integration_type: string | null
          jira_link: string | null
          kick_off_date: string
          merchant_name: string
          mid: string
          mint_checklist_link: string | null
          mint_notes: string | null
          pending_acceptance: boolean | null
          pg_onboarding: string | null
          phase2_comment: string | null
          platform: string | null
          project_notes: string | null
          sales_spoc: string | null
          txns_per_day: number | null
          updated_at: string | null
        }
        Insert: {
          aov?: number | null
          arr?: number | null
          brand_url?: string | null
          brd_link?: string | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          current_owner_team?: Database["public"]["Enums"]["team_role"] | null
          current_phase?: Database["public"]["Enums"]["project_phase"] | null
          current_phase_comment?: string | null
          current_responsibility?:
            | Database["public"]["Enums"]["responsibility_party"]
            | null
          expected_go_live_date?: string | null
          go_live_date?: string | null
          go_live_percent?: number | null
          id?: string
          integration_checklist_link?: string | null
          integration_type?: string | null
          jira_link?: string | null
          kick_off_date: string
          merchant_name: string
          mid: string
          mint_checklist_link?: string | null
          mint_notes?: string | null
          pending_acceptance?: boolean | null
          pg_onboarding?: string | null
          phase2_comment?: string | null
          platform?: string | null
          project_notes?: string | null
          sales_spoc?: string | null
          txns_per_day?: number | null
          updated_at?: string | null
        }
        Update: {
          aov?: number | null
          arr?: number | null
          brand_url?: string | null
          brd_link?: string | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          current_owner_team?: Database["public"]["Enums"]["team_role"] | null
          current_phase?: Database["public"]["Enums"]["project_phase"] | null
          current_phase_comment?: string | null
          current_responsibility?:
            | Database["public"]["Enums"]["responsibility_party"]
            | null
          expected_go_live_date?: string | null
          go_live_date?: string | null
          go_live_percent?: number | null
          id?: string
          integration_checklist_link?: string | null
          integration_type?: string | null
          jira_link?: string | null
          kick_off_date?: string
          merchant_name?: string
          mid?: string
          mint_checklist_link?: string | null
          mint_notes?: string | null
          pending_acceptance?: boolean | null
          pg_onboarding?: string | null
          phase2_comment?: string | null
          platform?: string | null
          project_notes?: string | null
          sales_spoc?: string | null
          txns_per_day?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      transfer_history: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string | null
          from_team: Database["public"]["Enums"]["team_role"]
          id: string
          notes: string | null
          project_id: string
          to_team: Database["public"]["Enums"]["team_role"]
          transferred_at: string
          transferred_by: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string | null
          from_team: Database["public"]["Enums"]["team_role"]
          id?: string
          notes?: string | null
          project_id: string
          to_team: Database["public"]["Enums"]["team_role"]
          transferred_at?: string
          transferred_by: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string | null
          from_team?: Database["public"]["Enums"]["team_role"]
          id?: string
          notes?: string | null
          project_id?: string
          to_team?: Database["public"]["Enums"]["team_role"]
          transferred_at?: string
          transferred_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["team_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["team_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["team_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["team_role"]
      }
      is_manager: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      project_phase: "mint" | "integration" | "ms" | "completed"
      responsibility_party: "gokwik" | "merchant" | "neutral"
      team_role: "mint" | "integration" | "ms" | "manager"
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
      project_phase: ["mint", "integration", "ms", "completed"],
      responsibility_party: ["gokwik", "merchant", "neutral"],
      team_role: ["mint", "integration", "ms", "manager"],
    },
  },
} as const
