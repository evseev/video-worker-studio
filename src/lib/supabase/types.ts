export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4";
  };
  public: {
    Tables: {
      projects: {
        Row: {
          aspect_ratio: string;
          background_music: string | null;
          caption_style: string | null;
          comparison_overlay_mode: string;
          created_at: string;
          draft_scenes: Json | null;
          id: string;
          image_motion: string;
          scene_transition: string;
          text_animation: string;
          render_error_context: Json | null;
          selected_template: string | null;
          status: string;
          topic: string;
          trend_validation_data: Json | null;
          updated_at: string;
          user_id: string;
          video_description: string | null;
          video_quality: string;
          video_tags: string | null;
          video_url: string | null;
          voiceover_url: string | null;
          wizard_step: string | null;
        };
        Insert: {
          aspect_ratio?: string;
          background_music?: string | null;
          caption_style?: string | null;
          comparison_overlay_mode?: string;
          created_at?: string;
          draft_scenes?: Json | null;
          id?: string;
          image_motion?: string;
          render_error_context?: Json | null;
          scene_transition?: string;
          selected_template?: string | null;
          status?: string;
          text_animation?: string;
          topic: string;
          trend_validation_data?: Json | null;
          updated_at?: string;
          user_id: string;
          video_description?: string | null;
          video_quality?: string;
          video_tags?: string | null;
          video_url?: string | null;
          voiceover_url?: string | null;
          wizard_step?: string | null;
        };
        Update: {
          aspect_ratio?: string;
          background_music?: string | null;
          caption_style?: string | null;
          comparison_overlay_mode?: string;
          created_at?: string;
          draft_scenes?: Json | null;
          id?: string;
          image_motion?: string;
          render_error_context?: Json | null;
          scene_transition?: string;
          selected_template?: string | null;
          status?: string;
          text_animation?: string;
          topic?: string;
          trend_validation_data?: Json | null;
          updated_at?: string;
          user_id?: string;
          video_description?: string | null;
          video_quality?: string;
          video_tags?: string | null;
          video_url?: string | null;
          voiceover_url?: string | null;
          wizard_step?: string | null;
        };
        Relationships: [];
      };
      scenes: {
        Row: {
          asset_url: string | null;
          created_at: string;
          id: string;
          project_id: string;
          script_text: string;
          search_keywords: string;
          sequence_order: number;
        };
        Insert: {
          asset_url?: string | null;
          created_at?: string;
          id?: string;
          project_id: string;
          script_text: string;
          search_keywords: string;
          sequence_order: number;
        };
        Update: {
          asset_url?: string | null;
          created_at?: string;
          id?: string;
          project_id?: string;
          script_text?: string;
          search_keywords?: string;
          sequence_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "scenes_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      worker_insert_scenes: {
        Args: { p_project_id: string; p_scenes: Json };
        Returns: undefined;
      };
      worker_update_project_status: {
        Args: { p_project_id: string; p_status: string; p_video_url?: string };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
