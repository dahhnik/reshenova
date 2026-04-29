import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type CandidateStatus =
  | 'pending_review'
  | 'auto_confirmed'
  | 'confirmed'
  | 'rejected'
  | 'superseded'

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; full_name: string; created_at: string }
        Insert: { id: string; full_name: string; created_at?: string }
        Update: { full_name?: string; created_at?: string }
        Relationships: []
      }
      templates: {
        Row: { id: string; owner_id: string | null; name: string; created_at: string }
        Insert: { id?: string; owner_id?: string | null; name: string; created_at?: string }
        Update: { owner_id?: string | null; name?: string; created_at?: string }
        Relationships: []
      }
      template_fields: {
        Row: {
          id: string
          template_id: string
          name: string
          category: string
          required: boolean
          sheet_cell_ref: string
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          template_id: string
          name: string
          category: string
          required?: boolean
          sheet_cell_ref: string
          sort_order?: number
          created_at?: string
        }
        Update: {
          template_id?: string
          name?: string
          category?: string
          required?: boolean
          sheet_cell_ref?: string
          sort_order?: number
          created_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          id: string
          owner_id: string
          name: string
          telegram_chat_id: number
          google_sheet_id: string
          template_id: string
          webhook_secret: string
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          name: string
          telegram_chat_id: number
          google_sheet_id: string
          template_id: string
          webhook_secret: string
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          telegram_chat_id?: number
          google_sheet_id?: string
          template_id?: string
          webhook_secret?: string
          active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      project_phases: {
        Row: {
          id: string
          project_id: string
          name: string
          deadline_date: string | null
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          deadline_date?: string | null
          sort_order?: number
          created_at?: string
        }
        Update: {
          name?: string
          deadline_date?: string | null
          sort_order?: number
          created_at?: string
        }
        Relationships: []
      }
      phase_required_fields: {
        Row: { phase_id: string; template_field_id: string }
        Insert: { phase_id: string; template_field_id: string }
        Update: { phase_id?: string; template_field_id?: string }
        Relationships: []
      }
      messages: {
        Row: {
          id: string
          project_id: string
          telegram_message_id: number
          sender_name: string | null
          sender_telegram_id: number | null
          content: string
          sent_at: string
          received_at: string
        }
        Insert: {
          id?: string
          project_id: string
          telegram_message_id: number
          sender_name?: string | null
          sender_telegram_id?: number | null
          content: string
          sent_at: string
          received_at?: string
        }
        Update: {
          sender_name?: string | null
          sender_telegram_id?: number | null
          content?: string
          sent_at?: string
          received_at?: string
        }
        Relationships: []
      }
      decision_candidates: {
        Row: {
          id: string
          project_id: string
          template_field_id: string
          extracted_value: string
          confidence: number
          status: CandidateStatus
          source_message_ids: string[]
          is_contradiction: boolean
          extraction_note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          template_field_id: string
          extracted_value: string
          confidence: number
          status: CandidateStatus
          source_message_ids: string[]
          is_contradiction?: boolean
          extraction_note?: string | null
          created_at?: string
        }
        Update: {
          extracted_value?: string
          confidence?: number
          status?: CandidateStatus
          source_message_ids?: string[]
          is_contradiction?: boolean
          extraction_note?: string | null
          created_at?: string
        }
        Relationships: []
      }
      decision_log: {
        Row: {
          id: string
          project_id: string
          template_field_id: string
          candidate_id: string
          confirmed_value: string
          original_extracted_value: string
          confirmed_by: string | null
          confirmed_at: string
          correction_note: string | null
          sheet_written_at: string | null
          superseded_by: string | null
        }
        Insert: {
          id?: string
          project_id: string
          template_field_id: string
          candidate_id: string
          confirmed_value: string
          original_extracted_value: string
          confirmed_by?: string | null
          confirmed_at?: string
          correction_note?: string | null
          sheet_written_at?: string | null
          superseded_by?: string | null
        }
        Update: {
          confirmed_value?: string
          original_extracted_value?: string
          confirmed_by?: string | null
          confirmed_at?: string
          correction_note?: string | null
          sheet_written_at?: string | null
          superseded_by?: string | null
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}

export function createClient() {
  return createSupabaseClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
