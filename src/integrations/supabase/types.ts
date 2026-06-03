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
      action_items_log: {
        Row: {
          action_text: string
          created_at: string
          done_at: string | null
          id: string
          is_done: boolean
          report_date: string
          report_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          action_text: string
          created_at?: string
          done_at?: string | null
          id?: string
          is_done?: boolean
          report_date: string
          report_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          action_text?: string
          created_at?: string
          done_at?: string | null
          id?: string
          is_done?: boolean
          report_date?: string
          report_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_items_log_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "nightly_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      business_hours: {
        Row: {
          settings: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          settings?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          settings?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      buy_items: {
        Row: {
          cost: number
          created_at: string
          current_qty: number
          days_cover: number | null
          done: boolean
          emoji: string | null
          id: string
          name: string
          note: string | null
          reason: string | null
          rec_qty: number
          source: string | null
          unit: string | null
          user_id: string
        }
        Insert: {
          cost?: number
          created_at?: string
          current_qty?: number
          days_cover?: number | null
          done?: boolean
          emoji?: string | null
          id: string
          name: string
          note?: string | null
          reason?: string | null
          rec_qty?: number
          source?: string | null
          unit?: string | null
          user_id: string
        }
        Update: {
          cost?: number
          created_at?: string
          current_qty?: number
          days_cover?: number | null
          done?: boolean
          emoji?: string | null
          id?: string
          name?: string
          note?: string | null
          reason?: string | null
          rec_qty?: number
          source?: string | null
          unit?: string | null
          user_id?: string
        }
        Relationships: []
      }
      chat_history: {
        Row: {
          created_at: string
          from: string
          id: number
          text: string
          ts: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          from: string
          id: number
          text?: string
          ts?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          from?: string
          id?: number
          text?: string
          ts?: number | null
          user_id?: string
        }
        Relationships: []
      }
      cooking_logs: {
        Row: {
          batch_unit: string | null
          batches: number
          created_at: string
          id: number
          product_emoji: string | null
          product_id: string | null
          product_name: string | null
          ts: number | null
          user_id: string
        }
        Insert: {
          batch_unit?: string | null
          batches?: number
          created_at?: string
          id: number
          product_emoji?: string | null
          product_id?: string | null
          product_name?: string | null
          ts?: number | null
          user_id: string
        }
        Update: {
          batch_unit?: string | null
          batches?: number
          created_at?: string
          id?: number
          product_emoji?: string | null
          product_id?: string | null
          product_name?: string | null
          ts?: number | null
          user_id?: string
        }
        Relationships: []
      }
      forecasts: {
        Row: {
          accuracy_pct: number | null
          actual_revenue: number | null
          baseline: number
          created_at: string
          day_index: number
          forecast_date: string
          id: string
          predicted_high: number
          predicted_low: number
          predicted_revenue: number
          user_id: string
          weather_adjust: number
          weather_label: string | null
        }
        Insert: {
          accuracy_pct?: number | null
          actual_revenue?: number | null
          baseline?: number
          created_at?: string
          day_index?: number
          forecast_date: string
          id?: string
          predicted_high?: number
          predicted_low?: number
          predicted_revenue?: number
          user_id: string
          weather_adjust?: number
          weather_label?: string | null
        }
        Update: {
          accuracy_pct?: number | null
          actual_revenue?: number | null
          baseline?: number
          created_at?: string
          day_index?: number
          forecast_date?: string
          id?: string
          predicted_high?: number
          predicted_low?: number
          predicted_revenue?: number
          user_id?: string
          weather_adjust?: number
          weather_label?: string | null
        }
        Relationships: []
      }
      nightly_reports: {
        Row: {
          ai_achievement: string | null
          ai_motivation: string | null
          ai_recommendations: Json | null
          ai_summary: string | null
          ai_warning: string | null
          business_name: string | null
          created_at: string
          critical_stock_items: Json | null
          expense_change_pct: number | null
          generated_at: string
          id: string
          low_stock_items: Json | null
          net_profit: number
          peak_hour: number | null
          profit_change_pct: number | null
          read_at: string | null
          report_date: string
          sales_change_pct: number | null
          slow_hour: number | null
          total_expenses: number
          total_sales: number
          transaction_count: number
          updated_at: string
          user_id: string
          weekly_budget: number
          weekly_expenses: number
          weekly_revenue: number
          weekly_target: number
          weekly_target_progress: number | null
        }
        Insert: {
          ai_achievement?: string | null
          ai_motivation?: string | null
          ai_recommendations?: Json | null
          ai_summary?: string | null
          ai_warning?: string | null
          business_name?: string | null
          created_at?: string
          critical_stock_items?: Json | null
          expense_change_pct?: number | null
          generated_at?: string
          id?: string
          low_stock_items?: Json | null
          net_profit?: number
          peak_hour?: number | null
          profit_change_pct?: number | null
          read_at?: string | null
          report_date: string
          sales_change_pct?: number | null
          slow_hour?: number | null
          total_expenses?: number
          total_sales?: number
          transaction_count?: number
          updated_at?: string
          user_id: string
          weekly_budget?: number
          weekly_expenses?: number
          weekly_revenue?: number
          weekly_target?: number
          weekly_target_progress?: number | null
        }
        Update: {
          ai_achievement?: string | null
          ai_motivation?: string | null
          ai_recommendations?: Json | null
          ai_summary?: string | null
          ai_warning?: string | null
          business_name?: string | null
          created_at?: string
          critical_stock_items?: Json | null
          expense_change_pct?: number | null
          generated_at?: string
          id?: string
          low_stock_items?: Json | null
          net_profit?: number
          peak_hour?: number | null
          profit_change_pct?: number | null
          read_at?: string | null
          report_date?: string
          sales_change_pct?: number | null
          slow_hour?: number | null
          total_expenses?: number
          total_sales?: number
          transaction_count?: number
          updated_at?: string
          user_id?: string
          weekly_budget?: number
          weekly_expenses?: number
          weekly_revenue?: number
          weekly_target?: number
          weekly_target_progress?: number | null
        }
        Relationships: []
      }
      opex_entries: {
        Row: {
          amount: number
          category: string
          created_at: string
          desc: string | null
          id: number
          paid_from_petty: boolean
          time: string | null
          ts: number | null
          user_id: string
        }
        Insert: {
          amount?: number
          category: string
          created_at?: string
          desc?: string | null
          id: number
          paid_from_petty?: boolean
          time?: string | null
          ts?: number | null
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          desc?: string | null
          id?: number
          paid_from_petty?: boolean
          time?: string | null
          ts?: number | null
          user_id?: string
        }
        Relationships: []
      }
      outlet_settings: {
        Row: {
          settings: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          settings?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          settings?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      petty_entries: {
        Row: {
          amount: number
          balance: number
          created_at: string
          desc: string | null
          emoji: string | null
          id: number
          time: string | null
          ts: number | null
          type: string
          user_id: string
        }
        Insert: {
          amount?: number
          balance?: number
          created_at?: string
          desc?: string | null
          emoji?: string | null
          id: number
          time?: string | null
          ts?: number | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance?: number
          created_at?: string
          desc?: string | null
          emoji?: string | null
          id?: number
          time?: string | null
          ts?: number | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      petty_settings: {
        Row: {
          monthly_limit: number
          updated_at: string
          user_id: string
        }
        Insert: {
          monthly_limit?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          monthly_limit?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          batches_from_ingredients: number | null
          category: string | null
          cooking_frequency_days: number | null
          cost_per_unit: number | null
          created_at: string
          description: string | null
          emoji: string | null
          id: string
          ingredients: Json | null
          margin: number | null
          name: string
          note: string | null
          packaging: Json | null
          serving_unit: string | null
          servings_per_batch: number | null
          suggested_price: number | null
          target_profit_scale: number | null
          total_cost: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          batches_from_ingredients?: number | null
          category?: string | null
          cooking_frequency_days?: number | null
          cost_per_unit?: number | null
          created_at?: string
          description?: string | null
          emoji?: string | null
          id: string
          ingredients?: Json | null
          margin?: number | null
          name: string
          note?: string | null
          packaging?: Json | null
          serving_unit?: string | null
          servings_per_batch?: number | null
          suggested_price?: number | null
          target_profit_scale?: number | null
          total_cost?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          batches_from_ingredients?: number | null
          category?: string | null
          cooking_frequency_days?: number | null
          cost_per_unit?: number | null
          created_at?: string
          description?: string | null
          emoji?: string | null
          id?: string
          ingredients?: Json | null
          margin?: number | null
          name?: string
          note?: string | null
          packaging?: Json | null
          serving_unit?: string | null
          servings_per_batch?: number | null
          suggested_price?: number | null
          target_profit_scale?: number | null
          total_cost?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      saved_cards: {
        Row: {
          account_holder: string | null
          account_number: string | null
          bank_name: string | null
          created_at: string
          ewallet_phone: string | null
          ewallet_provider: string | null
          id: string
          is_primary: boolean
          nickname: string | null
          type: string
          user_id: string
        }
        Insert: {
          account_holder?: string | null
          account_number?: string | null
          bank_name?: string | null
          created_at?: string
          ewallet_phone?: string | null
          ewallet_provider?: string | null
          id: string
          is_primary?: boolean
          nickname?: string | null
          type: string
          user_id: string
        }
        Update: {
          account_holder?: string | null
          account_number?: string | null
          bank_name?: string | null
          created_at?: string
          ewallet_phone?: string | null
          ewallet_provider?: string | null
          id?: string
          is_primary?: boolean
          nickname?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      sisa_harian: {
        Row: {
          ai_suggested_qty: number | null
          created_at: string
          id: string
          leftover_qty: number
          leftover_value: number
          log_date: string
          prepared_qty: number
          product_id: string
          product_name: string
          sold_qty: number
          unit_cost: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_suggested_qty?: number | null
          created_at?: string
          id?: string
          leftover_qty?: number
          leftover_value?: number
          log_date: string
          prepared_qty?: number
          product_id: string
          product_name: string
          sold_qty?: number
          unit_cost?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_suggested_qty?: number | null
          created_at?: string
          id?: string
          leftover_qty?: number
          leftover_value?: number
          log_date?: string
          prepared_qty?: number
          product_id?: string
          product_name?: string
          sold_qty?: number
          unit_cost?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stock_items: {
        Row: {
          category: string | null
          created_at: string
          emoji: string | null
          id: string
          last_restocked_at: string | null
          last_used_at: string | null
          max_qty: number | null
          min_qty: number
          name: string
          qty: number
          restock_qty: number
          unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          emoji?: string | null
          id: string
          last_restocked_at?: string | null
          last_used_at?: string | null
          max_qty?: number | null
          min_qty?: number
          name: string
          qty?: number
          restock_qty?: number
          unit?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          last_restocked_at?: string | null
          last_used_at?: string | null
          max_qty?: number | null
          min_qty?: number
          name?: string
          qty?: number
          restock_qty?: number
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          emoji: string | null
          id: number
          label: string | null
          time: string | null
          ts: number | null
          type: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          emoji?: string | null
          id: number
          label?: string | null
          time?: string | null
          ts?: number | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          emoji?: string | null
          id?: number
          label?: string | null
          time?: string | null
          ts?: number | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_impian: {
        Row: {
          created_at: string
          current_saved: number
          goal_name: string
          goal_type: string
          id: string
          selected_plan: Json | null
          target_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_saved?: number
          goal_name: string
          goal_type: string
          id?: string
          selected_plan?: Json | null
          target_amount?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_saved?: number
          goal_name?: string
          goal_type?: string
          id?: string
          selected_plan?: Json | null
          target_amount?: number
          updated_at?: string
          user_id?: string
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
