// =============================================================================
// Auto-generated Supabase types
// DO NOT EDIT MANUALLY
// Regenerate with: pnpm --filter @tingle/database generate-types
// =============================================================================

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      creators: {
        Row: {
          id: string;
          user_id: string;
          display_name: string;
          bio: string | null;
          avatar_url: string | null;
          youtube_channel_id: string | null;
          youtube_channel_url: string | null;
          is_verified: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          display_name: string;
          bio?: string | null;
          avatar_url?: string | null;
          youtube_channel_id?: string | null;
          youtube_channel_url?: string | null;
          is_verified?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          display_name?: string;
          bio?: string | null;
          avatar_url?: string | null;
          youtube_channel_id?: string | null;
          youtube_channel_url?: string | null;
          is_verified?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "creators_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      trigger_tags: {
        Row: {
          id: string;
          label: string;
          slug: string;
          category: Database["public"]["Enums"]["trigger_category"];
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          label: string;
          slug: string;
          category: Database["public"]["Enums"]["trigger_category"];
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          label?: string;
          slug?: string;
          category?: Database["public"]["Enums"]["trigger_category"];
          description?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      content: {
        Row: {
          id: string;
          creator_id: string;
          youtube_video_id: string;
          title: string;
          description: string | null;
          duration_seconds: number | null;
          thumbnail_url: string | null;
          published_at: string | null;
          status: Database["public"]["Enums"]["content_status"];
          transcript_available: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          creator_id: string;
          youtube_video_id: string;
          title: string;
          description?: string | null;
          duration_seconds?: number | null;
          thumbnail_url?: string | null;
          published_at?: string | null;
          status?: Database["public"]["Enums"]["content_status"];
          transcript_available?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          creator_id?: string;
          youtube_video_id?: string;
          title?: string;
          description?: string | null;
          duration_seconds?: number | null;
          thumbnail_url?: string | null;
          published_at?: string | null;
          status?: Database["public"]["Enums"]["content_status"];
          transcript_available?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "content_creator_id_fkey";
            columns: ["creator_id"];
            isOneToOne: false;
            referencedRelation: "creators";
            referencedColumns: ["id"];
          },
        ];
      };
      content_triggers: {
        Row: {
          id: string;
          content_id: string;
          trigger_tag_id: string;
          source: string;
          confidence: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          content_id: string;
          trigger_tag_id: string;
          source?: string;
          confidence?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          content_id?: string;
          trigger_tag_id?: string;
          source?: string;
          confidence?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "content_triggers_content_id_fkey";
            columns: ["content_id"];
            isOneToOne: false;
            referencedRelation: "content";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "content_triggers_trigger_tag_id_fkey";
            columns: ["trigger_tag_id"];
            isOneToOne: false;
            referencedRelation: "trigger_tags";
            referencedColumns: ["id"];
          },
        ];
      };
      user_profiles: {
        Row: {
          id: string;
          user_id: string;
          display_name: string | null;
          avatar_url: string | null;
          is_creator: boolean;
          preferred_trigger_ids: Json;
          discovery_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          is_creator?: boolean;
          preferred_trigger_ids?: Json;
          discovery_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          is_creator?: boolean;
          preferred_trigger_ids?: Json;
          discovery_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_profiles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      tingle_events: {
        Row: {
          id: string;
          user_id: string;
          content_id: string;
          timestamp_ms: number;
          intensity: Database["public"]["Enums"]["tingle_intensity"];
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          content_id: string;
          timestamp_ms: number;
          intensity?: Database["public"]["Enums"]["tingle_intensity"];
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          content_id?: string;
          timestamp_ms?: number;
          intensity?: Database["public"]["Enums"]["tingle_intensity"];
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tingle_events_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tingle_events_content_id_fkey";
            columns: ["content_id"];
            isOneToOne: false;
            referencedRelation: "content";
            referencedColumns: ["id"];
          },
        ];
      };
      insights_cache: {
        Row: {
          id: string;
          content_id: string;
          status: Database["public"]["Enums"]["insight_status"];
          report: Json | null;
          error_message: string | null;
          generated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          content_id: string;
          status?: Database["public"]["Enums"]["insight_status"];
          report?: Json | null;
          error_message?: string | null;
          generated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          content_id?: string;
          status?: Database["public"]["Enums"]["insight_status"];
          report?: Json | null;
          error_message?: string | null;
          generated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "insights_cache_content_id_fkey";
            columns: ["content_id"];
            isOneToOne: true;
            referencedRelation: "content";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      content_tingle_heatmap: {
        Row: {
          content_id: string | null;
          bucket_start_ms: number | null;
          tingle_count: number | null;
          avg_intensity: number | null;
        };
        Relationships: [];
      };
      creator_top_triggers: {
        Row: {
          creator_id: string | null;
          trigger_tag_id: string | null;
          trigger_label: string | null;
          trigger_category: Database["public"]["Enums"]["trigger_category"] | null;
          total_tingles: number | null;
          avg_intensity: number | null;
        };
        Relationships: [];
      };
      user_trigger_affinity: {
        Row: {
          user_id: string | null;
          trigger_tag_id: string | null;
          trigger_label: string | null;
          trigger_category: Database["public"]["Enums"]["trigger_category"] | null;
          tingle_count: number | null;
          avg_intensity: number | null;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: {
      trigger_category: "visual" | "aural" | "tactile_adjacent";
      tingle_intensity: "1" | "2" | "3" | "4" | "5";
      content_status: "pending" | "processing" | "ready" | "error";
      insight_status: "pending" | "generating" | "ready" | "error";
    };
    CompositeTypes: Record<string, never>;
  };
};
