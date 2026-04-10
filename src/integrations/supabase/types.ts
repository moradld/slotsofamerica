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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      admin_notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          status: string
          title: string
          transaction_id: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          status?: string
          title: string
          transaction_id?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          status?: string
          title?: string
          transaction_id?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          body: string
          conversation_log_id: string | null
          created_at: string
          direction: string
          id: string
          image_url: string | null
          user_id: string
        }
        Insert: {
          body: string
          conversation_log_id?: string | null
          created_at?: string
          direction?: string
          id?: string
          image_url?: string | null
          user_id: string
        }
        Update: {
          body?: string
          conversation_log_id?: string | null
          created_at?: string
          direction?: string
          id?: string
          image_url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_log_id_fkey"
            columns: ["conversation_log_id"]
            isOneToOne: false
            referencedRelation: "ghl_conversation_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body_html: string
          category: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          subject: string
          transaction_type: string
          trigger_event: string | null
          updated_at: string
        }
        Insert: {
          body_html: string
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          subject: string
          transaction_type: string
          trigger_event?: string | null
          updated_at?: string
        }
        Update: {
          body_html?: string
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          subject?: string
          transaction_type?: string
          trigger_event?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      email_verifications: {
        Row: {
          attempts: number
          created_at: string
          email: string
          expires_at: string
          id: string
          otp_hash: string
          user_id: string
          verified: boolean
        }
        Insert: {
          attempts?: number
          created_at?: string
          email: string
          expires_at: string
          id?: string
          otp_hash: string
          user_id: string
          verified?: boolean
        }
        Update: {
          attempts?: number
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          otp_hash?: string
          user_id?: string
          verified?: boolean
        }
        Relationships: []
      }
      game_accounts: {
        Row: {
          assigned_to: string | null
          created_at: string
          game_id: string
          id: string
          password_hash: string
          status: string
          updated_at: string
          username: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          game_id: string
          id?: string
          password_hash: string
          status?: string
          updated_at?: string
          username: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          game_id?: string
          id?: string
          password_hash?: string
          status?: string
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_accounts_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_unlock_requests: {
        Row: {
          admin_note: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          email: string
          game_id: string
          game_password: string | null
          id: string
          status: string
          user_id: string
          username: string
        }
        Insert: {
          admin_note?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          email: string
          game_id: string
          game_password?: string | null
          id?: string
          status?: string
          user_id: string
          username: string
        }
        Update: {
          admin_note?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          email?: string
          game_id?: string
          game_password?: string | null
          id?: string
          status?: string
          user_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_unlock_requests_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          android_url: string | null
          created_at: string
          description: string | null
          download_url: string | null
          id: string
          image_url: string | null
          ios_url: string | null
          is_active: boolean
          name: string
          updated_at: string
          web_url: string | null
        }
        Insert: {
          android_url?: string | null
          created_at?: string
          description?: string | null
          download_url?: string | null
          id?: string
          image_url?: string | null
          ios_url?: string | null
          is_active?: boolean
          name: string
          updated_at?: string
          web_url?: string | null
        }
        Update: {
          android_url?: string | null
          created_at?: string
          description?: string | null
          download_url?: string | null
          id?: string
          image_url?: string | null
          ios_url?: string | null
          is_active?: boolean
          name?: string
          updated_at?: string
          web_url?: string | null
        }
        Relationships: []
      }
      ghl_conversation_logs: {
        Row: {
          amount: number
          assigned_to: string | null
          chat_status: string
          contact_id: string | null
          conversation_id: string | null
          conversation_mode: string | null
          created_at: string
          error_message: string | null
          game_name: string | null
          game_username: string | null
          id: string
          message_body: string | null
          status: string
          transaction_type: string
          user_id: string
        }
        Insert: {
          amount: number
          assigned_to?: string | null
          chat_status?: string
          contact_id?: string | null
          conversation_id?: string | null
          conversation_mode?: string | null
          created_at?: string
          error_message?: string | null
          game_name?: string | null
          game_username?: string | null
          id?: string
          message_body?: string | null
          status?: string
          transaction_type: string
          user_id: string
        }
        Update: {
          amount?: number
          assigned_to?: string | null
          chat_status?: string
          contact_id?: string | null
          conversation_id?: string | null
          conversation_mode?: string | null
          created_at?: string
          error_message?: string | null
          game_name?: string | null
          game_username?: string | null
          id?: string
          message_body?: string | null
          status?: string
          transaction_type?: string
          user_id?: string
        }
        Relationships: []
      }
      ghl_user_conversations: {
        Row: {
          contact_id: string
          conversation_id: string
          created_at: string
          id: string
          is_open: boolean
          last_message_at: string
          transaction_id: string | null
          transaction_type: string
          user_id: string
        }
        Insert: {
          contact_id: string
          conversation_id: string
          created_at?: string
          id?: string
          is_open?: boolean
          last_message_at?: string
          transaction_id?: string | null
          transaction_type: string
          user_id: string
        }
        Update: {
          contact_id?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_open?: boolean
          last_message_at?: string
          transaction_id?: string | null
          transaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ghl_user_conversations_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_chat_messages: {
        Row: {
          body: string
          created_at: string
          direction: string
          ghl_message_id: string | null
          id: string
          session_id: string
          source: string | null
        }
        Insert: {
          body: string
          created_at?: string
          direction?: string
          ghl_message_id?: string | null
          id?: string
          session_id: string
          source?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          direction?: string
          ghl_message_id?: string | null
          id?: string
          session_id?: string
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "landing_chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "landing_chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_chat_sessions: {
        Row: {
          created_at: string
          email: string | null
          ghl_contact_id: string | null
          ghl_conversation_id: string | null
          id: string
          last_message_at: string
          name: string
          phone: string | null
          user_id: string | null
          visitor_token: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          ghl_contact_id?: string | null
          ghl_conversation_id?: string | null
          id?: string
          last_message_at?: string
          name: string
          phone?: string | null
          user_id?: string | null
          visitor_token: string
        }
        Update: {
          created_at?: string
          email?: string | null
          ghl_contact_id?: string | null
          ghl_conversation_id?: string | null
          id?: string
          last_message_at?: string
          name?: string
          phone?: string | null
          user_id?: string | null
          visitor_token?: string
        }
        Relationships: []
      }
      manual_verification_requests: {
        Row: {
          admin_note: string | null
          contact: string
          created_at: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          type: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          contact: string
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          type?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          contact?: string
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          category: string
          created_at: string
          id: string
          is_read: boolean
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      otp_verifications: {
        Row: {
          attempts: number
          contact: string
          created_at: string
          expires_at: string
          id: string
          otp_hash: string
          type: string
          user_id: string
          verified: boolean
        }
        Insert: {
          attempts?: number
          contact: string
          created_at?: string
          expires_at: string
          id?: string
          otp_hash: string
          type: string
          user_id: string
          verified?: boolean
        }
        Update: {
          attempts?: number
          contact?: string
          created_at?: string
          expires_at?: string
          id?: string
          otp_hash?: string
          type?: string
          user_id?: string
          verified?: boolean
        }
        Relationships: []
      }
      password_requests: {
        Row: {
          created_at: string
          game_account_id: string
          id: string
          rejection_reason: string | null
          requested_password: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          game_account_id: string
          id?: string
          rejection_reason?: string | null
          requested_password?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          game_account_id?: string
          id?: string
          rejection_reason?: string | null
          requested_password?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_gateway_accounts: {
        Row: {
          account_name: string
          account_number: string
          created_at: string
          deep_link: string | null
          gateway_id: string
          id: string
          is_active: boolean
          priority_order: number
          qr_code_url: string | null
          updated_at: string
        }
        Insert: {
          account_name: string
          account_number: string
          created_at?: string
          deep_link?: string | null
          gateway_id: string
          id?: string
          is_active?: boolean
          priority_order?: number
          qr_code_url?: string | null
          updated_at?: string
        }
        Update: {
          account_name?: string
          account_number?: string
          created_at?: string
          deep_link?: string | null
          gateway_id?: string
          id?: string
          is_active?: boolean
          priority_order?: number
          qr_code_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_gateway_accounts_gateway_id_fkey"
            columns: ["gateway_id"]
            isOneToOne: false
            referencedRelation: "payment_gateways"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_gateways: {
        Row: {
          address: string
          created_at: string
          deep_link: string | null
          id: string
          instructions: string | null
          is_active: boolean
          logo_url: string | null
          minimum_amount: number
          name: string
          qr_code_url: string | null
          updated_at: string
        }
        Insert: {
          address: string
          created_at?: string
          deep_link?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean
          logo_url?: string | null
          minimum_amount?: number
          name: string
          qr_code_url?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          created_at?: string
          deep_link?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean
          logo_url?: string | null
          minimum_amount?: number
          name?: string
          qr_code_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      phone_verifications: {
        Row: {
          attempts: number
          created_at: string
          expires_at: string
          id: string
          otp_code: string
          phone: string
          user_id: string
          verified: boolean
        }
        Insert: {
          attempts?: number
          created_at?: string
          expires_at: string
          id?: string
          otp_code: string
          phone: string
          user_id: string
          verified?: boolean
        }
        Update: {
          attempts?: number
          created_at?: string
          expires_at?: string
          id?: string
          otp_code?: string
          phone?: string
          user_id?: string
          verified?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          balance: number
          country: string | null
          created_at: string
          date_of_birth: string | null
          display_name: string | null
          email: string | null
          email_notifications: boolean
          email_verified: boolean
          email_verified_at: string | null
          email_verified_by_admin: boolean
          first_name: string | null
          flagged_at: string | null
          flagged_reason: string | null
          gender: string | null
          id: string
          is_flagged: boolean
          last_name: string | null
          phone: string | null
          phone_verified: boolean
          phone_verified_at: string | null
          state: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          balance?: number
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          email?: string | null
          email_notifications?: boolean
          email_verified?: boolean
          email_verified_at?: string | null
          email_verified_by_admin?: boolean
          first_name?: string | null
          flagged_at?: string | null
          flagged_reason?: string | null
          gender?: string | null
          id: string
          is_flagged?: boolean
          last_name?: string | null
          phone?: string | null
          phone_verified?: boolean
          phone_verified_at?: string | null
          state?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          balance?: number
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          email?: string | null
          email_notifications?: boolean
          email_verified?: boolean
          email_verified_at?: string | null
          email_verified_by_admin?: boolean
          first_name?: string | null
          flagged_at?: string | null
          flagged_reason?: string | null
          gender?: string | null
          id?: string
          is_flagged?: boolean
          last_name?: string | null
          phone?: string | null
          phone_verified?: boolean
          phone_verified_at?: string | null
          state?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      reward_history: {
        Row: {
          amount: number
          created_at: string
          id: string
          reward_key: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          reward_key: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          reward_key?: string
          user_id?: string
        }
        Relationships: []
      }
      rewards_config: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          key: string
          updated_at: string
          value: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          key: string
          updated_at?: string
          value?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          key?: string
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      security_events: {
        Row: {
          created_at: string
          details: Json | null
          event_type: string
          id: string
          ip_address: string | null
          severity: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          event_type: string
          id?: string
          ip_address?: string | null
          severity?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
          ip_address?: string | null
          severity?: string
          user_id?: string | null
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          body_scripts: string | null
          colors: Json | null
          created_at: string
          custom_css: string | null
          favicon_url: string | null
          fonts: Json | null
          footer_scripts: string | null
          ghl_api_key: string | null
          ghl_assigned_user_id: string | null
          ghl_conversation_mode: string
          ghl_location_id: string | null
          header_scripts: string | null
          id: string
          landing_page_config: Json | null
          logo_url: string | null
          messenger_link: string | null
          nav_links: Json | null
          seo_description: string | null
          seo_keywords: string | null
          seo_title: string | null
          site_name: string | null
          telegram_link: string | null
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          body_scripts?: string | null
          colors?: Json | null
          created_at?: string
          custom_css?: string | null
          favicon_url?: string | null
          fonts?: Json | null
          footer_scripts?: string | null
          ghl_api_key?: string | null
          ghl_assigned_user_id?: string | null
          ghl_conversation_mode?: string
          ghl_location_id?: string | null
          header_scripts?: string | null
          id?: string
          landing_page_config?: Json | null
          logo_url?: string | null
          messenger_link?: string | null
          nav_links?: Json | null
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          site_name?: string | null
          telegram_link?: string | null
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          body_scripts?: string | null
          colors?: Json | null
          created_at?: string
          custom_css?: string | null
          favicon_url?: string | null
          fonts?: Json | null
          footer_scripts?: string | null
          ghl_api_key?: string | null
          ghl_assigned_user_id?: string | null
          ghl_conversation_mode?: string
          ghl_location_id?: string | null
          header_scripts?: string | null
          id?: string
          landing_page_config?: Json | null
          logo_url?: string | null
          messenger_link?: string | null
          nav_links?: Json | null
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          site_name?: string | null
          telegram_link?: string | null
          updated_at?: string
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      support_channels: {
        Row: {
          created_at: string
          icon: string
          id: string
          is_active: boolean
          link: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          link: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          link?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      transaction_logs: {
        Row: {
          action: string
          action_at: string
          action_by: string
          id: string
          new_amount: number | null
          new_status: string | null
          note: string | null
          old_amount: number | null
          old_status: string | null
          transaction_id: string
        }
        Insert: {
          action: string
          action_at?: string
          action_by: string
          id?: string
          new_amount?: number | null
          new_status?: string | null
          note?: string | null
          old_amount?: number | null
          old_status?: string | null
          transaction_id: string
        }
        Update: {
          action?: string
          action_at?: string
          action_by?: string
          id?: string
          new_amount?: number | null
          new_status?: string | null
          note?: string | null
          old_amount?: number | null
          old_status?: string | null
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_logs_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          deposit_proof_url: string | null
          game_id: string | null
          id: string
          notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          deposit_proof_url?: string | null
          game_id?: string | null
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          deposit_proof_url?: string | null
          game_id?: string | null
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      verification_codes: {
        Row: {
          attempts: number
          code: string
          created_at: string
          expires_at: string
          id: string
          type: string
          user_id: string
          verified: boolean
        }
        Insert: {
          attempts?: number
          code: string
          created_at?: string
          expires_at: string
          id?: string
          type: string
          user_id: string
          verified?: boolean
        }
        Update: {
          attempts?: number
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          type?: string
          user_id?: string
          verified?: boolean
        }
        Relationships: []
      }
      verification_settings: {
        Row: {
          email_verification_enabled: boolean
          id: string
          max_attempts: number
          max_per_hour: number
          otp_expiry_minutes: number
          phone_verification_enabled: boolean
          resend_cooldown_seconds: number
          smtp_email: string | null
          smtp_host: string | null
          smtp_password: string | null
          smtp_port: number | null
          updated_at: string
        }
        Insert: {
          email_verification_enabled?: boolean
          id?: string
          max_attempts?: number
          max_per_hour?: number
          otp_expiry_minutes?: number
          phone_verification_enabled?: boolean
          resend_cooldown_seconds?: number
          smtp_email?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          updated_at?: string
        }
        Update: {
          email_verification_enabled?: boolean
          id?: string
          max_attempts?: number
          max_per_hour?: number
          otp_expiry_minutes?: number
          phone_verification_enabled?: boolean
          resend_cooldown_seconds?: number
          smtp_email?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      withdraw_methods: {
        Row: {
          created_at: string
          custom_fields: Json
          id: string
          is_active: boolean
          logo_url: string | null
          max_amount: number
          min_amount: number
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_fields?: Json
          id?: string
          is_active?: boolean
          logo_url?: string | null
          max_amount?: number
          min_amount?: number
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_fields?: Json
          id?: string
          is_active?: boolean
          logo_url?: string | null
          max_amount?: number
          min_amount?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      site_settings_public: {
        Row: {
          body_scripts: string | null
          colors: Json | null
          created_at: string | null
          custom_css: string | null
          favicon_url: string | null
          fonts: Json | null
          footer_scripts: string | null
          header_scripts: string | null
          id: string | null
          landing_page_config: Json | null
          logo_url: string | null
          messenger_link: string | null
          nav_links: Json | null
          seo_description: string | null
          seo_keywords: string | null
          seo_title: string | null
          site_name: string | null
          telegram_link: string | null
          updated_at: string | null
          whatsapp_number: string | null
        }
        Insert: {
          body_scripts?: string | null
          colors?: Json | null
          created_at?: string | null
          custom_css?: string | null
          favicon_url?: string | null
          fonts?: Json | null
          footer_scripts?: string | null
          header_scripts?: string | null
          id?: string | null
          landing_page_config?: Json | null
          logo_url?: string | null
          messenger_link?: string | null
          nav_links?: Json | null
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          site_name?: string | null
          telegram_link?: string | null
          updated_at?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          body_scripts?: string | null
          colors?: Json | null
          created_at?: string | null
          custom_css?: string | null
          favicon_url?: string | null
          fonts?: Json | null
          footer_scripts?: string | null
          header_scripts?: string | null
          id?: string | null
          landing_page_config?: Json | null
          logo_url?: string | null
          messenger_link?: string | null
          nav_links?: Json | null
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          site_name?: string | null
          telegram_link?: string | null
          updated_at?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      verification_settings_public: {
        Row: {
          email_verification_enabled: boolean | null
          id: string | null
          max_attempts: number | null
          max_per_hour: number | null
          otp_expiry_minutes: number | null
          phone_verification_enabled: boolean | null
          resend_cooldown_seconds: number | null
          updated_at: string | null
        }
        Insert: {
          email_verification_enabled?: boolean | null
          id?: string | null
          max_attempts?: number | null
          max_per_hour?: number | null
          otp_expiry_minutes?: number | null
          phone_verification_enabled?: boolean | null
          resend_cooldown_seconds?: number | null
          updated_at?: string | null
        }
        Update: {
          email_verification_enabled?: boolean | null
          id?: string | null
          max_attempts?: number | null
          max_per_hour?: number | null
          otp_expiry_minutes?: number | null
          phone_verification_enabled?: boolean | null
          resend_cooldown_seconds?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_delete_user: { Args: { _user_id: string }; Returns: undefined }
      admin_send_notification: {
        Args: {
          _category?: string
          _message: string
          _target_user_id?: string
          _title: string
          _type?: string
        }
        Returns: number
      }
      admin_verify_user: {
        Args: { _type: string; _user_id: string }
        Returns: undefined
      }
      attach_transaction_proof: {
        Args: { _proof_url: string; _transaction_id: string }
        Returns: undefined
      }
      check_low_stock_notifications: {
        Args: never
        Returns: {
          available: number
          game_name: string
          total: number
        }[]
      }
      check_rate_limit: {
        Args: {
          _action: string
          _max_requests?: number
          _user_id: string
          _window_seconds?: number
        }
        Returns: boolean
      }
      edit_transaction_amount: {
        Args: { _new_amount: number; _reason?: string; _transaction_id: string }
        Returns: undefined
      }
      fire_email_trigger: {
        Args: { _data?: Json; _event: string; _user_id: string }
        Returns: undefined
      }
      get_first_admin_id: { Args: never; Returns: string }
      get_my_game_accounts: {
        Args: never
        Returns: {
          assigned_to: string
          created_at: string
          game_id: string
          id: string
          status: string
          updated_at: string
          username: string
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_security_event: {
        Args: {
          _details?: Json
          _event_type: string
          _ip_address?: string
          _severity?: string
          _user_id?: string
        }
        Returns: undefined
      }
      process_game_access_request:
        | {
            Args: { _action: string; _note?: string; _request_id: string }
            Returns: undefined
          }
        | {
            Args: {
              _action: string
              _game_password?: string
              _note?: string
              _request_id: string
            }
            Returns: undefined
          }
      process_password_request: {
        Args: { _new_password: string; _request_id: string }
        Returns: undefined
      }
      process_transaction: {
        Args: { _action: string; _transaction_id: string }
        Returns: undefined
      }
      reopen_own_conversation: { Args: { _log_id: string }; Returns: undefined }
      request_game_access: { Args: { _game_id: string }; Returns: string }
      submit_password_request: {
        Args: { _game_account_id: string; _new_password?: string }
        Returns: string
      }
      submit_transaction: {
        Args: {
          _amount: number
          _game_id: string
          _notes?: string
          _payment_gateway_id?: string
          _type: string
        }
        Returns: string
      }
      undo_transaction: {
        Args: { _reason?: string; _transaction_id: string }
        Returns: undefined
      }
      unlock_game_account: { Args: { _game_id: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "user" | "manager"
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
      app_role: ["admin", "user", "manager"],
    },
  },
} as const
