// Generado por `pnpm db:types` desde supabase/migrations. No editar a mano.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      account_snapshots: {
        Row: {
          created_at: string;
          data: Json;
          updated_at: string;
          user_id: string;
          version: number;
        };
        Insert: {
          created_at?: string;
          data: Json;
          updated_at?: string;
          user_id: string;
          version?: number;
        };
        Update: {
          created_at?: string;
          data?: Json;
          updated_at?: string;
          user_id?: string;
          version?: number;
        };
        Relationships: [];
      };
      achievements: {
        Row: {
          coins: number;
          cosmetic_key: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          ends_at: string | null;
          icon_key: string | null;
          id: string;
          is_active: boolean;
          is_sample: boolean;
          is_secret: boolean;
          key: string;
          key_version: number;
          points: number;
          scope: Database['public']['Enums']['achievement_scope'];
          season_id: string | null;
          starts_at: string | null;
          supersedes_id: string | null;
          title: string;
          trigger_params: Json;
          trigger_type: Database['public']['Enums']['achievement_trigger'];
          updated_at: string;
          version: number;
        };
        Insert: {
          coins?: number;
          cosmetic_key?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          ends_at?: string | null;
          icon_key?: string | null;
          id?: string;
          is_active?: boolean;
          is_sample?: boolean;
          is_secret?: boolean;
          key: string;
          key_version?: number;
          points?: number;
          scope?: Database['public']['Enums']['achievement_scope'];
          season_id?: string | null;
          starts_at?: string | null;
          supersedes_id?: string | null;
          title: string;
          trigger_params?: Json;
          trigger_type: Database['public']['Enums']['achievement_trigger'];
          updated_at?: string;
          version?: number;
        };
        Update: {
          coins?: number;
          cosmetic_key?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          ends_at?: string | null;
          icon_key?: string | null;
          id?: string;
          is_active?: boolean;
          is_sample?: boolean;
          is_secret?: boolean;
          key?: string;
          key_version?: number;
          points?: number;
          scope?: Database['public']['Enums']['achievement_scope'];
          season_id?: string | null;
          starts_at?: string | null;
          supersedes_id?: string | null;
          title?: string;
          trigger_params?: Json;
          trigger_type?: Database['public']['Enums']['achievement_trigger'];
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'achievements_season_id_fkey';
            columns: ['season_id'];
            isOneToOne: false;
            referencedRelation: 'seasons';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'achievements_supersedes_id_fkey';
            columns: ['supersedes_id'];
            isOneToOne: false;
            referencedRelation: 'achievements';
            referencedColumns: ['id'];
          },
        ];
      };
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          actor_role: string;
          created_at: string;
          entity_id: string | null;
          entity_type: string;
          id: number;
          new_value: Json | null;
          old_value: Json | null;
          reason: string | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          actor_role: string;
          created_at?: string;
          entity_id?: string | null;
          entity_type: string;
          id?: never;
          new_value?: Json | null;
          old_value?: Json | null;
          reason?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          actor_role?: string;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string;
          id?: never;
          new_value?: Json | null;
          old_value?: Json | null;
          reason?: string | null;
        };
        Relationships: [];
      };
      bottle_reads: {
        Row: {
          bottle_id: string;
          read_at: string;
          reader_id: string;
        };
        Insert: {
          bottle_id: string;
          read_at?: string;
          reader_id: string;
        };
        Update: {
          bottle_id?: string;
          read_at?: string;
          reader_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'bottle_reads_bottle_id_fkey';
            columns: ['bottle_id'];
            isOneToOne: false;
            referencedRelation: 'bottles';
            referencedColumns: ['id'];
          },
        ];
      };
      bottle_reports: {
        Row: {
          bottle_id: string;
          created_at: string;
          id: string;
          reason: string | null;
          reporter_id: string;
          resolution: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
        };
        Insert: {
          bottle_id: string;
          created_at?: string;
          id?: string;
          reason?: string | null;
          reporter_id: string;
          resolution?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
        };
        Update: {
          bottle_id?: string;
          created_at?: string;
          id?: string;
          reason?: string | null;
          reporter_id?: string;
          resolution?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'bottle_reports_bottle_id_fkey';
            columns: ['bottle_id'];
            isOneToOne: false;
            referencedRelation: 'bottles';
            referencedColumns: ['id'];
          },
        ];
      };
      bottles: {
        Row: {
          created_at: string;
          id: string;
          message: string;
          moderated_at: string | null;
          moderated_by: string | null;
          season_id: string | null;
          status: Database['public']['Enums']['bottle_status'];
          updated_at: string;
          user_id: string;
          version: number;
          x: number;
          y: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          message: string;
          moderated_at?: string | null;
          moderated_by?: string | null;
          season_id?: string | null;
          status?: Database['public']['Enums']['bottle_status'];
          updated_at?: string;
          user_id: string;
          version?: number;
          x: number;
          y: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          message?: string;
          moderated_at?: string | null;
          moderated_by?: string | null;
          season_id?: string | null;
          status?: Database['public']['Enums']['bottle_status'];
          updated_at?: string;
          user_id?: string;
          version?: number;
          x?: number;
          y?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'bottles_season_id_fkey';
            columns: ['season_id'];
            isOneToOne: false;
            referencedRelation: 'seasons';
            referencedColumns: ['id'];
          },
        ];
      };
      calitas_comments: {
        Row: {
          body: string;
          created_at: string;
          hidden_at: string | null;
          hidden_by: string | null;
          hidden_reason: string | null;
          id: string;
          parent_id: string | null;
          user_id: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          hidden_at?: string | null;
          hidden_by?: string | null;
          hidden_reason?: string | null;
          id?: string;
          parent_id?: string | null;
          user_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          hidden_at?: string | null;
          hidden_by?: string | null;
          hidden_reason?: string | null;
          id?: string;
          parent_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'calitas_comments_parent_id_fkey';
            columns: ['parent_id'];
            isOneToOne: false;
            referencedRelation: 'calitas_comments';
            referencedColumns: ['id'];
          },
        ];
      };
      calitas_votes: {
        Row: {
          comment_id: string;
          created_at: string;
          user_id: string;
          value: number;
        };
        Insert: {
          comment_id: string;
          created_at?: string;
          user_id: string;
          value: number;
        };
        Update: {
          comment_id?: string;
          created_at?: string;
          user_id?: string;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'calitas_votes_comment_id_fkey';
            columns: ['comment_id'];
            isOneToOne: false;
            referencedRelation: 'calitas_comments';
            referencedColumns: ['id'];
          },
        ];
      };
      canon_boards: {
        Row: {
          boss: string;
          created_at: string;
          dawn_ms: number;
          gold_min_ms: number;
          is_active: boolean;
          max_ms: number;
          max_score: number;
          min_ms: number;
          name: string;
          version: number;
        };
        Insert: {
          boss: string;
          created_at?: string;
          dawn_ms: number;
          gold_min_ms: number;
          is_active?: boolean;
          max_ms: number;
          max_score: number;
          min_ms: number;
          name: string;
          version: number;
        };
        Update: {
          boss?: string;
          created_at?: string;
          dawn_ms?: number;
          gold_min_ms?: number;
          is_active?: boolean;
          max_ms?: number;
          max_score?: number;
          min_ms?: number;
          name?: string;
          version?: number;
        };
        Relationships: [];
      };
      canon_scores: {
        Row: {
          attempts: number;
          best_at: string;
          best_score: number;
          board_version: number;
          boss: string;
          difficulty: string;
          duration_ms: number;
          medal: string | null;
          updated_at: string;
          user_id: string;
          void_reason: string | null;
          voided_at: string | null;
          voided_by: string | null;
        };
        Insert: {
          attempts?: number;
          best_at?: string;
          best_score: number;
          board_version: number;
          boss: string;
          difficulty: string;
          duration_ms: number;
          medal?: string | null;
          updated_at?: string;
          user_id: string;
          void_reason?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
        };
        Update: {
          attempts?: number;
          best_at?: string;
          best_score?: number;
          board_version?: number;
          boss?: string;
          difficulty?: string;
          duration_ms?: number;
          medal?: string | null;
          updated_at?: string;
          user_id?: string;
          void_reason?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'canon_scores_boss_board_version_fkey';
            columns: ['boss', 'board_version'];
            isOneToOne: false;
            referencedRelation: 'canon_boards';
            referencedColumns: ['boss', 'version'];
          },
        ];
      };
      carnet_answers: {
        Row: {
          answer: string;
          created_at: string;
          question_id: string;
          question_version: number;
          updated_at: string;
          user_id: string;
          version: number;
        };
        Insert: {
          answer: string;
          created_at?: string;
          question_id: string;
          question_version: number;
          updated_at?: string;
          user_id: string;
          version?: number;
        };
        Update: {
          answer?: string;
          created_at?: string;
          question_id?: string;
          question_version?: number;
          updated_at?: string;
          user_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'carnet_answers_question_id_fkey';
            columns: ['question_id'];
            isOneToOne: false;
            referencedRelation: 'carnet_questions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'carnet_answers_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'carnets';
            referencedColumns: ['user_id'];
          },
        ];
      };
      carnet_questions: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          position: number;
          prompt: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          created_at?: string;
          id: string;
          is_active?: boolean;
          position: number;
          prompt: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          position?: number;
          prompt?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [];
      };
      carnets: {
        Row: {
          avatar_image: string | null;
          avatar_key: string | null;
          avatar_moderated: boolean;
          created_at: string;
          hidden_at: string | null;
          is_artist: boolean;
          member_number: number;
          member_since: string;
          music_platform: string | null;
          music_url: string | null;
          nickname: string;
          nickname_moderated: boolean;
          updated_at: string;
          user_id: string;
          version: number;
        };
        Insert: {
          avatar_image?: string | null;
          avatar_key?: string | null;
          avatar_moderated?: boolean;
          created_at?: string;
          hidden_at?: string | null;
          is_artist?: boolean;
          member_number?: number;
          member_since?: string;
          music_platform?: string | null;
          music_url?: string | null;
          nickname: string;
          nickname_moderated?: boolean;
          updated_at?: string;
          user_id: string;
          version?: number;
        };
        Update: {
          avatar_image?: string | null;
          avatar_key?: string | null;
          avatar_moderated?: boolean;
          created_at?: string;
          hidden_at?: string | null;
          is_artist?: boolean;
          member_number?: number;
          member_since?: string;
          music_platform?: string | null;
          music_url?: string | null;
          nickname?: string;
          nickname_moderated?: boolean;
          updated_at?: string;
          user_id?: string;
          version?: number;
        };
        Relationships: [];
      };
      castle_boards: {
        Row: {
          castle_life: number;
          config_version: number;
          difficulty: string;
          duration_ms: number;
          is_active: boolean;
          life_bonus: number;
          max_kill_points: number;
          max_ms: number;
          min_ms: number;
          run_min: number;
          version: number;
        };
        Insert: {
          castle_life: number;
          config_version: number;
          difficulty: string;
          duration_ms: number;
          is_active?: boolean;
          life_bonus: number;
          max_kill_points: number;
          max_ms: number;
          min_ms: number;
          run_min: number;
          version: number;
        };
        Update: {
          castle_life?: number;
          config_version?: number;
          difficulty?: string;
          duration_ms?: number;
          is_active?: boolean;
          life_bonus?: number;
          max_kill_points?: number;
          max_ms?: number;
          min_ms?: number;
          run_min?: number;
          version?: number;
        };
        Relationships: [];
      };
      castle_scores: {
        Row: {
          attempts: number;
          best_at: string;
          best_score: number;
          board_version: number;
          castle_life: number;
          difficulty: string;
          duration_ms: number;
          end_reason: string;
          medal: string | null;
          run_min: number;
          updated_at: string;
          user_id: string;
          void_reason: string | null;
          voided_at: string | null;
          voided_by: string | null;
        };
        Insert: {
          attempts?: number;
          best_at?: string;
          best_score: number;
          board_version: number;
          castle_life: number;
          difficulty: string;
          duration_ms: number;
          end_reason: string;
          medal?: string | null;
          run_min: number;
          updated_at?: string;
          user_id: string;
          void_reason?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
        };
        Update: {
          attempts?: number;
          best_at?: string;
          best_score?: number;
          board_version?: number;
          castle_life?: number;
          difficulty?: string;
          duration_ms?: number;
          end_reason?: string;
          medal?: string | null;
          run_min?: number;
          updated_at?: string;
          user_id?: string;
          void_reason?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'castle_scores_run_min_difficulty_board_version_fkey';
            columns: ['run_min', 'difficulty', 'board_version'];
            isOneToOne: false;
            referencedRelation: 'castle_boards';
            referencedColumns: ['run_min', 'difficulty', 'version'];
          },
        ];
      };
      circuits: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          laps: number;
          max_ms: number;
          min_ms: number;
          name: string;
          version: number;
        };
        Insert: {
          created_at?: string;
          id: string;
          is_active?: boolean;
          laps?: number;
          max_ms: number;
          min_ms: number;
          name: string;
          version: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          laps?: number;
          max_ms?: number;
          min_ms?: number;
          name?: string;
          version?: number;
        };
        Relationships: [];
      };
      coin_balances: {
        Row: {
          coins: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          coins?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          coins?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      consents: {
        Row: {
          created_at: string;
          granted: boolean;
          id: number;
          kind: string;
          policy_version: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          granted: boolean;
          id?: never;
          kind: string;
          policy_version: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          granted?: boolean;
          id?: never;
          kind?: string;
          policy_version?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      cosmetics: {
        Row: {
          base: boolean;
          created_at: string;
          for_ship: string | null;
          id: string;
          is_active: boolean;
          is_sample: boolean;
          name: string;
          price_coins: number | null;
          slot: string;
          unlock_achievement: string | null;
          unlock_mission: string | null;
          unlock_points: number | null;
          updated_at: string;
          version: number;
        };
        Insert: {
          base?: boolean;
          created_at?: string;
          for_ship?: string | null;
          id: string;
          is_active?: boolean;
          is_sample?: boolean;
          name: string;
          price_coins?: number | null;
          slot: string;
          unlock_achievement?: string | null;
          unlock_mission?: string | null;
          unlock_points?: number | null;
          updated_at?: string;
          version?: number;
        };
        Update: {
          base?: boolean;
          created_at?: string;
          for_ship?: string | null;
          id?: string;
          is_active?: boolean;
          is_sample?: boolean;
          name?: string;
          price_coins?: number | null;
          slot?: string;
          unlock_achievement?: string | null;
          unlock_mission?: string | null;
          unlock_points?: number | null;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'cosmetics_for_ship_fkey';
            columns: ['for_ship'];
            isOneToOne: false;
            referencedRelation: 'cosmetics';
            referencedColumns: ['id'];
          },
        ];
      };
      discounts: {
        Row: {
          ends_at: string | null;
          event_ref: string | null;
          id: string;
          is_active: boolean;
          is_sample: boolean;
          scope: string;
          starts_at: string | null;
          updated_at: string;
          version: number;
        };
        Insert: {
          ends_at?: string | null;
          event_ref?: string | null;
          id: string;
          is_active?: boolean;
          is_sample?: boolean;
          scope?: string;
          starts_at?: string | null;
          updated_at?: string;
          version?: number;
        };
        Update: {
          ends_at?: string | null;
          event_ref?: string | null;
          id?: string;
          is_active?: boolean;
          is_sample?: boolean;
          scope?: string;
          starts_at?: string | null;
          updated_at?: string;
          version?: number;
        };
        Relationships: [];
      };
      equipped_cosmetics: {
        Row: {
          cosmetic_id: string;
          slot: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          cosmetic_id: string;
          slot: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          cosmetic_id?: string;
          slot?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'equipped_cosmetics_cosmetic_id_fkey';
            columns: ['cosmetic_id'];
            isOneToOne: false;
            referencedRelation: 'cosmetics';
            referencedColumns: ['id'];
          },
        ];
      };
      event_attendance: {
        Row: {
          event_id: string;
          scanned_at: string;
          scanned_by: string | null;
          source: string;
          user_id: string;
        };
        Insert: {
          event_id: string;
          scanned_at?: string;
          scanned_by?: string | null;
          source: string;
          user_id: string;
        };
        Update: {
          event_id?: string;
          scanned_at?: string;
          scanned_by?: string | null;
          source?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'event_attendance_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
        ];
      };
      event_albums: {
        Row: {
          created_at: string;
          created_by: string | null;
          event_date: string | null;
          event_finished: boolean;
          event_id: string;
          id: string;
          island_id: string;
          title: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          event_date?: string | null;
          event_finished?: boolean;
          event_id: string;
          id: string;
          island_id: string;
          title: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          event_date?: string | null;
          event_finished?: boolean;
          event_id?: string;
          id?: string;
          island_id?: string;
          title?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [];
      };
      event_photos: {
        Row: {
          album_id: string;
          alt: string;
          created_at: string;
          created_by: string | null;
          height: number;
          id: string;
          kind: string;
          poster_url: string | null;
          url: string;
          width: number;
        };
        Insert: {
          album_id: string;
          alt: string;
          created_at?: string;
          created_by?: string | null;
          height: number;
          id: string;
          kind?: string;
          poster_url?: string | null;
          url: string;
          width: number;
        };
        Update: {
          album_id?: string;
          alt?: string;
          created_at?: string;
          created_by?: string | null;
          height?: number;
          id?: string;
          kind?: string;
          poster_url?: string | null;
          url?: string;
          width?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'event_photos_album_id_fkey';
            columns: ['album_id'];
            isOneToOne: false;
            referencedRelation: 'event_albums';
            referencedColumns: ['id'];
          },
        ];
      };
      event_secrets: {
        Row: {
          event_id: string;
          notes: string | null;
          secret_address: string | null;
          updated_at: string;
          version: number;
        };
        Insert: {
          event_id: string;
          notes?: string | null;
          secret_address?: string | null;
          updated_at?: string;
          version?: number;
        };
        Update: {
          event_id?: string;
          notes?: string | null;
          secret_address?: string | null;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'event_secrets_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: true;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
        ];
      };
      event_stamp_codes: {
        Row: {
          code: string;
          created_at: string;
          event_id: string;
          updated_at: string;
          valid_from: string;
          valid_until: string;
          version: number;
        };
        Insert: {
          code: string;
          created_at?: string;
          event_id: string;
          updated_at?: string;
          valid_from: string;
          valid_until: string;
          version?: number;
        };
        Update: {
          code?: string;
          created_at?: string;
          event_id?: string;
          updated_at?: string;
          valid_from?: string;
          valid_until?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'event_stamp_codes_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: true;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
        ];
      };
      events: {
        Row: {
          activities: Json;
          archived_at: string | null;
          cancelled_island_mode: Database['public']['Enums']['cancelled_island_mode'] | null;
          cancelled_message: string | null;
          created_at: string;
          door_only: boolean;
          door_price_cents: number | null;
          created_by: string | null;
          description: string | null;
          ends_at: string | null;
          excluded_from_home: boolean;
          format: string;
          id: string;
          is_sample: boolean;
          island_id: string | null;
          lineup: Json;
          place_announced: boolean;
          poster_key: string | null;
          postponed_message: string | null;
          price_cents: number | null;
          published_at: string | null;
          sale_starts_at: string | null;
          slug: string;
          stamp_image_url: string | null;
          starts_at: string | null;
          state: Database['public']['Enums']['event_state'];
          state_locked: boolean;
          ticket_provider: string | null;
          ticket_provider_event_id: string | null;
          ticket_url: string | null;
          timezone: string;
          title: string;
          updated_at: string;
          venue_public: string | null;
          version: number;
        };
        Insert: {
          activities?: Json;
          archived_at?: string | null;
          cancelled_island_mode?: Database['public']['Enums']['cancelled_island_mode'] | null;
          cancelled_message?: string | null;
          created_at?: string;
          door_only?: boolean;
          door_price_cents?: number | null;
          created_by?: string | null;
          description?: string | null;
          ends_at?: string | null;
          excluded_from_home?: boolean;
          format?: string;
          id?: string;
          is_sample?: boolean;
          island_id?: string | null;
          lineup?: Json;
          place_announced?: boolean;
          poster_key?: string | null;
          postponed_message?: string | null;
          price_cents?: number | null;
          published_at?: string | null;
          sale_starts_at?: string | null;
          slug: string;
          stamp_image_url?: string | null;
          starts_at?: string | null;
          state?: Database['public']['Enums']['event_state'];
          state_locked?: boolean;
          ticket_provider?: string | null;
          ticket_provider_event_id?: string | null;
          ticket_url?: string | null;
          timezone?: string;
          title: string;
          updated_at?: string;
          venue_public?: string | null;
          version?: number;
        };
        Update: {
          activities?: Json;
          archived_at?: string | null;
          cancelled_island_mode?: Database['public']['Enums']['cancelled_island_mode'] | null;
          cancelled_message?: string | null;
          created_at?: string;
          door_only?: boolean;
          door_price_cents?: number | null;
          created_by?: string | null;
          description?: string | null;
          ends_at?: string | null;
          excluded_from_home?: boolean;
          format?: string;
          id?: string;
          is_sample?: boolean;
          island_id?: string | null;
          lineup?: Json;
          place_announced?: boolean;
          poster_key?: string | null;
          postponed_message?: string | null;
          price_cents?: number | null;
          published_at?: string | null;
          sale_starts_at?: string | null;
          slug?: string;
          stamp_image_url?: string | null;
          starts_at?: string | null;
          state?: Database['public']['Enums']['event_state'];
          state_locked?: boolean;
          ticket_provider?: string | null;
          ticket_provider_event_id?: string | null;
          ticket_url?: string | null;
          timezone?: string;
          title?: string;
          updated_at?: string;
          venue_public?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'events_island_id_fkey';
            columns: ['island_id'];
            isOneToOne: false;
            referencedRelation: 'islands';
            referencedColumns: ['id'];
          },
        ];
      };
      home_blocks: {
        Row: {
          block_type: Database['public']['Enums']['home_block_type'];
          config: Json;
          created_at: string;
          id: string;
          is_sample: boolean;
          is_visible: boolean;
          position: number;
          updated_at: string;
          updated_by: string | null;
          version: number;
          visible_from: string | null;
          visible_until: string | null;
        };
        Insert: {
          block_type: Database['public']['Enums']['home_block_type'];
          config?: Json;
          created_at?: string;
          id?: string;
          is_sample?: boolean;
          is_visible?: boolean;
          position: number;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
          visible_from?: string | null;
          visible_until?: string | null;
        };
        Update: {
          block_type?: Database['public']['Enums']['home_block_type'];
          config?: Json;
          created_at?: string;
          id?: string;
          is_sample?: boolean;
          is_visible?: boolean;
          position?: number;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
          visible_from?: string | null;
          visible_until?: string | null;
        };
        Relationships: [];
      };
      home_revisions: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          is_sample: boolean;
          note: string | null;
          number: number;
          published_at: string | null;
          published_by: string | null;
          snapshot: Json;
          status: Database['public']['Enums']['revision_status'];
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_sample?: boolean;
          note?: string | null;
          number: number;
          published_at?: string | null;
          published_by?: string | null;
          snapshot: Json;
          status?: Database['public']['Enums']['revision_status'];
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_sample?: boolean;
          note?: string | null;
          number?: number;
          published_at?: string | null;
          published_by?: string | null;
          snapshot?: Json;
          status?: Database['public']['Enums']['revision_status'];
        };
        Relationships: [];
      };
      islands: {
        Row: {
          archived_at: string | null;
          created_at: string;
          id: string;
          is_sample: boolean;
          name: string;
          slug: string;
          summary: string | null;
          updated_at: string;
          version: number;
        };
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          is_sample?: boolean;
          name: string;
          slug: string;
          summary?: string | null;
          updated_at?: string;
          version?: number;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          is_sample?: boolean;
          name?: string;
          slug?: string;
          summary?: string | null;
          updated_at?: string;
          version?: number;
        };
        Relationships: [];
      };
      ledger_transactions: {
        Row: {
          achievement_id: string | null;
          action: string | null;
          coins_delta: number;
          compensates_id: string | null;
          cosmetic_key: string | null;
          created_at: string;
          created_by: string | null;
          event_id: string | null;
          id: string;
          kind: Database['public']['Enums']['ledger_kind'];
          metadata: Json;
          occurred_at: string;
          points_delta: number;
          purchase_id: string | null;
          reason: string | null;
          season_id: string | null;
          source_ref: string | null;
          user_id: string;
        };
        Insert: {
          achievement_id?: string | null;
          action?: string | null;
          coins_delta?: number;
          compensates_id?: string | null;
          cosmetic_key?: string | null;
          created_at?: string;
          created_by?: string | null;
          event_id?: string | null;
          id: string;
          kind: Database['public']['Enums']['ledger_kind'];
          metadata?: Json;
          occurred_at?: string;
          points_delta?: number;
          purchase_id?: string | null;
          reason?: string | null;
          season_id?: string | null;
          source_ref?: string | null;
          user_id: string;
        };
        Update: {
          achievement_id?: string | null;
          action?: string | null;
          coins_delta?: number;
          compensates_id?: string | null;
          cosmetic_key?: string | null;
          created_at?: string;
          created_by?: string | null;
          event_id?: string | null;
          id?: string;
          kind?: Database['public']['Enums']['ledger_kind'];
          metadata?: Json;
          occurred_at?: string;
          points_delta?: number;
          purchase_id?: string | null;
          reason?: string | null;
          season_id?: string | null;
          source_ref?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ledger_transactions_achievement_id_fkey';
            columns: ['achievement_id'];
            isOneToOne: false;
            referencedRelation: 'achievements';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ledger_transactions_compensates_id_fkey';
            columns: ['compensates_id'];
            isOneToOne: true;
            referencedRelation: 'ledger_transactions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ledger_transactions_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ledger_transactions_purchase_id_fkey';
            columns: ['purchase_id'];
            isOneToOne: false;
            referencedRelation: 'purchases';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ledger_transactions_season_id_fkey';
            columns: ['season_id'];
            isOneToOne: false;
            referencedRelation: 'seasons';
            referencedColumns: ['id'];
          },
        ];
      };
      point_actions: {
        Row: {
          action: string;
          client_allowed: boolean;
          daily_coins: number;
          daily_points: number;
          description: string;
          max_coins: number;
          max_points: number;
          policies: string[];
          ref_pattern: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          action: string;
          client_allowed?: boolean;
          daily_coins: number;
          daily_points: number;
          description: string;
          max_coins: number;
          max_points: number;
          policies: string[];
          ref_pattern: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          action?: string;
          client_allowed?: boolean;
          daily_coins?: number;
          daily_points?: number;
          description?: string;
          max_coins?: number;
          max_points?: number;
          policies?: string[];
          ref_pattern?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [];
      };
      point_balances: {
        Row: {
          points: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          points?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          points?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      purchases: {
        Row: {
          cancelled_at: string | null;
          confirmed_at: string | null;
          created_at: string;
          event_id: string;
          id: string;
          provider: string;
          provider_order_id: string | null;
          quantity: number;
          refunded_at: string | null;
          status: Database['public']['Enums']['purchase_status'];
          updated_at: string;
          user_id: string | null;
          version: number;
        };
        Insert: {
          cancelled_at?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
          event_id: string;
          id?: string;
          provider: string;
          provider_order_id?: string | null;
          quantity?: number;
          refunded_at?: string | null;
          status?: Database['public']['Enums']['purchase_status'];
          updated_at?: string;
          user_id?: string | null;
          version?: number;
        };
        Update: {
          cancelled_at?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
          event_id?: string;
          id?: string;
          provider?: string;
          provider_order_id?: string | null;
          quantity?: number;
          refunded_at?: string | null;
          status?: Database['public']['Enums']['purchase_status'];
          updated_at?: string;
          user_id?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'purchases_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
        ];
      };
      race_times: {
        Row: {
          attempts: number;
          best_at: string;
          best_ms: number;
          circuit_id: string;
          circuit_version: number;
          updated_at: string;
          user_id: string;
          void_reason: string | null;
          voided_at: string | null;
          voided_by: string | null;
        };
        Insert: {
          attempts?: number;
          best_at?: string;
          best_ms: number;
          circuit_id: string;
          circuit_version: number;
          updated_at?: string;
          user_id: string;
          void_reason?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
        };
        Update: {
          attempts?: number;
          best_at?: string;
          best_ms?: number;
          circuit_id?: string;
          circuit_version?: number;
          updated_at?: string;
          user_id?: string;
          void_reason?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'race_times_circuit_id_circuit_version_fkey';
            columns: ['circuit_id', 'circuit_version'];
            isOneToOne: false;
            referencedRelation: 'circuits';
            referencedColumns: ['id', 'version'];
          },
        ];
      };
      season_points: {
        Row: {
          points: number;
          season_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          points?: number;
          season_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          points?: number;
          season_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'season_points_season_id_fkey';
            columns: ['season_id'];
            isOneToOne: false;
            referencedRelation: 'seasons';
            referencedColumns: ['id'];
          },
        ];
      };
      seasons: {
        Row: {
          active_world_revision_id: string | null;
          created_at: string;
          ends_at: string | null;
          id: string;
          is_active: boolean;
          is_sample: boolean;
          name: string;
          slug: string;
          starts_at: string | null;
          updated_at: string;
          version: number;
          world_draft: Json;
        };
        Insert: {
          active_world_revision_id?: string | null;
          created_at?: string;
          ends_at?: string | null;
          id?: string;
          is_active?: boolean;
          is_sample?: boolean;
          name: string;
          slug: string;
          starts_at?: string | null;
          updated_at?: string;
          version?: number;
          world_draft?: Json;
        };
        Update: {
          active_world_revision_id?: string | null;
          created_at?: string;
          ends_at?: string | null;
          id?: string;
          is_active?: boolean;
          is_sample?: boolean;
          name?: string;
          slug?: string;
          starts_at?: string | null;
          updated_at?: string;
          version?: number;
          world_draft?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'seasons_active_world_revision_id_fkey';
            columns: ['active_world_revision_id'];
            isOneToOne: false;
            referencedRelation: 'world_revisions';
            referencedColumns: ['id'];
          },
        ];
      };
      site_settings: {
        Row: {
          active_home_revision_id: string | null;
          id: boolean;
          updated_at: string;
          version: number;
        };
        Insert: {
          active_home_revision_id?: string | null;
          id?: boolean;
          updated_at?: string;
          version?: number;
        };
        Update: {
          active_home_revision_id?: string | null;
          id?: boolean;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'site_settings_active_home_revision_id_fkey';
            columns: ['active_home_revision_id'];
            isOneToOne: false;
            referencedRelation: 'home_revisions';
            referencedColumns: ['id'];
          },
        ];
      };
      staff_roles: {
        Row: {
          granted_at: string;
          granted_by: string | null;
          role: Database['public']['Enums']['staff_role'];
          updated_at: string;
          user_id: string;
          version: number;
        };
        Insert: {
          granted_at?: string;
          granted_by?: string | null;
          role: Database['public']['Enums']['staff_role'];
          updated_at?: string;
          user_id: string;
          version?: number;
        };
        Update: {
          granted_at?: string;
          granted_by?: string | null;
          role?: Database['public']['Enums']['staff_role'];
          updated_at?: string;
          user_id?: string;
          version?: number;
        };
        Relationships: [];
      };
      stamps: {
        Row: {
          event_id: string;
          granted_at: string;
          purchase_id: string | null;
          revoked_at: string | null;
          revoked_by_tx: string | null;
          tx_id: string;
          user_id: string;
        };
        Insert: {
          event_id: string;
          granted_at?: string;
          purchase_id?: string | null;
          revoked_at?: string | null;
          revoked_by_tx?: string | null;
          tx_id: string;
          user_id: string;
        };
        Update: {
          event_id?: string;
          granted_at?: string;
          purchase_id?: string | null;
          revoked_at?: string | null;
          revoked_by_tx?: string | null;
          tx_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'stamps_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'stamps_purchase_id_fkey';
            columns: ['purchase_id'];
            isOneToOne: false;
            referencedRelation: 'purchases';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'stamps_revoked_by_tx_fkey';
            columns: ['revoked_by_tx'];
            isOneToOne: false;
            referencedRelation: 'ledger_transactions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'stamps_tx_id_fkey';
            columns: ['tx_id'];
            isOneToOne: true;
            referencedRelation: 'ledger_transactions';
            referencedColumns: ['id'];
          },
        ];
      };
      ticketing_settings: {
        Row: {
          common_discount_code: string | null;
          id: boolean;
          updated_at: string;
          version: number;
        };
        Insert: {
          common_discount_code?: string | null;
          id?: boolean;
          updated_at?: string;
          version?: number;
        };
        Update: {
          common_discount_code?: string | null;
          id?: boolean;
          updated_at?: string;
          version?: number;
        };
        Relationships: [];
      };
      user_achievements: {
        Row: {
          achievement_id: string;
          awarded_at: string;
          revoked_at: string | null;
          revoked_by_tx: string | null;
          tx_id: string;
          user_id: string;
        };
        Insert: {
          achievement_id: string;
          awarded_at?: string;
          revoked_at?: string | null;
          revoked_by_tx?: string | null;
          tx_id: string;
          user_id: string;
        };
        Update: {
          achievement_id?: string;
          awarded_at?: string;
          revoked_at?: string | null;
          revoked_by_tx?: string | null;
          tx_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_achievements_achievement_id_fkey';
            columns: ['achievement_id'];
            isOneToOne: false;
            referencedRelation: 'achievements';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_achievements_revoked_by_tx_fkey';
            columns: ['revoked_by_tx'];
            isOneToOne: false;
            referencedRelation: 'ledger_transactions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_achievements_tx_id_fkey';
            columns: ['tx_id'];
            isOneToOne: true;
            referencedRelation: 'ledger_transactions';
            referencedColumns: ['id'];
          },
        ];
      };
      user_cosmetics: {
        Row: {
          cosmetic_key: string;
          revoked_at: string | null;
          revoked_by_tx: string | null;
          tx_id: string;
          unlocked_at: string;
          user_id: string;
        };
        Insert: {
          cosmetic_key: string;
          revoked_at?: string | null;
          revoked_by_tx?: string | null;
          tx_id: string;
          unlocked_at?: string;
          user_id: string;
        };
        Update: {
          cosmetic_key?: string;
          revoked_at?: string | null;
          revoked_by_tx?: string | null;
          tx_id?: string;
          unlocked_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_cosmetics_revoked_by_tx_fkey';
            columns: ['revoked_by_tx'];
            isOneToOne: false;
            referencedRelation: 'ledger_transactions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_cosmetics_tx_id_fkey';
            columns: ['tx_id'];
            isOneToOne: true;
            referencedRelation: 'ledger_transactions';
            referencedColumns: ['id'];
          },
        ];
      };
      user_discounts: {
        Row: {
          discount_id: string;
          found_at: string;
          used_at: string | null;
          used_event: string | null;
          user_id: string;
        };
        Insert: {
          discount_id: string;
          found_at?: string;
          used_at?: string | null;
          used_event?: string | null;
          user_id: string;
        };
        Update: {
          discount_id?: string;
          found_at?: string;
          used_at?: string | null;
          used_event?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_discounts_discount_id_fkey';
            columns: ['discount_id'];
            isOneToOne: false;
            referencedRelation: 'discounts';
            referencedColumns: ['id'];
          },
        ];
      };
      world_objects: {
        Row: {
          category: string;
          created_at: string;
          data: Json;
          deleted_at: string | null;
          enabled: boolean;
          id: string;
          is_sample: boolean;
          island_id: string | null;
          object_key: string;
          season_id: string;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        Insert: {
          category: string;
          created_at?: string;
          data: Json;
          deleted_at?: string | null;
          enabled?: boolean;
          id?: string;
          is_sample?: boolean;
          island_id?: string | null;
          object_key: string;
          season_id: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          category?: string;
          created_at?: string;
          data?: Json;
          deleted_at?: string | null;
          enabled?: boolean;
          id?: string;
          is_sample?: boolean;
          island_id?: string | null;
          object_key?: string;
          season_id?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'world_objects_island_id_fkey';
            columns: ['island_id'];
            isOneToOne: false;
            referencedRelation: 'islands';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'world_objects_season_id_fkey';
            columns: ['season_id'];
            isOneToOne: false;
            referencedRelation: 'seasons';
            referencedColumns: ['id'];
          },
        ];
      };
      world_revisions: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          is_sample: boolean;
          note: string | null;
          number: number;
          published_at: string | null;
          published_by: string | null;
          schema_version: number;
          season_id: string;
          snapshot: Json;
          status: Database['public']['Enums']['revision_status'];
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_sample?: boolean;
          note?: string | null;
          number: number;
          published_at?: string | null;
          published_by?: string | null;
          schema_version?: number;
          season_id: string;
          snapshot: Json;
          status?: Database['public']['Enums']['revision_status'];
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_sample?: boolean;
          note?: string | null;
          number?: number;
          published_at?: string | null;
          published_by?: string | null;
          schema_version?: number;
          season_id?: string;
          snapshot?: Json;
          status?: Database['public']['Enums']['revision_status'];
        };
        Relationships: [
          {
            foreignKeyName: 'world_revisions_season_id_fkey';
            columns: ['season_id'];
            isOneToOne: false;
            referencedRelation: 'seasons';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      admin_backup_codes_left: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      admin_artist_link_info: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      admin_calitas_list: {
        Args: {
          p_limit?: number;
        };
        Returns: Json;
      };
      admin_delete_member: {
        Args: {
          p_user: string;
          p_reason: string;
        };
        Returns: undefined;
      };
      admin_dismiss_bottle_report: {
        Args: {
          p_report: string;
          p_reason?: string;
        };
        Returns: Json;
      };
      admin_generate_backup_codes: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      admin_list_carnets: {
        Args: {
          p_search?: string;
          p_moderated_only?: boolean;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: Json;
      };
      admin_list_members: {
        Args: {
          p_search?: string;
          p_news_only?: boolean;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: {
          user_id: string;
          email: string;
          nickname: string;
          member_number: number;
          member_since: string;
          signed_up_at: string;
          is_artist: boolean;
          news: boolean;
          news_at: string;
          news_version: string;
          privacy_version: string;
          privacy_at: string;
          total: number;
        }[];
      };
      admin_list_voided: {
        Args: {
          p_limit?: number;
        };
        Returns: Json;
      };
      admin_moderate_carnet: {
        Args: {
          p_user: string;
          p_action: string;
          p_reason?: string;
        };
        Returns: Json;
      };
      admin_moderate_comment: {
        Args: {
          p_comment: string;
          p_action: string;
          p_reason?: string;
        };
        Returns: Json;
      };
      admin_remove_bottle: {
        Args: {
          p_bottle: string;
          p_reason: string;
        };
        Returns: Json;
      };
      admin_restore_bottle: {
        Args: {
          p_bottle: string;
          p_reason?: string;
        };
        Returns: Json;
      };
      admin_restore_score: {
        Args: {
          p_board: string;
          p_user: string;
          p_key: string;
          p_version: number;
          p_reason?: string;
        };
        Returns: Json;
      };
      admin_rotate_artist_link: {
        Args: {
          p_reason?: string;
        };
        Returns: Json;
      };
      admin_set_artist: {
        Args: {
          p_user: string;
          p_is_artist: boolean;
          p_reason?: string;
        };
        Returns: Json;
      };
      admin_set_member_number: {
        Args: {
          p_user: string;
          p_number: number;
          p_reason?: string;
        };
        Returns: Json;
      };
      admin_set_stamp_code: {
        Args: {
          p_event: string;
          p_valid_from: string;
          p_valid_until: string;
          p_regenerate?: boolean;
        };
        Returns: Json;
      };
      admin_set_common_discount_code: {
        Args: {
          p_code?: string;
          p_reason?: string;
        };
        Returns: Json;
      };
      admin_set_stamp_image: {
        Args: {
          p_event: string;
          p_url?: string;
          p_reason?: string;
        };
        Returns: Json;
      };
      admin_sign_in_email: {
        Args: {
          p_number: number;
        };
        Returns: string | null;
      };
      admin_use_backup_code: {
        Args: {
          p_code: string;
        };
        Returns: Json;
      };
      admin_void_points: {
        Args: {
          p_tx: string;
          p_reason: string;
        };
        Returns: Json;
      };
      admin_void_score: {
        Args: {
          p_board: string;
          p_user: string;
          p_key: string;
          p_version: number;
          p_reason: string;
        };
        Returns: Json;
      };
      admin_void_race_time: {
        Args: {
          p_user: string;
          p_circuit: string;
          p_version: number;
          p_reason: string;
        };
        Returns: Json;
      };
      assign_admin_carnet: {
        Args: {
          p_user: string;
        };
        Returns: Json;
      };
      award_points: {
        Args: {
          p_action: string;
          p_ref: string;
          p_points?: number;
          p_coins?: number;
          p_policy?: string;
          p_metadata?: Json;
        };
        Returns: Json;
      };
      buy_cosmetic: {
        Args: {
          p_cosmetic: string;
        };
        Returns: Json;
      };
      calitas_list: {
        Args: {
          p_limit?: number;
        };
        Returns: Json;
      };
      calitas_post: {
        Args: {
          p_body: string;
          p_parent?: string;
        };
        Returns: Json;
      };
      calitas_vote: {
        Args: {
          p_comment: string;
          p_value: number;
        };
        Returns: Json;
      };
      claim_stamp: {
        Args: {
          p_event: string;
          p_code: string;
        };
        Returns: Json;
      };
      discount_code_for: {
        Args: {
          p_discount: string;
        };
        Returns: string;
      };
      delete_my_account: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      export_my_data: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      equip_cosmetic: {
        Args: {
          p_slot: string;
          p_cosmetic?: string;
        };
        Returns: Json;
      };
      find_discount: {
        Args: {
          p_discount: string;
        };
        Returns: Json;
      };
      latest_bottles: {
        Args: {
          p_limit?: number;
        };
        Returns: {
          id: string;
          message: string;
          x: number;
          y: number;
          author_id: string;
          author_nickname: string;
          is_mine: boolean;
          created_at: string;
          updated_at: string;
        }[];
      };
      merge_guest: {
        Args: {
          p_payload: Json;
        };
        Returns: Json;
      };
      my_staff_role: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      nickname_status: {
        Args: {
          p_nickname: string;
        };
        Returns: string;
      };
      place_bottle: {
        Args: {
          p_message: string;
          p_x: number;
          p_y: number;
        };
        Returns: Json;
      };
      ranking_canon: {
        Args: {
          p_boss: string;
          p_version?: number;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: Json;
      };
      ranking_castle: {
        Args: {
          p_run_min: number;
          p_difficulty: string;
          p_version?: number;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: Json;
      };
      ranking_points: {
        Args: {
          p_limit?: number;
          p_offset?: number;
        };
        Returns: Json;
      };
      ranking_race: {
        Args: {
          p_circuit: string;
          p_version?: number;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: Json;
      };
      ranking_season: {
        Args: {
          p_season?: string;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: Json;
      };
      save_profile: {
        Args: {
          p_nickname: string;
          p_avatar_key?: string;
          p_avatar_image?: string;
          p_privacy_version?: string;
          p_news?: boolean;
          p_artist_code?: string;
        };
        Returns: Json;
      };
      save_snapshot: {
        Args: {
          p_data: Json;
          p_base_version?: number;
        };
        Returns: Json;
      };
      set_artist_music: {
        Args: {
          p_platform?: string;
          p_url?: string;
        };
        Returns: Json;
      };
      set_news_opt_in: {
        Args: {
          p_news: boolean;
        };
        Returns: Json;
      };
      submit_canon_score: {
        Args: {
          p_boss: string;
          p_version: number;
          p_score: number;
          p_ms: number;
          p_medal?: string;
          p_difficulty?: string;
        };
        Returns: Json;
      };
      submit_castle_score: {
        Args: {
          p_run_min: number;
          p_difficulty: string;
          p_version: number;
          p_score: number;
          p_ms: number;
          p_medal: string;
          p_end: string;
          p_life: number;
          p_ranked: boolean;
        };
        Returns: Json;
      };
      staff_stamp: {
        Args: {
          p_member: string;
          p_event: string;
          p_source?: string;
          p_reason?: string;
        };
        Returns: Json;
      };
      submit_race_time: {
        Args: {
          p_circuit: string;
          p_version: number;
          p_ms: number;
        };
        Returns: Json;
      };
      use_discount: {
        Args: {
          p_discount: string;
          p_event?: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      achievement_scope: 'global' | 'season';
      achievement_trigger:
        | 'visit_island'
        | 'find_buoy'
        | 'collect_objects'
        | 'complete_circuit'
        | 'time_played'
        | 'buy_ticket'
        | 'rescue_character'
        | 'deliver_character'
        | 'win_minigame'
        | 'complete_encounter'
        | 'read_bottle'
        | 'throw_bottle'
        | 'create_carnet'
        | 'answer_question'
        | 'visit_world'
        | 'play_minigame'
        | 'defeat_boss';
      bottle_status: 'active' | 'retired' | 'removed';
      cancelled_island_mode: 'memory' | 'notice';
      event_state:
        'draft' | 'coming_soon' | 'on_sale' | 'sold_out' | 'postponed' | 'cancelled' | 'finished';
      home_block_type:
        | 'hero'
        | 'priority_event'
        | 'upcoming_events'
        | 'artists'
        | 'philosophy'
        | 'photos'
        | 'store'
        | 'contact'
        | 'footer';
      ledger_kind:
        'world_reward' | 'achievement' | 'stamp' | 'cosmetic' | 'adjustment' | 'compensation';
      purchase_status: 'pending' | 'confirmed' | 'refunded' | 'cancelled';
      revision_status: 'draft' | 'published';
      staff_role: 'editor' | 'admin' | 'owner';
    };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicSchema = Database['public'];

export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row'];
export type TablesInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Update'];
export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T];

export const Constants = {
  public: {
    Enums: {
      achievement_scope: ['global', 'season'],
      achievement_trigger: [
        'visit_island',
        'find_buoy',
        'collect_objects',
        'complete_circuit',
        'time_played',
        'buy_ticket',
        'rescue_character',
        'deliver_character',
        'win_minigame',
        'complete_encounter',
        'read_bottle',
        'throw_bottle',
        'create_carnet',
        'answer_question',
        'visit_world',
        'play_minigame',
        'defeat_boss',
      ],
      bottle_status: ['active', 'retired', 'removed'],
      cancelled_island_mode: ['memory', 'notice'],
      event_state: [
        'draft',
        'coming_soon',
        'on_sale',
        'sold_out',
        'postponed',
        'cancelled',
        'finished',
      ],
      home_block_type: [
        'hero',
        'priority_event',
        'upcoming_events',
        'artists',
        'philosophy',
        'photos',
        'store',
        'contact',
        'footer',
      ],
      ledger_kind: [
        'world_reward',
        'achievement',
        'stamp',
        'cosmetic',
        'adjustment',
        'compensation',
      ],
      purchase_status: ['pending', 'confirmed', 'refunded', 'cancelled'],
      revision_status: ['draft', 'published'],
      staff_role: ['editor', 'admin', 'owner'],
    },
  },
} as const;
