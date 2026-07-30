import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CertificateEditPage } from './CertificateEditPage'
import { api } from '../../lib/api'
import type { Certificate, CertificateType, FormField, Patient } from '../../types'

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api')
  return { ...actual, api: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }
})

const certificateTypes: CertificateType[] = [
  { id: 1, form_definition_id: 1, form_label: 'Certificat de santé', is_active: true, fee_amount: 500, numbering_prefix: null, numbering_next_value: 4827 },
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
    paid_at: new Date().toISOString(),
    finalized_at: null,
    created_at: new Date().toISOString(),
    deleted_at: null,
    form_data: {},
    ...overrides,
  }
}

// Laravel enveloppe automatiquement toute JsonResource retournee seule d'un
// controleur dans {"data": ...} — les mocks doivent reproduire ce double
// niveau exactement comme le vrai backend, sinon un bug de "un seul niveau
// de deballage manquant" cote frontend passe inapercu en test (c'est
// exactement ce qui s'est produit en production).
function renderPage(certificate: Certificate) {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/certificates/1') return Promise.resolve({ data: { data: certificate } })
    if (url === '/certificate-types') return Promise.resolve({ data: { data: certificateTypes } })
    if (url === '/patients/1') return Promise.resolve({ data: { data: patient } })
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
    URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    URL.revokeObjectURL = vi.fn()
  })

  it('renders patient info and the dynamic form for a draft certificate', async () => {
    renderPage(draftCertificate())

    await waitFor(() => expect(screen.getByText('Jean Baptiste')).toBeInTheDocument())
    expect(screen.getByText('35')).toBeInTheDocument()
    expect(screen.getByLabelText('Résultat *')).toBeInTheDocument()
    expect(screen.queryByText('Enregistrer')).not.toBeInTheDocument()
    expect(screen.getByText('Finaliser')).toBeInTheDocument()
  })

  it('shows an error instead of an infinite loading state when the certificate fails to load', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/certificates/1') return Promise.reject({ isAxiosError: true, response: { data: { message: 'Certificat introuvable.' } } })
      return Promise.resolve({ data: { data: [] } })
    })

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/doctor/certificates/1']}>
          <Routes>
            <Route path="/doctor/certificates/:id" element={<CertificateEditPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await waitFor(() => expect(screen.getByText('Certificat introuvable.')).toBeInTheDocument())
  })

  it('saves automatically a short while after the doctor stops typing, without clicking a button', async () => {
    // Le GET doit refleter la nouvelle valeur apres l'invalidation qui suit
    // le PUT (comme le ferait le vrai backend) — un mock GET fige sur la
    // certification initiale ne detecterait jamais une regression sur le
    // deballage/l'affichage post-sauvegarde.
    let currentCertificate = draftCertificate()
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/certificates/1') return Promise.resolve({ data: { data: currentCertificate } })
      if (url === '/certificate-types') return Promise.resolve({ data: { data: certificateTypes } })
      if (url === '/patients/1') return Promise.resolve({ data: { data: patient } })
      if (url === '/form-definitions/1/fields') return Promise.resolve({ data: { data: fields } })
      return Promise.resolve({ data: { data: [] } })
    })
    vi.mocked(api.put).mockImplementation(async () => {
      currentCertificate = draftCertificate({ form_data: { outcome: 'sain' } })
      return { data: { data: currentCertificate } }
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

    await waitFor(() => expect(screen.getByLabelText('Résultat *')).toBeInTheDocument())
    expect(screen.queryByText('Enregistré')).not.toBeInTheDocument()
    expect(api.put).not.toHaveBeenCalled()

    await userEvent.selectOptions(screen.getByLabelText('Résultat *'), 'sain')

    await waitFor(
      () => expect(api.put).toHaveBeenCalledWith('/certificates/1', { data: { outcome: 'sain' } }),
      { timeout: 3000 },
    )
    await waitFor(() => expect(screen.getByText('Enregistré')).toBeInTheDocument())
  })

  it('disables the preview button until the form has data', async () => {
    renderPage(draftCertificate({ form_data: {} }))
    await waitFor(() => expect(screen.getByText('Aperçu')).toBeInTheDocument())
    expect(screen.getByText('Aperçu')).toBeDisabled()
    expect(screen.getByText("Aperçu non disponible avant de remplir le formulaire.")).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Résultat *'), 'sain')

    expect(screen.getByText('Aperçu')).not.toBeDisabled()
  })

  it('finalizes the certificate', async () => {
    renderPage(draftCertificate())
    vi.mocked(api.post).mockResolvedValue({ data: { data: draftCertificate({ status: 'finalized' }) } })

    await waitFor(() => expect(screen.getByText('Finaliser')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Finaliser'))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/certificates/1/finalize'))
  })

  it('flushes a pending unsaved edit before finalizing', async () => {
    renderPage(draftCertificate())
    vi.mocked(api.put).mockResolvedValue({ data: { data: draftCertificate({ form_data: { outcome: 'sain' } }) } })
    vi.mocked(api.post).mockResolvedValue({ data: { data: draftCertificate({ status: 'finalized' }) } })

    await waitFor(() => expect(screen.getByLabelText('Résultat *')).toBeInTheDocument())
    await userEvent.selectOptions(screen.getByLabelText('Résultat *'), 'sain')

    // Finalise immediatement, avant que le debounce d'auto-sauvegarde n'ait
    // eu le temps de se declencher tout seul.
    await userEvent.click(screen.getByText('Finaliser'))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/certificates/1', { data: { outcome: 'sain' } }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/certificates/1/finalize'))
  })

  it('hides the finalize action once finalized but keeps the preview button, and shows a print-at-reception notice', async () => {
    renderPage(draftCertificate({ status: 'finalized' }))

    await waitFor(() =>
      expect(screen.getByText(/prêt à être imprimé à l'accueil/)).toBeInTheDocument(),
    )
    expect(screen.queryByText('Finaliser')).not.toBeInTheDocument()
    expect(screen.queryByText('Imprimer')).not.toBeInTheDocument()
    expect(screen.getByText('Aperçu')).toBeInTheDocument()
  })

  it('opens the preview PDF in an inline modal once the certificate has saved data', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/certificates/1') return Promise.resolve({ data: { data: draftCertificate({ form_data: { outcome: 'sain' } }) } })
      if (url === '/certificate-types') return Promise.resolve({ data: { data: certificateTypes } })
      if (url === '/patients/1') return Promise.resolve({ data: { data: patient } })
      if (url === '/form-definitions/1/fields') return Promise.resolve({ data: { data: fields } })
      if (url === '/certificates/1/preview') return Promise.resolve({ data: new Blob(['%PDF-1.4']) })
      return Promise.resolve({ data: { data: [] } })
    })

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
        <MemoryRouter initialEntries={['/doctor/certificates/1']}>
          <Routes>
            <Route path="/doctor/certificates/:id" element={<CertificateEditPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await waitFor(() => expect(screen.getByText('Aperçu')).toBeInTheDocument())
    expect(screen.getByText('Aperçu')).not.toBeDisabled()

    await userEvent.click(screen.getByText('Aperçu'))

    await waitFor(() => expect(screen.getByTitle('Document PDF')).toBeInTheDocument())
    expect(screen.getByTitle('Document PDF')).toHaveAttribute('src', 'blob:mock-url')
    expect(api.put).not.toHaveBeenCalled()

    await userEvent.click(screen.getByLabelText('Fermer'))
    expect(screen.queryByTitle('Document PDF')).not.toBeInTheDocument()
  })
})
