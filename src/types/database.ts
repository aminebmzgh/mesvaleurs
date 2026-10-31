
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "alert_digests": {
                  Row: {
                    "alert_count": number,"created_at": string,"digest_date": string,"error": string | null,"id": string,"organization_id": string,"recipient_count": number,"status": Database["public"]['Enums']["alert_digest_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "alert_count"?: number,"created_at"?: string,"digest_date": string,"error"?: string | null,"id"?: string,"organization_id": string,"recipient_count"?: number,"status"?: Database["public"]['Enums']["alert_digest_status"],"updated_at"?: string
                  }
                  Update: {
                    "alert_count"?: number,"created_at"?: string,"digest_date"?: string,"error"?: string | null,"id"?: string,"organization_id"?: string,"recipient_count"?: number,"status"?: Database["public"]['Enums']["alert_digest_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "alert_digests_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"after": Json | null,"before": Json | null,"created_at": string,"details": Json | null,"id": number,"organization_id": string,"record_id": string | null,"table_name": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"after"?: Json | null,"before"?: Json | null,"created_at"?: string,"details"?: Json | null,"id"?: never,"organization_id": string,"record_id"?: string | null,"table_name"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"after"?: Json | null,"before"?: Json | null,"created_at"?: string,"details"?: Json | null,"id"?: never,"organization_id"?: string,"record_id"?: string | null,"table_name"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"bank_accounts": {
                  Row: {
                    "accounting_code": string | null,"bank_id": string,"branch": string | null,"created_at": string,"currency": string,"current_balance": number,"id": string,"is_active": boolean,"label": string,"opening_balance": number,"opening_balance_date": string,"organization_id": string,"rib": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accounting_code"?: string | null,"bank_id": string,"branch"?: string | null,"created_at"?: string,"currency"?: string,"current_balance"?: number,"id"?: string,"is_active"?: boolean,"label": string,"opening_balance"?: number,"opening_balance_date"?: string,"organization_id": string,"rib"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "accounting_code"?: string | null,"bank_id"?: string,"branch"?: string | null,"created_at"?: string,"currency"?: string,"current_balance"?: number,"id"?: string,"is_active"?: boolean,"label"?: string,"opening_balance"?: number,"opening_balance_date"?: string,"organization_id"?: string,"rib"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bank_accounts_bank_id_fkey"
      columns: ["bank_id"]
isOneToOne: false
      referencedRelation: "banks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bank_accounts_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"banks": {
                  Row: {
                    "created_at": string,"id": string,"is_active": boolean,"name": string,"organization_id": string | null,"rib_bank_codes": (string)[],"short_name": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"name": string,"organization_id"?: string | null,"rib_bank_codes"?: (string)[],"short_name"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"organization_id"?: string | null,"rib_bank_codes"?: (string)[],"short_name"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "banks_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"checkbooks": {
                  Row: {
                    "bank_account_id": string,"created_at": string,"first_number": number,"id": string,"last_number": number,"next_number": number,"number_width": number,"organization_id": string,"print_template_id": string | null,"received_at": string | null,"status": Database["public"]['Enums']["checkbook_status"],"type": Database["public"]['Enums']["instrument_type"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bank_account_id": string,"created_at"?: string,"first_number": number,"id"?: string,"last_number": number,"next_number": number,"number_width"?: number,"organization_id": string,"print_template_id"?: string | null,"received_at"?: string | null,"status"?: Database["public"]['Enums']["checkbook_status"],"type": Database["public"]['Enums']["instrument_type"],"updated_at"?: string
                  }
                  Update: {
                    "bank_account_id"?: string,"created_at"?: string,"first_number"?: number,"id"?: string,"last_number"?: number,"next_number"?: number,"number_width"?: number,"organization_id"?: string,"print_template_id"?: string | null,"received_at"?: string | null,"status"?: Database["public"]['Enums']["checkbook_status"],"type"?: Database["public"]['Enums']["instrument_type"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "checkbooks_organization_id_bank_account_id_fkey"
      columns: ["organization_id","bank_account_id"]
isOneToOne: false
      referencedRelation: "bank_accounts"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "checkbooks_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "checkbooks_print_template_id_fkey"
      columns: ["print_template_id"]
isOneToOne: false
      referencedRelation: "print_templates"
      referencedColumns: ["id"]
    }
                  ]
                },"invitations": {
                  Row: {
                    "accepted_at": string | null,"created_at": string,"email": string,"expires_at": string,"id": string,"invited_by": string | null,"organization_id": string,"role": Database["public"]['Enums']["app_role"]
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"created_at"?: string,"email": string,"expires_at"?: string,"id"?: string,"invited_by"?: string | null,"organization_id": string,"role": Database["public"]['Enums']["app_role"]
                  }
                  Update: {
                    "accepted_at"?: string | null,"created_at"?: string,"email"?: string,"expires_at"?: string,"id"?: string,"invited_by"?: string | null,"organization_id"?: string,"role"?: Database["public"]['Enums']["app_role"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "invitations_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"invoice_archives": {
                  Row: {
                    "archived_at": string,"archived_by": string | null,"bucket_id": string,"file_path": string,"id": string,"invoice_id": string,"kind": string,"organization_id": string,"retain_until": string,"sha256": string | null,"size_bytes": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string,"archived_by"?: string | null,"bucket_id"?: string,"file_path": string,"id"?: string,"invoice_id": string,"kind": string,"organization_id": string,"retain_until"?: string,"sha256"?: string | null,"size_bytes"?: number | null
                  }
                  Update: {
                    "archived_at"?: string,"archived_by"?: string | null,"bucket_id"?: string,"file_path"?: string,"id"?: string,"invoice_id"?: string,"kind"?: string,"organization_id"?: string,"retain_until"?: string,"sha256"?: string | null,"size_bytes"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "invoice_archives_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoice_archives_organization_id_invoice_id_fkey"
      columns: ["organization_id","invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"invoices": {
                  Row: {
                    "amount_cashed": number,"amount_excl_tax": number | null,"amount_incl_tax": number,"amount_paid": number,"attachment_path": string | null,"created_at": string,"delivery_date": string | null,"id": string,"issue_date": string,"legal_due_date": string | null,"notes": string | null,"number": string,"organization_id": string,"payment_terms_days": number | null,"status": Database["public"]['Enums']["invoice_status"],"supplier_id": string,"updated_at": string,"vat_amount": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_cashed"?: number,"amount_excl_tax"?: number | null,"amount_incl_tax": number,"amount_paid"?: number,"attachment_path"?: string | null,"created_at"?: string,"delivery_date"?: string | null,"id"?: string,"issue_date": string,"legal_due_date"?: string | null,"notes"?: string | null,"number": string,"organization_id": string,"payment_terms_days"?: number | null,"status"?: Database["public"]['Enums']["invoice_status"],"supplier_id": string,"updated_at"?: string,"vat_amount"?: number | null
                  }
                  Update: {
                    "amount_cashed"?: number,"amount_excl_tax"?: number | null,"amount_incl_tax"?: number,"amount_paid"?: number,"attachment_path"?: string | null,"created_at"?: string,"delivery_date"?: string | null,"id"?: string,"issue_date"?: string,"legal_due_date"?: string | null,"notes"?: string | null,"number"?: string,"organization_id"?: string,"payment_terms_days"?: number | null,"status"?: Database["public"]['Enums']["invoice_status"],"supplier_id"?: string,"updated_at"?: string,"vat_amount"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "invoices_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_organization_id_supplier_id_fkey"
      columns: ["organization_id","supplier_id"]
isOneToOne: false
      referencedRelation: "supplier_summaries"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "invoices_organization_id_supplier_id_fkey"
      columns: ["organization_id","supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"late_payment_declarations": {
                  Row: {
                    "created_at": string,"declared_by": string | null,"declared_on": string,"id": string,"organization_id": string,"quarter": number,"reference": string | null,"year": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"declared_by"?: string | null,"declared_on": string,"id"?: string,"organization_id": string,"quarter": number,"reference"?: string | null,"year": number
                  }
                  Update: {
                    "created_at"?: string,"declared_by"?: string | null,"declared_on"?: string,"id"?: string,"organization_id"?: string,"quarter"?: number,"reference"?: string | null,"year"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "late_payment_declarations_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"lcn_postponements": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"new_due_date": string,"organization_id": string,"payment_id": string,"previous_due_date": string,"reason": string,"supplier_agreed_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"new_due_date": string,"organization_id": string,"payment_id": string,"previous_due_date": string,"reason": string,"supplier_agreed_at": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"new_due_date"?: string,"organization_id"?: string,"payment_id"?: string,"previous_due_date"?: string,"reason"?: string,"supplier_agreed_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lcn_postponements_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lcn_postponements_organization_id_payment_id_fkey"
      columns: ["organization_id","payment_id"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"legal_settings": {
                  Row: {
                    "description": string,"key": string,"updated_at": string,"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "description": string,"key": string,"updated_at"?: string,"value": number
                  }
                  Update: {
                    "description"?: string,"key"?: string,"updated_at"?: string,"value"?: number
                  }
                  Relationships: [
                    
                  ]
                },"letter_templates": {
                  Row: {
                    "body": string,"closing": string,"created_at": string,"created_by": string | null,"id": string,"kind": Database["public"]['Enums']["letter_kind"],"name": string,"organization_id": string,"subject": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"closing": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["letter_kind"],"name": string,"organization_id": string,"subject": string,"updated_at"?: string
                  }
                  Update: {
                    "body"?: string,"closing"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["letter_kind"],"name"?: string,"organization_id"?: string,"subject"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "letter_templates_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"login_lockouts": {
                  Row: {
                    "failures": number,"key": string,"locked_until": string | null,"updated_at": string,"window_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "failures"?: number,"key": string,"locked_until"?: string | null,"updated_at"?: string,"window_start"?: string
                  }
                  Update: {
                    "failures"?: number,"key"?: string,"locked_until"?: string | null,"updated_at"?: string,"window_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"memberships": {
                  Row: {
                    "created_at": string,"daily_ceiling": number | null,"email_alerts": boolean,"id": string,"organization_id": string,"role": Database["public"]['Enums']["app_role"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"daily_ceiling"?: number | null,"email_alerts"?: boolean,"id"?: string,"organization_id": string,"role": Database["public"]['Enums']["app_role"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"daily_ceiling"?: number | null,"email_alerts"?: boolean,"id"?: string,"organization_id"?: string,"role"?: Database["public"]['Enums']["app_role"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "memberships_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memberships_user_id_profiles_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"organizations": {
                  Row: {
                    "address": string | null,"annual_revenue": number | null,"city": string | null,"cnss": string | null,"created_at": string,"email": string | null,"ice": string | null,"id": string,"logo_path": string | null,"name": string,"patente": string | null,"phone": string | null,"settings": NonNullable<Json>,"tax_id": string | null,"timezone": string,"trade_register": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"annual_revenue"?: number | null,"city"?: string | null,"cnss"?: string | null,"created_at"?: string,"email"?: string | null,"ice"?: string | null,"id"?: string,"logo_path"?: string | null,"name": string,"patente"?: string | null,"phone"?: string | null,"settings"?: NonNullable<Json>,"tax_id"?: string | null,"timezone"?: string,"trade_register"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "address"?: string | null,"annual_revenue"?: number | null,"city"?: string | null,"cnss"?: string | null,"created_at"?: string,"email"?: string | null,"ice"?: string | null,"id"?: string,"logo_path"?: string | null,"name"?: string,"patente"?: string | null,"phone"?: string | null,"settings"?: NonNullable<Json>,"tax_id"?: string | null,"timezone"?: string,"trade_register"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"payment_allocations": {
                  Row: {
                    "amount": number,"created_at": string,"id": string,"invoice_id": string,"organization_id": string,"payment_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"id"?: string,"invoice_id": string,"organization_id": string,"payment_id": string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"id"?: string,"invoice_id"?: string,"organization_id"?: string,"payment_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_allocations_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_allocations_organization_id_invoice_id_fkey"
      columns: ["organization_id","invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "payment_allocations_organization_id_payment_id_fkey"
      columns: ["organization_id","payment_id"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount": number,"bank_account_id": string,"cancellation_reason": string | null,"cancelled_at": string | null,"checkbook_id": string | null,"created_at": string,"created_by": string | null,"debited_at": string | null,"delivered_at": string | null,"due_date": string | null,"guarantee_closed_at": string | null,"guarantee_outcome": Database["public"]['Enums']["guarantee_outcome"] | null,"guarantee_purpose": string | null,"guarantee_return_due": string | null,"id": string,"issue_date": string,"issue_place": string | null,"notes": string | null,"number": number | null,"organization_id": string,"payee_name": string,"print_batch_id": string | null,"reference": string | null,"regularization_due_date": string | null,"regularization_method": Database["public"]['Enums']["regularization_method"] | null,"regularization_notes": string | null,"regularized_at": string | null,"rejected_at": string | null,"rejection_kind": Database["public"]['Enums']["rejection_kind"] | null,"rejection_reason": string | null,"replacement_payment_id": string | null,"scan_path": string | null,"status": Database["public"]['Enums']["payment_status"],"supplier_id": string,"type": Database["public"]['Enums']["payment_type"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"bank_account_id": string,"cancellation_reason"?: string | null,"cancelled_at"?: string | null,"checkbook_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"debited_at"?: string | null,"delivered_at"?: string | null,"due_date"?: string | null,"guarantee_closed_at"?: string | null,"guarantee_outcome"?: Database["public"]['Enums']["guarantee_outcome"] | null,"guarantee_purpose"?: string | null,"guarantee_return_due"?: string | null,"id"?: string,"issue_date"?: string,"issue_place"?: string | null,"notes"?: string | null,"number"?: number | null,"organization_id": string,"payee_name": string,"print_batch_id"?: string | null,"reference"?: string | null,"regularization_due_date"?: string | null,"regularization_method"?: Database["public"]['Enums']["regularization_method"] | null,"regularization_notes"?: string | null,"regularized_at"?: string | null,"rejected_at"?: string | null,"rejection_kind"?: Database["public"]['Enums']["rejection_kind"] | null,"rejection_reason"?: string | null,"replacement_payment_id"?: string | null,"scan_path"?: string | null,"status"?: Database["public"]['Enums']["payment_status"],"supplier_id": string,"type": Database["public"]['Enums']["payment_type"],"updated_at"?: string
                  }
                  Update: {
                    "amount"?: number,"bank_account_id"?: string,"cancellation_reason"?: string | null,"cancelled_at"?: string | null,"checkbook_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"debited_at"?: string | null,"delivered_at"?: string | null,"due_date"?: string | null,"guarantee_closed_at"?: string | null,"guarantee_outcome"?: Database["public"]['Enums']["guarantee_outcome"] | null,"guarantee_purpose"?: string | null,"guarantee_return_due"?: string | null,"id"?: string,"issue_date"?: string,"issue_place"?: string | null,"notes"?: string | null,"number"?: number | null,"organization_id"?: string,"payee_name"?: string,"print_batch_id"?: string | null,"reference"?: string | null,"regularization_due_date"?: string | null,"regularization_method"?: Database["public"]['Enums']["regularization_method"] | null,"regularization_notes"?: string | null,"regularized_at"?: string | null,"rejected_at"?: string | null,"rejection_kind"?: Database["public"]['Enums']["rejection_kind"] | null,"rejection_reason"?: string | null,"replacement_payment_id"?: string | null,"scan_path"?: string | null,"status"?: Database["public"]['Enums']["payment_status"],"supplier_id"?: string,"type"?: Database["public"]['Enums']["payment_type"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_organization_id_bank_account_id_fkey"
      columns: ["organization_id","bank_account_id"]
isOneToOne: false
      referencedRelation: "bank_accounts"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "payments_organization_id_checkbook_id_fkey"
      columns: ["organization_id","checkbook_id"]
isOneToOne: false
      referencedRelation: "checkbook_summaries"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "payments_organization_id_checkbook_id_fkey"
      columns: ["organization_id","checkbook_id"]
isOneToOne: false
      referencedRelation: "checkbooks"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "payments_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_organization_id_print_batch_id_fkey"
      columns: ["organization_id","print_batch_id"]
isOneToOne: false
      referencedRelation: "print_batches"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "payments_organization_id_supplier_id_fkey"
      columns: ["organization_id","supplier_id"]
isOneToOne: false
      referencedRelation: "supplier_summaries"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "payments_organization_id_supplier_id_fkey"
      columns: ["organization_id","supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "payments_replacement_fk"
      columns: ["organization_id","replacement_payment_id"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"print_batches": {
                  Row: {
                    "approval_reasons": NonNullable<Json>,"approval_status": Database["public"]['Enums']["batch_approval_status"],"created_at": string,"created_by": string | null,"decided_at": string | null,"decided_by": string | null,"id": string,"organization_id": string,"print_count": number,"printed_at": string | null,"refusal_reason": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "approval_reasons"?: NonNullable<Json>,"approval_status"?: Database["public"]['Enums']["batch_approval_status"],"created_at"?: string,"created_by"?: string | null,"decided_at"?: string | null,"decided_by"?: string | null,"id"?: string,"organization_id": string,"print_count"?: number,"printed_at"?: string | null,"refusal_reason"?: string | null
                  }
                  Update: {
                    "approval_reasons"?: NonNullable<Json>,"approval_status"?: Database["public"]['Enums']["batch_approval_status"],"created_at"?: string,"created_by"?: string | null,"decided_at"?: string | null,"decided_by"?: string | null,"id"?: string,"organization_id"?: string,"print_count"?: number,"printed_at"?: string | null,"refusal_reason"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "print_batches_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"print_templates": {
                  Row: {
                    "background_path": string | null,"bank_id": string | null,"created_at": string,"height_mm": number,"id": string,"name": string,"offset_x_mm": number,"offset_y_mm": number,"options": NonNullable<Json>,"organization_id": string | null,"source_key": string | null,"type": Database["public"]['Enums']["instrument_type"],"updated_at": string,"width_mm": number,"zones": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "background_path"?: string | null,"bank_id"?: string | null,"created_at"?: string,"height_mm": number,"id"?: string,"name": string,"offset_x_mm"?: number,"offset_y_mm"?: number,"options"?: NonNullable<Json>,"organization_id"?: string | null,"source_key"?: string | null,"type": Database["public"]['Enums']["instrument_type"],"updated_at"?: string,"width_mm": number,"zones"?: NonNullable<Json>
                  }
                  Update: {
                    "background_path"?: string | null,"bank_id"?: string | null,"created_at"?: string,"height_mm"?: number,"id"?: string,"name"?: string,"offset_x_mm"?: number,"offset_y_mm"?: number,"options"?: NonNullable<Json>,"organization_id"?: string | null,"source_key"?: string | null,"type"?: Database["public"]['Enums']["instrument_type"],"updated_at"?: string,"width_mm"?: number,"zones"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "print_templates_bank_id_fkey"
      columns: ["bank_id"]
isOneToOne: false
      referencedRelation: "banks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "print_templates_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"email": string,"full_name": string | null,"id": string,"job_title": string | null,"last_organization_id": string | null,"locale": string,"phone": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string,"full_name"?: string | null,"id": string,"job_title"?: string | null,"last_organization_id"?: string | null,"locale"?: string,"phone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"full_name"?: string | null,"id"?: string,"job_title"?: string | null,"last_organization_id"?: string | null,"locale"?: string,"phone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_last_organization_id_fkey"
      columns: ["last_organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"statement_column_mappings": {
                  Row: {
                    "bank_id": string,"header_signature": string,"id": string,"mapping": NonNullable<Json>,"organization_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bank_id": string,"header_signature": string,"id"?: string,"mapping": NonNullable<Json>,"organization_id": string,"updated_at"?: string
                  }
                  Update: {
                    "bank_id"?: string,"header_signature"?: string,"id"?: string,"mapping"?: NonNullable<Json>,"organization_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "statement_column_mappings_bank_id_fkey"
      columns: ["bank_id"]
isOneToOne: false
      referencedRelation: "banks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "statement_column_mappings_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"statement_imports": {
                  Row: {
                    "bank_account_id": string,"created_at": string,"error_message": string | null,"file_hash": string | null,"file_path": string | null,"format": Database["public"]['Enums']["statement_format"],"id": string,"imported_by": string | null,"line_count": number,"organization_id": string,"period_end": string | null,"period_start": string | null,"status": Database["public"]['Enums']["statement_import_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bank_account_id": string,"created_at"?: string,"error_message"?: string | null,"file_hash"?: string | null,"file_path"?: string | null,"format": Database["public"]['Enums']["statement_format"],"id"?: string,"imported_by"?: string | null,"line_count"?: number,"organization_id": string,"period_end"?: string | null,"period_start"?: string | null,"status"?: Database["public"]['Enums']["statement_import_status"],"updated_at"?: string
                  }
                  Update: {
                    "bank_account_id"?: string,"created_at"?: string,"error_message"?: string | null,"file_hash"?: string | null,"file_path"?: string | null,"format"?: Database["public"]['Enums']["statement_format"],"id"?: string,"imported_by"?: string | null,"line_count"?: number,"organization_id"?: string,"period_end"?: string | null,"period_start"?: string | null,"status"?: Database["public"]['Enums']["statement_import_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "statement_imports_organization_id_bank_account_id_fkey"
      columns: ["organization_id","bank_account_id"]
isOneToOne: false
      referencedRelation: "bank_accounts"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "statement_imports_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"statement_lines": {
                  Row: {
                    "bank_account_id": string,"confidence": number | null,"created_at": string,"credit": number | null,"debit": number | null,"extracted_kind": string | null,"extracted_number": number | null,"id": string,"import_id": string,"label": string,"line_hash": string,"match_reason": string | null,"matched_payment_id": string | null,"operation_date": string,"organization_id": string,"reference": string | null,"status": Database["public"]['Enums']["statement_line_status"],"updated_at": string,"value_date": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "bank_account_id": string,"confidence"?: number | null,"created_at"?: string,"credit"?: number | null,"debit"?: number | null,"extracted_kind"?: string | null,"extracted_number"?: number | null,"id"?: string,"import_id": string,"label": string,"line_hash": string,"match_reason"?: string | null,"matched_payment_id"?: string | null,"operation_date": string,"organization_id": string,"reference"?: string | null,"status"?: Database["public"]['Enums']["statement_line_status"],"updated_at"?: string,"value_date"?: string | null
                  }
                  Update: {
                    "bank_account_id"?: string,"confidence"?: number | null,"created_at"?: string,"credit"?: number | null,"debit"?: number | null,"extracted_kind"?: string | null,"extracted_number"?: number | null,"id"?: string,"import_id"?: string,"label"?: string,"line_hash"?: string,"match_reason"?: string | null,"matched_payment_id"?: string | null,"operation_date"?: string,"organization_id"?: string,"reference"?: string | null,"status"?: Database["public"]['Enums']["statement_line_status"],"updated_at"?: string,"value_date"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "statement_lines_organization_id_bank_account_id_fkey"
      columns: ["organization_id","bank_account_id"]
isOneToOne: false
      referencedRelation: "bank_accounts"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "statement_lines_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "statement_lines_organization_id_import_id_fkey"
      columns: ["organization_id","import_id"]
isOneToOne: false
      referencedRelation: "statement_imports"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "statement_lines_organization_id_matched_payment_id_fkey"
      columns: ["organization_id","matched_payment_id"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"stop_orders": {
                  Row: {
                    "bank_account_id": string,"checkbook_id": string,"created_at": string,"created_by": string | null,"declared_on": string,"first_number": number,"id": string,"last_number": number,"notes": string | null,"occurred_on": string,"organization_id": string,"payment_id": string | null,"police_report": string | null,"reason": Database["public"]['Enums']["stop_order_reason"]
                  }
                  ComputedFields: never
                  Insert: {
                    "bank_account_id": string,"checkbook_id": string,"created_at"?: string,"created_by"?: string | null,"declared_on"?: string,"first_number": number,"id"?: string,"last_number": number,"notes"?: string | null,"occurred_on": string,"organization_id": string,"payment_id"?: string | null,"police_report"?: string | null,"reason": Database["public"]['Enums']["stop_order_reason"]
                  }
                  Update: {
                    "bank_account_id"?: string,"checkbook_id"?: string,"created_at"?: string,"created_by"?: string | null,"declared_on"?: string,"first_number"?: number,"id"?: string,"last_number"?: number,"notes"?: string | null,"occurred_on"?: string,"organization_id"?: string,"payment_id"?: string | null,"police_report"?: string | null,"reason"?: Database["public"]['Enums']["stop_order_reason"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "stop_orders_organization_id_bank_account_id_fkey"
      columns: ["organization_id","bank_account_id"]
isOneToOne: false
      referencedRelation: "bank_accounts"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "stop_orders_organization_id_checkbook_id_fkey"
      columns: ["organization_id","checkbook_id"]
isOneToOne: false
      referencedRelation: "checkbook_summaries"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "stop_orders_organization_id_checkbook_id_fkey"
      columns: ["organization_id","checkbook_id"]
isOneToOne: false
      referencedRelation: "checkbooks"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "stop_orders_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stop_orders_organization_id_payment_id_fkey"
      columns: ["organization_id","payment_id"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"suppliers": {
                  Row: {
                    "accounting_code": string | null,"address": string | null,"city": string | null,"contact_name": string | null,"created_at": string,"daily_ceiling": number | null,"email": string | null,"ice": string | null,"id": string,"is_active": boolean,"is_strategic": boolean,"name": string,"notes": string | null,"organization_id": string,"payee_name": string | null,"payment_terms_days": number | null,"phone": string | null,"print_cover_letter": boolean,"rib": string | null,"tax_id": string | null,"trade_register": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accounting_code"?: string | null,"address"?: string | null,"city"?: string | null,"contact_name"?: string | null,"created_at"?: string,"daily_ceiling"?: number | null,"email"?: string | null,"ice"?: string | null,"id"?: string,"is_active"?: boolean,"is_strategic"?: boolean,"name": string,"notes"?: string | null,"organization_id": string,"payee_name"?: string | null,"payment_terms_days"?: number | null,"phone"?: string | null,"print_cover_letter"?: boolean,"rib"?: string | null,"tax_id"?: string | null,"trade_register"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "accounting_code"?: string | null,"address"?: string | null,"city"?: string | null,"contact_name"?: string | null,"created_at"?: string,"daily_ceiling"?: number | null,"email"?: string | null,"ice"?: string | null,"id"?: string,"is_active"?: boolean,"is_strategic"?: boolean,"name"?: string,"notes"?: string | null,"organization_id"?: string,"payee_name"?: string | null,"payment_terms_days"?: number | null,"phone"?: string | null,"print_cover_letter"?: boolean,"rib"?: string | null,"tax_id"?: string | null,"trade_register"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "suppliers_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "audit_entries": {
                  Row: {
                    "action": string,"actor_email": string | null,"actor_id": string | null,"actor_name": string | null,"after": Json | null,"before": Json | null,"created_at": string,"details": Json | null,"id": number,"organization_id": string,"record_id": string | null,"table_name": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "audit_log_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"checkbook_summaries": {
                  Row: {
                    "bank_account_id": string,"cancelled_count": number | null,"created_at": string,"first_number": number,"id": string,"last_number": number,"next_number": number,"number_width": number,"organization_id": string,"print_template_id": string | null,"received_at": string | null,"remaining_count": number | null,"status": Database["public"]['Enums']["checkbook_status"],"stopped_blank_count": number | null,"total_count": number | null,"type": Database["public"]['Enums']["instrument_type"]
                  }
                  ComputedFields: never
                  Insert: {
                           "bank_account_id"?: string | null,"cancelled_count"?: never,"created_at"?: string | null,"first_number"?: number | null,"id"?: string | null,"last_number"?: number | null,"next_number"?: number | null,"number_width"?: number | null,"organization_id"?: string | null,"print_template_id"?: string | null,"received_at"?: string | null,"remaining_count"?: never,"status"?: Database["public"]['Enums']["checkbook_status"] | null,"stopped_blank_count"?: never,"total_count"?: never,"type"?: Database["public"]['Enums']["instrument_type"] | null
                         }
                        Update: {
                           "bank_account_id"?: string | null,"cancelled_count"?: never,"created_at"?: string | null,"first_number"?: number | null,"id"?: string | null,"last_number"?: number | null,"next_number"?: number | null,"number_width"?: number | null,"organization_id"?: string | null,"print_template_id"?: string | null,"received_at"?: string | null,"remaining_count"?: never,"status"?: Database["public"]['Enums']["checkbook_status"] | null,"stopped_blank_count"?: never,"total_count"?: never,"type"?: Database["public"]['Enums']["instrument_type"] | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "checkbooks_organization_id_bank_account_id_fkey"
      columns: ["organization_id","bank_account_id"]
isOneToOne: false
      referencedRelation: "bank_accounts"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "checkbooks_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "checkbooks_print_template_id_fkey"
      columns: ["print_template_id"]
isOneToOne: false
      referencedRelation: "print_templates"
      referencedColumns: ["id"]
    }
                  ]
                },"supplier_summaries": {
                  Row: {
                    "amount_cashed": number | null,"amount_disputed": number | null,"amount_due": number | null,"amount_in_circulation": number | null,"id": string,"last_payment_date": string | null,"open_invoice_count": number | null,"organization_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "suppliers_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "accept_invitation":
{ Args: { "p_invitation_id": string }; Returns: string
                           },
"apply_statement_matches":
{ Args: { "p_import_id": string,"p_matches": Json }; Returns: undefined
                           },
"approve_batch":
{ Args: { "p_batch_id": string }; Returns: undefined
                           },
"clear_login_failures":
{ Args: { "p_key": string }; Returns: undefined
                           },
"close_guarantee":
{ Args: { "p_closed_on": string,"p_outcome": Database["public"]['Enums']["guarantee_outcome"],"p_payment_id": string }; Returns: undefined
                           },
"confirm_statement_line":
{ Args: { "p_line_id": string,"p_payment_id": string }; Returns: undefined
                           },
"create_organization":
{ Args: { "p_city"?: string,"p_name": string }; Returns: string
                           },
"issue_payments":
{ Args: { "p_allocations"?: Json,"p_checkbook_id": string,"p_guarantee"?: Json,"p_instruments": Json,"p_issue_date": string,"p_issue_place": string,"p_organization_id": string,"p_payee_name": string,"p_supplier_id": string }; Returns: string
                           },
"log_audit_event":
{ Args: { "p_action": string,"p_details"?: Json,"p_organization_id": string,"p_record_id"?: string,"p_table_name"?: string }; Returns: undefined
                           },
"login_locked_until":
{ Args: { "p_keys": (string)[] }; Returns: string
                           },
"my_pending_invitations":
{ Args: Record<PropertyKey, never>; Returns: {
              "expires_at": string,"id": string,"organization_id": string,"organization_name": string,"role": Database["public"]['Enums']["app_role"]
            }[]
                           },
"postpone_lcn":
{ Args: { "p_new_due_date": string,"p_payment_id": string,"p_reason": string,"p_supplier_agreed_at": string }; Returns: undefined
                           },
"record_batch_print":
{ Args: { "p_batch_id": string }; Returns: number
                           },
"record_login_failure":
{ Args: { "p_key": string,"p_lock": string,"p_max_failures": number,"p_window": string }; Returns: string
                           },
"record_transfer":
{ Args: { "p_allocations"?: Json,"p_amount": number,"p_bank_account_id": string,"p_debited": boolean,"p_notes"?: string,"p_organization_id": string,"p_reference": string,"p_supplier_id": string,"p_transfer_date": string }; Returns: string
                           },
"refuse_batch":
{ Args: { "p_batch_id": string,"p_reason": string }; Returns: undefined
                           },
"regularize_payment":
{ Args: { "p_method": Database["public"]['Enums']["regularization_method"],"p_notes"?: string,"p_payment_id": string,"p_regularized_on": string,"p_replacement_payment_id"?: string }; Returns: undefined
                           },
"reject_payment":
{ Args: { "p_kind": Database["public"]['Enums']["rejection_kind"],"p_payment_id": string,"p_reason": string,"p_rejected_on": string }; Returns: undefined
                           },
"seal_invoice_archive":
{ Args: { "p_id": string,"p_sha256": string,"p_size": number }; Returns: undefined
                           },
"set_email_alerts":
{ Args: { "p_enabled": boolean,"p_organization_id": string }; Returns: undefined
                           },
"set_statement_line_ignored":
{ Args: { "p_ignored": boolean,"p_line_id": string }; Returns: undefined
                           },
"stop_blank_forms":
{ Args: { "p_checkbook_id": string,"p_first_number": number,"p_last_number": number,"p_notes"?: string,"p_occurred_on": string,"p_police_report"?: string,"p_reason": Database["public"]['Enums']["stop_order_reason"] }; Returns: string
                           },
"stop_payment":
{ Args: { "p_notes"?: string,"p_occurred_on": string,"p_payment_id": string,"p_police_report"?: string,"p_reason": Database["public"]['Enums']["stop_order_reason"] }; Returns: string
                           },
"unmatch_statement_line":
{ Args: { "p_line_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "alert_digest_status": "pending"|"sent"|"no_alerts"|"no_recipients"|"disabled"|"failed","app_role": "admin"|"manager"|"preparer"|"accountant"|"external_accountant","batch_approval_status": "not_required"|"pending"|"approved"|"refused","checkbook_status": "active"|"exhausted"|"archived","guarantee_outcome": "returned"|"destroyed","instrument_type": "check"|"lcn","invoice_status": "unpaid"|"partially_paid"|"paid"|"disputed","letter_kind": "cover_letter"|"opposition"|"postponement_request"|"statement_request"|"reminder","payment_status": "draft"|"issued"|"delivered"|"paid"|"rejected"|"cancelled"|"lost"|"stopped","payment_type": "check"|"lcn"|"guarantee_check"|"transfer","regularization_method": "new_provision"|"replacement"|"transfer"|"other","rejection_kind": "insufficient_funds"|"signature"|"stop_order"|"irregularity"|"other","statement_format": "csv"|"excel"|"pdf_text"|"pdf_scan","statement_import_status": "pending"|"processing"|"review"|"completed"|"failed","statement_line_status": "auto_matched"|"manually_matched"|"to_confirm"|"unmatched"|"ignored","stop_order_reason": "lost"|"stolen"|"fraudulent_use"|"holder_insolvency"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "alert_digest_status": ["pending", "sent", "no_alerts", "no_recipients", "disabled", "failed"],"app_role": ["admin", "manager", "preparer", "accountant", "external_accountant"],"batch_approval_status": ["not_required", "pending", "approved", "refused"],"checkbook_status": ["active", "exhausted", "archived"],"guarantee_outcome": ["returned", "destroyed"],"instrument_type": ["check", "lcn"],"invoice_status": ["unpaid", "partially_paid", "paid", "disputed"],"letter_kind": ["cover_letter", "opposition", "postponement_request", "statement_request", "reminder"],"payment_status": ["draft", "issued", "delivered", "paid", "rejected", "cancelled", "lost", "stopped"],"payment_type": ["check", "lcn", "guarantee_check", "transfer"],"regularization_method": ["new_provision", "replacement", "transfer", "other"],"rejection_kind": ["insufficient_funds", "signature", "stop_order", "irregularity", "other"],"statement_format": ["csv", "excel", "pdf_text", "pdf_scan"],"statement_import_status": ["pending", "processing", "review", "completed", "failed"],"statement_line_status": ["auto_matched", "manually_matched", "to_confirm", "unmatched", "ignored"],"stop_order_reason": ["lost", "stolen", "fraudulent_use", "holder_insolvency"]
          }
        }
} as const
