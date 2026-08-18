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
      ancestor_profiles: {
        Row: {
          accent_note: string | null
          biography: string | null
          birth_year: number | null
          birthplace: string | null
          created_at: string
          dislikes: string | null
          face_url: string | null
          favorite_foods: string | null
          full_name: string
          hometown: string | null
          id: string
          life_events: string | null
          likes: string | null
          passing_year: number | null
          perceived_gender: string | null
          personal_tragedies: string | null
          portrait_url: string | null
          profession: string | null
          proudest_moments: string | null
          relation: string | null
          spoken_language: string | null
          system_prompt_override: string | null
          updated_at: string
          user_id: string
          voice_id: string | null
          worldview: string | null
        }
        Insert: {
          accent_note?: string | null
          biography?: string | null
          birth_year?: number | null
          birthplace?: string | null
          created_at?: string
          dislikes?: string | null
          face_url?: string | null
          favorite_foods?: string | null
          full_name: string
          hometown?: string | null
          id?: string
          life_events?: string | null
          likes?: string | null
          passing_year?: number | null
          perceived_gender?: string | null
          personal_tragedies?: string | null
          portrait_url?: string | null
          profession?: string | null
          proudest_moments?: string | null
          relation?: string | null
          spoken_language?: string | null
          system_prompt_override?: string | null
          updated_at?: string
          user_id: string
          voice_id?: string | null
          worldview?: string | null
        }
        Update: {
          accent_note?: string | null
          biography?: string | null
          birth_year?: number | null
          birthplace?: string | null
          created_at?: string
          dislikes?: string | null
          face_url?: string | null
          favorite_foods?: string | null
          full_name?: string
          hometown?: string | null
          id?: string
          life_events?: string | null
          likes?: string | null
          passing_year?: number | null
          perceived_gender?: string | null
          personal_tragedies?: string | null
          portrait_url?: string | null
          profession?: string | null
          proudest_moments?: string | null
          relation?: string | null
          spoken_language?: string | null
          system_prompt_override?: string | null
          updated_at?: string
          user_id?: string
          voice_id?: string | null
          worldview?: string | null
        }
        Relationships: []
      }
      call_logs: {
        Row: {
          ancestor_id: string
          created_at: string
          ended_at: string | null
          id: string
          session_id: string | null
          started_at: string
          stream_id: string | null
          turns: number
          user_id: string
        }
        Insert: {
          ancestor_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          session_id?: string | null
          started_at?: string
          stream_id?: string | null
          turns?: number
          user_id: string
        }
        Update: {
          ancestor_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          session_id?: string | null
          started_at?: string
          stream_id?: string | null
          turns?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_ancestor_id_fkey"
            columns: ["ancestor_id"]
            isOneToOne: false
            referencedRelation: "ancestor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          retrieved_chunk_ids: string[] | null
          role: string
          session_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          retrieved_chunk_ids?: string[] | null
          role: string
          session_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          retrieved_chunk_ids?: string[] | null
          role?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          ancestor_id: string
          created_at: string
          id: string
          title: string | null
          user_id: string
        }
        Insert: {
          ancestor_id: string
          created_at?: string
          id?: string
          title?: string | null
          user_id: string
        }
        Update: {
          ancestor_id?: string
          created_at?: string
          id?: string
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_ancestor_id_fkey"
            columns: ["ancestor_id"]
            isOneToOne: false
            referencedRelation: "ancestor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      echoes: {
        Row: {
          ancestor_id: string
          content: string
          created_at: string
          id: string
          session_id: string | null
          user_id: string
        }
        Insert: {
          ancestor_id: string
          content: string
          created_at?: string
          id?: string
          session_id?: string | null
          user_id: string
        }
        Update: {
          ancestor_id?: string
          content?: string
          created_at?: string
          id?: string
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "echoes_ancestor_id_fkey"
            columns: ["ancestor_id"]
            isOneToOne: false
            referencedRelation: "ancestor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "echoes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      memory_chunks: {
        Row: {
          ancestor_id: string
          chunk_index: number
          content: string
          created_at: string
          document_date: string | null
          document_id: string
          document_title: string | null
          embedding: string | null
          era_label: string | null
          id: string
          user_id: string
        }
        Insert: {
          ancestor_id: string
          chunk_index: number
          content: string
          created_at?: string
          document_date?: string | null
          document_id: string
          document_title?: string | null
          embedding?: string | null
          era_label?: string | null
          id?: string
          user_id: string
        }
        Update: {
          ancestor_id?: string
          chunk_index?: number
          content?: string
          created_at?: string
          document_date?: string | null
          document_id?: string
          document_title?: string | null
          embedding?: string | null
          era_label?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memory_chunks_ancestor_id_fkey"
            columns: ["ancestor_id"]
            isOneToOne: false
            referencedRelation: "ancestor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memory_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "source_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      source_documents: {
        Row: {
          ancestor_id: string
          chunk_count: number
          created_at: string
          document_date: string | null
          era_label: string | null
          error_message: string | null
          file_type: string | null
          file_url: string | null
          id: string
          raw_content: string | null
          status: string
          title: string
          user_id: string
        }
        Insert: {
          ancestor_id: string
          chunk_count?: number
          created_at?: string
          document_date?: string | null
          era_label?: string | null
          error_message?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          raw_content?: string | null
          status?: string
          title: string
          user_id: string
        }
        Update: {
          ancestor_id?: string
          chunk_count?: number
          created_at?: string
          document_date?: string | null
          era_label?: string | null
          error_message?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          raw_content?: string | null
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_documents_ancestor_id_fkey"
            columns: ["ancestor_id"]
            isOneToOne: false
            referencedRelation: "ancestor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      match_memory_chunks: {
        Args: {
          match_count?: number
          query_embedding: string
          target_ancestor_id: string
        }
        Returns: {
          content: string
          document_date: string
          document_title: string
          era_label: string
          id: string
          similarity: number
        }[]
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
