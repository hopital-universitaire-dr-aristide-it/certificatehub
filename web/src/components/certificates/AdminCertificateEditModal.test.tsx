import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AdminCertificateEditModal } from './AdminCertificateEditModal'
import { api } from '../../lib/api'
import type { Certificate, CertificateType, FormField, Patient, User } from '../../types'

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api')
  return { ...actual, api: { get: vi.fn(), put: vi.fn() } }
})

const certificateTypes: CertificateType[] = [
  { id: 1, form_definition_id: 1, form_label: 'Certificat de santé', is_active: true, fee_amount: 500, numbering_prefix: null, numbering_next_value: 4827 },
  { id: 2, form_definition_id: 1, form_label: 'Certificat de décès', is_active: true, fee_amount: 800, numbering_prefix: null, numbering_next_value: 12 },
]

const patient: Patient = {
  id: 1,
  first_name: 'Jean',
  last_name: 'Baptiste',
  full_name: 'Jean Baptiste',
  sex: 'M',
  date_of_birth: '1990-01-01',
  age: 35,
  residence: 'Port-au-Prince',
  created_by: 1,
  created_at: new Date().toISOString(),
  deleted_at: null,
}

const users: User[] = [
  { id: 10, name: 'Dr Aristide', email: 'aristide@huda.ht', is_active: true, roles: ['doctor'], created_at: new Date().toISOString(), deleted_at: null },
  { id: 11, name: 'Dr Casimir', email: 'casimir@huda.ht', is_active: true, roles: ['doctor'], created_at: new Date().toISOString(), deleted_at: null },
  { id: 12, name: 'Accueil Marie', email: 'marie@huda.ht', is_active: true, roles: ['reception'], created_at: new Date().toISOString(), deleted_at: null },
]

const fields: FormField[] = [
  {
    id: 1,
    field_key: 'outcome',
    label: 'Résultat',
    default_label: 'Résultat',
    field_type: 'select',
    is_required: true,
    is_active: true,
    sort_order: 0,
    config: { options: [{ value: 'sain', label: 'Sain' }, { value: 'presente_signes', label: 'Présente des signes' }] },
    children: [],
  },
]

function certificate(overrides: Partial<Certificate> = {}): Certificate {
  return {
    id: 1,
    patient_id: 1,
    patient_name: 'Jean Baptiste',
    certificate_type_id: 1,
    doctor_id: 10,
    doctor_name: 'Dr Aristide',
    fee_amount: 500,
    certificate_number: null,
    status: 'draft',
    payment_status: 'paid',
    paid_at: new Date().toISOString(),
    finalized_at: null,
    created_at: new Date().toISOString(),
    deleted_at: null,
    form_data: { outcome: 'sain' },
    ...overrides,
  }
}

function renderModal(cert: Certificate = certificate(), onClose = vi.fn()) {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/certificate-types') return Promise.resolve({ data: { data: certificateTypes } })
    if (url === '/patients/1') return Promise.resolve({ data: { data: patient } })
    if (url === '/users') return Promise.resolve({ data: { data: users } })
    if (url === '/form-definitions/1/fields') return Promise.resolve({ data: { data: fields } })
    return Promise.resolve({ data: { data: [] } })
  })

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <AdminCertificateEditModal certificate={cert} onClose={onClose} />
    </QueryClientProvider>,
  )
  return { onClose }
}

describe('AdminCertificateEditModal', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.put).mockReset()
  })

  it('pre-fills patient, type, doctor and form fields from the loaded data', async () => {
    renderModal()

    await waitFor(() => expect(screen.getByLabelText('Prénom')).toHaveValue('Jean'))
    expect(screen.getByLabelText('Nom')).toHaveValue('Baptiste')
    expect(screen.getByLabelText('Résidence')).toHaveValue('Port-au-Prince')
    expect(screen.getByLabelText('Type de certificat')).toHaveValue('1')
    expect(screen.getByLabelText('Médecin assigné')).toHaveValue('10')
    // Reception user must not appear as a candidate doctor.
    expect(screen.queryByText('Accueil Marie')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Résultat *')).toHaveValue('sain'))
  })

  it('reassigns the doctor and saves patient/type/data changes in one call', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { data: certificate() } })
    const { onClose } = renderModal()

    await waitFor(() => expect(screen.getByLabelText('Prénom')).toHaveValue('Jean'))
    await userEvent.clear(screen.getByLabelText('Résidence'))
    await userEvent.type(screen.getByLabelText('Résidence'), 'Delmas')
    await userEvent.selectOptions(screen.getByLabelText('Médecin assigné'), '11')
    await userEvent.selectOptions(screen.getByLabelText('Type de certificat'), '2')

    await userEvent.click(screen.getByText('Enregistrer'))

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/certificates/1/manage', {
        patient: { first_name: 'Jean', last_name: 'Baptiste', sex: 'M', date_of_birth: '1990-01-01', residence: 'Delmas' },
        certificate_type_id: 2,
        doctor_id: 11,
        data: { outcome: 'sain' },
      }),
    )
    expect(onClose).toHaveBeenCalled()
  })

  it('allows unassigning the doctor entirely', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { data: certificate() } })
    renderModal()

    await waitFor(() => expect(screen.getByLabelText('Médecin assigné')).toHaveValue('10'))
    await userEvent.selectOptions(screen.getByLabelText('Médecin assigné'), '')
    await userEvent.click(screen.getByText('Enregistrer'))

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith(
        '/certificates/1/manage',
        expect.objectContaining({ doctor_id: null }),
      ),
    )
  })
})
