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
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
        }
        Relationships: []
      }
      cocktail_ingredients: {
        Row: {
          amount: number | null
          cocktail_id: string
          ingredient_id: string
          position: number
          unit: string | null
        }
        Insert: {
          amount?: number | null
          cocktail_id: string
          ingredient_id: string
          position?: number
          unit?: string | null
        }
        Update: {
          amount?: number | null
          cocktail_id?: string
          ingredient_id?: string
          position?: number
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cocktail_ingredients_cocktail_id_fkey"
            columns: ["cocktail_id"]
            isOneToOne: false
            referencedRelation: "cocktails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cocktail_ingredients_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
        ]
      }
      cocktail_orders: {
        Row: {
          cocktail_id: string | null
          cocktail_name: string
          created_at: string
          customer_name: string
          id: string
          note: string | null
          status: string
          updated_at: string
        }
        Insert: {
          cocktail_id?: string | null
          cocktail_name: string
          created_at?: string
          customer_name: string
          id?: string
          note?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          cocktail_id?: string | null
          cocktail_name?: string
          created_at?: string
          customer_name?: string
          id?: string
          note?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cocktail_orders_cocktail_id_fkey"
            columns: ["cocktail_id"]
            isOneToOne: false
            referencedRelation: "cocktails"
            referencedColumns: ["id"]
          },
        ]
      }
      cocktail_ratings: {
        Row: {
          cocktail_id: string
          created_at: string
          rater_id: string
          rating: number
          updated_at: string
        }
        Insert: {
          cocktail_id: string
          created_at?: string
          rater_id: string
          rating: number
          updated_at?: string
        }
        Update: {
          cocktail_id?: string
          created_at?: string
          rater_id?: string
          rating?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cocktail_ratings_cocktail_id_fkey"
            columns: ["cocktail_id"]
            isOneToOne: false
            referencedRelation: "cocktails"
            referencedColumns: ["id"]
          },
        ]
      }
      cocktail_tags: {
        Row: {
          cocktail_id: string
          tag: string
        }
        Insert: {
          cocktail_id: string
          tag: string
        }
        Update: {
          cocktail_id?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "cocktail_tags_cocktail_id_fkey"
            columns: ["cocktail_id"]
            isOneToOne: false
            referencedRelation: "cocktails"
            referencedColumns: ["id"]
          },
        ]
      }
      cocktails: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          garnish: string | null
          glass: string | null
          id: string
          image_url: string | null
          instructions: string | null
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          garnish?: string | null
          glass?: string | null
          id?: string
          image_url?: string | null
          instructions?: string | null
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          garnish?: string | null
          glass?: string | null
          id?: string
          image_url?: string | null
          instructions?: string | null
          name?: string
        }
        Relationships: []
      }
      ingredients: {
        Row: {
          available: boolean
          category: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          available?: boolean
          category?: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          available?: boolean
          category?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
