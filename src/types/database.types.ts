export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          role: 'admin' | 'employee'
          full_name: string | null
          username: string | null
          email: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id: string
          role: 'admin' | 'employee'
          full_name?: string | null
          username?: string | null
          email?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          role?: 'admin' | 'employee'
          full_name?: string | null
          username?: string | null
          email?: string | null
          is_active?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey'
            columns: ['id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      clients: {
        Row: {
          id: string
          name: string
          hourly_rate: number
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          hourly_rate?: number
          active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          hourly_rate?: number
          active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      freelancers: {
        Row: {
          id: string
          name: string
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      service_records: {
        Row: {
          id: string
          client_id: string
          date: string
          start_time: string
          end_time: string
          observation: string | null
          created_by: string | null
        }
        Insert: {
          id?: string
          client_id: string
          date: string
          start_time: string
          end_time: string
          observation?: string | null
          created_by?: string | null
        }
        Update: {
          id?: string
          client_id?: string
          date?: string
          start_time?: string
          end_time?: string
          observation?: string | null
          created_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'service_records_client_id_fkey'
            columns: ['client_id']
            isOneToOne: false
            referencedRelation: 'clients'
            referencedColumns: ['id']
          }
        ]
      }
      service_participants: {
        Row: {
          id: string
          service_record_id: string
          worker_type: 'employee' | 'freelancer'
          profile_id: string | null
          freelancer_id: string | null
        }
        Insert: {
          id?: string
          service_record_id: string
          worker_type: 'employee' | 'freelancer'
          profile_id?: string | null
          freelancer_id?: string | null
        }
        Update: {
          id?: string
          service_record_id?: string
          worker_type?: 'employee' | 'freelancer'
          profile_id?: string | null
          freelancer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'service_participants_service_record_id_fkey'
            columns: ['service_record_id']
            isOneToOne: false
            referencedRelation: 'service_records'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'service_participants_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'service_participants_freelancer_id_fkey'
            columns: ['freelancer_id']
            isOneToOne: false
            referencedRelation: 'freelancers'
            referencedColumns: ['id']
          }
        ]
      }
      extra_costs: {
        Row: {
          id: string
          client_id: string
          date: string
          description: string
          amount: number
          service_record_id: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          client_id: string
          date: string
          description: string
          amount: number
          service_record_id?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          date?: string
          description?: string
          amount?: number
          service_record_id?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'extra_costs_client_id_fkey'
            columns: ['client_id']
            isOneToOne: false
            referencedRelation: 'clients'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'extra_costs_service_record_id_fkey'
            columns: ['service_record_id']
            isOneToOne: false
            referencedRelation: 'service_records'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'extra_costs_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, 'public'>]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema['Tables'] & PublicSchema['Views'])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions['schema']]['Tables'] &
        Database[PublicTableNameOrOptions['schema']]['Views'])
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions['schema']]['Tables'] &
      Database[PublicTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema['Tables'] &
      PublicSchema['Views'])
    ? (PublicSchema['Tables'] &
        PublicSchema['Views'])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema['Tables']
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
    ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema['Tables']
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
    ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema['Enums']
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions['schema']]['Enums']
    : never = never
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions['schema']]['Enums'][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema['Enums']
    ? PublicSchema['Enums'][PublicEnumNameOrOptions]
    : never