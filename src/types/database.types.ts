export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type PhotoStatus = 'active' | 'deleted'

export interface Database {
  public: {
    Tables: {
      photos: {
        Row: {
          id: string
          event_id: string
          uploader_token: string | null
          user_id: string | null
          image_url: string
          caption: string | null
          status: PhotoStatus
          created_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          event_id?: string
          uploader_token?: string | null
          user_id?: string | null
          image_url: string
          caption?: string | null
          status?: PhotoStatus
          created_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          event_id?: string
          uploader_token?: string | null
          user_id?: string | null
          image_url?: string
          caption?: string | null
          status?: PhotoStatus
          created_at?: string
          deleted_at?: string | null
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
      photo_status: PhotoStatus
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Photo = Database['public']['Tables']['photos']['Row']
export type InsertPhoto = Database['public']['Tables']['photos']['Insert']
export type UpdatePhoto = Database['public']['Tables']['photos']['Update']
