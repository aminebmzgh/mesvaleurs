// Types de la base de données.
// PROVISOIRE : rédigé à la main au format de la CLI Supabase, en attendant la
// première génération. À régénérer avec `pnpm db:types` (ne pas modifier à la main ensuite).

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Timestamps = { created_at: string; updated_at: string };

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          ice: string | null;
          tax_id: string | null;
          trade_register: string | null;
          patente: string | null;
          cnss: string | null;
          address: string | null;
          city: string | null;
          phone: string | null;
          email: string | null;
          logo_path: string | null;
          annual_revenue: number | null;
          timezone: string;
          settings: Json;
        } & Timestamps;
        Insert: {
          id?: string;
          name: string;
          ice?: string | null;
          tax_id?: string | null;
          trade_register?: string | null;
          patente?: string | null;
          cnss?: string | null;
          address?: string | null;
          city?: string | null;
          phone?: string | null;
          email?: string | null;
          logo_path?: string | null;
          annual_revenue?: number | null;
          timezone?: string;
          settings?: Json;
        };
        Update: Partial<Database["public"]["Tables"]["organizations"]["Insert"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          job_title: string | null;
          phone: string | null;
          locale: string;
          last_organization_id: string | null;
        } & Timestamps;
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          job_title?: string | null;
          phone?: string | null;
          locale?: string;
          last_organization_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "profiles_last_organization_id_fkey";
            columns: ["last_organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      memberships: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          role: Database["public"]["Enums"]["app_role"];
        } & Timestamps;
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          role: Database["public"]["Enums"]["app_role"];
        };
        Update: Partial<Database["public"]["Tables"]["memberships"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "memberships_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "memberships_user_id_profiles_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      invitations: {
        Row: {
          id: string;
          organization_id: string;
          email: string;
          role: Database["public"]["Enums"]["app_role"];
          invited_by: string | null;
          accepted_at: string | null;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          email: string;
          role: Database["public"]["Enums"]["app_role"];
          invited_by?: string | null;
          accepted_at?: string | null;
          expires_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["invitations"]["Insert"]>;
        Relationships: [];
      };
      suppliers: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          payee_name: string | null;
          ice: string | null;
          city: string | null;
          is_active: boolean;
        } & Timestamps;
        Insert: { id?: string; organization_id: string; name: string; payee_name?: string | null };
        Update: Partial<Database["public"]["Tables"]["suppliers"]["Insert"]>;
        Relationships: [];
      };
      invoices: {
        Row: {
          id: string;
          organization_id: string;
          supplier_id: string;
          number: string;
          issue_date: string;
          amount_incl_tax: number;
          amount_paid: number;
          legal_due_date: string | null;
          status: Database["public"]["Enums"]["invoice_status"];
        } & Timestamps;
        Insert: {
          id?: string;
          organization_id: string;
          supplier_id: string;
          number: string;
          issue_date: string;
          amount_incl_tax: number;
        };
        Update: Partial<Database["public"]["Tables"]["invoices"]["Insert"]>;
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          organization_id: string;
          type: Database["public"]["Enums"]["payment_type"];
          status: Database["public"]["Enums"]["payment_status"];
          number: number | null;
          supplier_id: string;
          payee_name: string;
          amount: number;
          issue_date: string;
          due_date: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          organization_id: string;
          type: Database["public"]["Enums"]["payment_type"];
          bank_account_id: string;
          supplier_id: string;
          payee_name: string;
          amount: number;
        };
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>;
        Relationships: [];
      };
      bank_accounts: {
        Row: {
          id: string;
          organization_id: string;
          bank_id: string;
          label: string;
          current_balance: number;
          is_active: boolean;
        } & Timestamps;
        Insert: { id?: string; organization_id: string; bank_id: string; label: string };
        Update: Partial<Database["public"]["Tables"]["bank_accounts"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      create_organization: {
        Args: { p_name: string; p_city?: string | null };
        Returns: string;
      };
      accept_invitation: {
        Args: { p_invitation_id: string };
        Returns: string;
      };
      my_pending_invitations: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: string;
          organization_id: string;
          organization_name: string;
          role: Database["public"]["Enums"]["app_role"];
          expires_at: string;
        }[];
      };
      log_audit_event: {
        Args: {
          p_organization_id: string;
          p_action: string;
          p_table_name?: string | null;
          p_record_id?: string | null;
          p_details?: Json | null;
        };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: "admin" | "manager" | "preparer" | "accountant" | "external_accountant";
      invoice_status: "unpaid" | "partially_paid" | "paid" | "disputed";
      payment_type: "check" | "lcn" | "guarantee_check";
      payment_status:
        | "draft"
        | "issued"
        | "delivered"
        | "paid"
        | "rejected"
        | "cancelled"
        | "lost"
        | "stopped";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type AppRole = Database["public"]["Enums"]["app_role"];
