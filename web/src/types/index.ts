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
  import_tag?: string | null
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
  import_tag?: string | null
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
  patient_age?: number | null
  certificate_type_id: number
  doctor_id: number | null
  doctor_name?: string | null
  fee_amount: number
  certificate_number: string | null
  status: CertificateStatus
  payment_status: PaymentStatus
  paid_at: string | null
  finalized_at: string | null
  manually_printed_at?: string | null
  import_tag?: string | null
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

export interface ImportBatch {
  id: number
  tag: string
  patients_count?: number
  certificates_count?: number
  doctors_count?: number
  created_at: string
}

export interface ImportPatientRow {
  row_id: string
  source_file: string
  first_name: string
  last_name: string
  sex: 'M' | 'F' | null
  date_of_birth: string | null
  age: number | null
  residence: string | null
  exact_duplicate_patient_id: number | null
  potential_duplicates: { id: number; full_name: string; date_of_birth: string | null; residence: string | null }[]
}

export interface ImportDoctorRow {
  row_id: string
  name: string
  normalized_name: string
  matched_user_id: number | null
  matched_user_name: string | null
  action: 'existing' | 'create'
}

export interface ImportCertificateRow {
  row_id: string
  source_file: string
  patient_row_id: string
  doctor_row_id: string | null
  exam_date: string | null
  form_data: {
    outcome: 'sain' | 'presente_signes' | string
    sign_contagieux?: boolean
    sign_chronique?: boolean
    sign_debilitant?: boolean
    sign_trouble_mental?: boolean
    recommandation?: string | null
  }
}

export interface ImportSkippedRow {
  source_file: string
  reason: string
}

export interface ImportParseResult {
  patients: ImportPatientRow[]
  doctors: ImportDoctorRow[]
  certificates: ImportCertificateRow[]
  skipped: ImportSkippedRow[]
}

export interface ImportConfirmResult {
  batch: ImportBatch
  doctors_created: number
  patients_created: number
  certificates_created: number
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
