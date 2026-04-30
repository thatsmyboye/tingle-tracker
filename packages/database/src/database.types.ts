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
          is_batch_import: boolean;
          plan: Database["public"]["Enums"]["creator_plan"];
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          subscription_status: Database["public"]["Enums"]["subscription_status"] | null;
          plan_expires_at: string | null;
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
          is_batch_import?: boolean;
          plan?: Database["public"]["Enums"]["creator_plan"];
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_status?: Database["public"]["Enums"]["subscription_status"] | null;
          plan_expires_at?: string | null;
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
          is_batch_import?: boolean;
          plan?: Database["public"]["Enums"]["creator_plan"];
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_status?: Database["public"]["Enums"]["subscription_status"] | null;
          plan_expires_at?: string | null;
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
      watched_channels: {
        Row: {
          id: string;
          youtube_channel_id: string;
          channel_title: string | null;
          uploads_playlist_id: string | null;
          latest_video_count: number;
          is_active: boolean;
          last_refreshed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          youtube_channel_id: string;
          channel_title?: string | null;
          uploads_playlist_id?: string | null;
          latest_video_count?: number;
          is_active?: boolean;
          last_refreshed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          youtube_channel_id?: string;
          channel_title?: string | null;
          uploads_playlist_id?: string | null;
          latest_video_count?: number;
          is_active?: boolean;
          last_refreshed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      trigger_tags: {
        Row: {
          id: string;
          label: string;
          slug: string;
          category: Database["public"]["Enums"]["trigger_category"];
          description: string | null;
          display_group: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          label: string;
          slug: string;
          category: Database["public"]["Enums"]["trigger_category"];
          description?: string | null;
          display_group?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          label?: string;
          slug?: string;
          category?: Database["public"]["Enums"]["trigger_category"];
          description?: string | null;
          display_group?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      trigger_tag_aliases: {
        Row: {
          alias_slug: string;
          trigger_tag_id: string;
        };
        Insert: {
          alias_slug: string;
          trigger_tag_id: string;
        };
        Update: {
          alias_slug?: string;
          trigger_tag_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trigger_tag_aliases_trigger_tag_id_fkey";
            columns: ["trigger_tag_id"];
            isOneToOne: false;
            referencedRelation: "trigger_tags";
            referencedColumns: ["id"];
          },
        ];
      };
      content: {
        Row: {
          id: string;
          creator_id: string | null;
          youtube_video_id: string;
          youtube_channel_id: string | null;
          channel_title: string | null;
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
          creator_id?: string | null;
          youtube_video_id: string;
          youtube_channel_id?: string | null;
          channel_title?: string | null;
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
          creator_id?: string | null;
          youtube_video_id?: string;
          youtube_channel_id?: string | null;
          channel_title?: string | null;
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
      content_trigger_moments: {
        Row: {
          id: string;
          content_id: string;
          trigger_tag_id: string;
          timestamp_ms: number;
          confidence: number | null;
          source: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          content_id: string;
          trigger_tag_id: string;
          timestamp_ms: number;
          confidence?: number | null;
          source?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          content_id?: string;
          trigger_tag_id?: string;
          timestamp_ms?: number;
          confidence?: number | null;
          source?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "content_trigger_moments_content_id_fkey";
            columns: ["content_id"];
            isOneToOne: false;
            referencedRelation: "content";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "content_trigger_moments_trigger_tag_id_fkey";
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
          is_admin: boolean;
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
          is_admin?: boolean;
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
          is_admin?: boolean;
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
      sleep_sessions: {
        Row: {
          id: string;
          user_id: string;
          content_id: string;
          fell_asleep: boolean | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          content_id: string;
          fell_asleep?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          content_id?: string;
          fell_asleep?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sleep_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sleep_sessions_content_id_fkey";
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
          predicted_heatmap: Json | null;
          audio_analysis_diagnostics: Json | null;
          audio_worker_status: string | null;
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
          predicted_heatmap?: Json | null;
          audio_analysis_diagnostics?: Json | null;
          audio_worker_status?: string | null;
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
          predicted_heatmap?: Json | null;
          audio_analysis_diagnostics?: Json | null;
          audio_worker_status?: string | null;
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
    Functions: {
      get_trending_content: {
        Args: { p_limit?: number };
        Returns: Array<{
          id: string;
          youtube_video_id: string;
          youtube_channel_id: string | null;
          channel_title: string | null;
          title: string;
          duration_seconds: number | null;
          thumbnail_url: string | null;
          creator_display_name: string | null;
          tingle_count: number;
        }>;
      };
    };
    Enums: {
      trigger_category: "visual" | "aural" | "tactile_adjacent";
      tingle_intensity: "1" | "2" | "3" | "4" | "5";
      content_status: "pending" | "processing" | "ready" | "error";
      insight_status: "pending" | "generating" | "ready" | "error";
      creator_plan: "free" | "pro" | "studio";
      subscription_status: "active" | "trialing" | "past_due" | "canceled" | "incomplete" | "incomplete_expired" | "unpaid" | "paused";
    };
    CompositeTypes: Record<string, never>;
  };
};
