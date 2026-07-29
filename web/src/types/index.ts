export type Role = 'reception' | 'doctor' | 'it' | 'admin' | 'superadmin'

export interface AuthenticatedUser {
  id: number
  name: string
  email: string
  roles: Role[]
  permissions: string[]
}

export interface User {
  id: number
  name: string
  email: string
  is_active: boolean
  roles: Role[]
  created_at: string
  deleted_at: string | null
}

export interface Patient {
  id: number
  first_name: string
  last_name: string
  full_name: string
  sex: 'M' | 'F' | null
  date_of_birth: string | null
  age: number | null
  residence: string | null
  created_by: number
  created_at: string
  deleted_at: string | null
}

export interface PatientSummary {
  id: number
  full_name: string
  date_of_birth: string | null
  residence: string | null
}

export type CertificateStatus = 'draft' | 'finalized'
export type PaymentStatus = 'unpaid' | 'paid'

export interface Certificate {
  id: number
  patient_id: number
  patient_name: string | null
  certificate_type_id: number
  doctor_id: number | null
  doctor_name?: string | null
  fee_amount: number
  certificate_number: string | null
  status: CertificateStatus
  payment_status: PaymentStatus
  paid_at: string | null
  finalized_at: string | null
  created_at: string
  deleted_at: string | null
  form_data?: Record<string, unknown>
}

export interface CertificateType {
  id: number
  form_definition_id: number
  form_label: string | null
  is_active: boolean
  fee_amount: number
  numbering_prefix: string | null
  numbering_next_value: number
}

export interface FormDefinition {
  id: number
  context_key: string
  module: string
  label: string
  description: string | null
  is_active: boolean
}

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'boolean'
  | 'date'
  | 'select'
  | 'multiselect'
  | 'group'
  | 'paired_lr'

export interface FieldOption {
  value: string
  label: string
}

export interface FieldConfig {
  options?: FieldOption[]
  placeholder?: string
  visible_when?: Record<string, unknown>
}

export interface FormField {
  id: number
  field_key: string
  label: string
  default_label: string
  field_type: FieldType
  is_required: boolean
  is_active: boolean
  sort_order: number
  config: FieldConfig | null
  children: FormField[]
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    current_page: number
    last_page: number
    per_page: number
    total: number
  }
  links?: {
    first: string | null
    last: string | null
    prev: string | null
    next: string | null
  }
}

export interface ReportSummary {
  period: { from: string; to: string }
  volume: {
    total: number
    by_day: { day: string; count: number }[]
    by_doctor: { doctor_name: string; count: number }[]
    by_certificate_type: { type_label: string; count: number }[]
  }
  turnaround: { avg_hours: number | null }
  revenue: {
    total_paid: number
    unpaid_count: number
    by_day: { day: string; total: number }[]
  }
  clinical: {
    sain_count: number
    presente_signes_count: number
    by_sign: Record<string, number>
  }
  cached_at: string
}
