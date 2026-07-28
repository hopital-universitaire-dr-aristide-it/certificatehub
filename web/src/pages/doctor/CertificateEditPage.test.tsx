import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CertificateEditPage } from './CertificateEditPage'
import { api } from '../../lib/api'
import { openPdfInNewTab } from '../../lib/pdf'
import type { Certificate, CertificateType, FormField, Patient } from '../../types'

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api')
  return { ...actual, api: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }
})

vi.mock('../../lib/pdf', () => ({ openPdfInNewTab: vi.fn().mockResolvedValue(undefined) }))

const certificateTypes: CertificateType[] = [
  { id: 1, form_definition_id: 1, form_label: 'Certificat de sante', is_active: true, fee_amount: 500, numbering_prefix: null, numbering_next_value: 4827 },
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
}

const fields: FormField[] = [
  {
    id: 1,
    field_key: 'outcome',
    label: 'Resultat',
    default_label: 'Resultat',
    field_type: 'select',
    is_required: true,
    is_active: true,
    sort_order: 0,
    config: { options: [{ value: 'sain', label: 'Sain' }, { value: 'presente_signes', label: 'Presente des signes' }] },
    children: [],
  },
]

function draftCertificate(overrides: Partial<Certificate> = {}): Certificate {
  return {
    id: 1,
    patient_id: 1,
    patient_name: 'Jean Baptiste',
    certificate_type_id: 1,
    doctor_id: null,
    fee_amount: 500,
    certificate_number: null,
    status: 'draft',
    payment_status: 'paid',
    finalized_at: null,
    created_at: new Date().toISOString(),
    data: {},
    ...overrides,
  }
}

function renderPage(certificate: Certificate) {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/certificates/1') return Promise.resolve({ data: certificate })
    if (url === '/certificate-types') return Promise.resolve({ data: { data: certificateTypes } })
    if (url === '/patients/1') return Promise.resolve({ data: patient })
    if (url === '/form-definitions/1/fields') return Promise.resolve({ data: { data: fields } })
    return Promise.resolve({ data: { data: [] } })
  })

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/doctor/certificates/1']}>
        <Routes>
          <Route path="/doctor/certificates/:id" element={<CertificateEditPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CertificateEditPage', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.put).mockReset()
    vi.mocked(api.post).mockReset()
    vi.mocked(openPdfInNewTab).mockClear()
  })

  it('renders patient info and the dynamic form for a draft certificate', async () => {
    renderPage(draftCertificate())

    await waitFor(() => expect(screen.getByText('Jean Baptiste')).toBeInTheDocument())
    expect(screen.getByText('35')).toBeInTheDocument()
    expect(screen.getByLabelText('Resultat *')).toBeInTheDocument()
    expect(screen.getByText('Enregistrer')).toBeInTheDocument()
    expect(screen.getByText('Finaliser')).toBeInTheDocument()
  })

  it('saves form data', async () => {
    renderPage(draftCertificate())
    vi.mocked(api.put).mockResolvedValue({ data: draftCertificate() })

    await waitFor(() => expect(screen.getByText('Enregistrer')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Enregistrer'))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/certificates/1', { data: {} }))
  })

  it('finalizes the certificate', async () => {
    renderPage(draftCertificate())
    vi.mocked(api.post).mockResolvedValue({ data: draftCertificate({ status: 'finalized' }) })

    await waitFor(() => expect(screen.getByText('Finaliser')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Finaliser'))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/certificates/1/finalize'))
  })

  it('hides finalize/save once finalized and shows a print-at-reception notice instead of a print button', async () => {
    renderPage(draftCertificate({ status: 'finalized' }))

    await waitFor(() =>
      expect(screen.getByText(/pret a etre imprime a l'accueil/)).toBeInTheDocument(),
    )
    expect(screen.queryByText('Finaliser')).not.toBeInTheDocument()
    expect(screen.queryByText('Enregistrer')).not.toBeInTheDocument()
    expect(screen.queryByText('Imprimer')).not.toBeInTheDocument()
  })

  it('opens a preview PDF', async () => {
    renderPage(draftCertificate())
    await waitFor(() => expect(screen.getByText('Apercu')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Apercu'))
    expect(openPdfInNewTab).toHaveBeenCalledWith('/certificates/1/preview')
  })
})
