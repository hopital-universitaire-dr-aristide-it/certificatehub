import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReceptionPage } from './ReceptionPage'
import { renderWithProviders, seedUser, makeUser } from '../../test/renderWithProviders'
import { api } from '../../lib/api'
import type { Certificate, CertificateType } from '../../types'

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api')
  return { ...actual, api: { get: vi.fn(), post: vi.fn() } }
})

const certificateTypes: CertificateType[] = [
  { id: 1, form_definition_id: 1, form_label: 'Certificat de santé', is_active: true, fee_amount: 500, numbering_prefix: null, numbering_next_value: 4827 },
]

const visit: Certificate = {
  id: 10,
  patient_id: 1,
  patient_name: 'Jean Baptiste',
  certificate_type_id: 1,
  doctor_id: null,
  fee_amount: 500,
  certificate_number: null,
  status: 'draft',
  payment_status: 'unpaid',
  paid_at: null,
  finalized_at: null,
  created_at: new Date().toISOString(),
  deleted_at: null,
}

function renderPage(permissions: string[] = ['certificate.create', 'certificate.mark_paid']) {
  seedUser(makeUser({ roles: ['reception'], permissions }))
  renderWithProviders(<ReceptionPage />)
}

describe('ReceptionPage', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.post).mockReset()
    URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    URL.revokeObjectURL = vi.fn()
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/certificate-types') return Promise.resolve({ data: { data: certificateTypes } })
      if (url === '/visits') return Promise.resolve({ data: { data: [visit] } })
      return Promise.resolve({ data: { data: [] } })
    })
  })

  it('lists today\'s visits with payment status', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Jean Baptiste')).toBeInTheDocument())
    expect(screen.getByText('Non payé')).toBeInTheDocument()
  })

  it('marks a visit as paid', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { ...visit, payment_status: 'paid' } })
    renderPage()

    await waitFor(() => expect(screen.getByRole('button', { name: 'Marquer payé' })).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Marquer payé' }))

    expect(api.post).toHaveBeenCalledWith('/visits/10/mark-paid')
  })

  it('shows a validation error when submitting without a patient/type', async () => {
    renderPage()
    await userEvent.click(screen.getByText('Patient existant'))
    await waitFor(() => expect(screen.getByText('Enregistrer la visite')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Enregistrer la visite'))
    expect(screen.getByText('Sélectionnez un patient et un type de certificat.')).toBeInTheDocument()
  })

  it('defaults to the new-patient form, with "Nouveau patient" on the left', async () => {
    renderPage()
    const newPatientButton = await screen.findByText('Nouveau patient')
    const existingPatientButton = screen.getByText('Patient existant')
    expect(newPatientButton.compareDocumentPosition(existingPatientButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByLabelText('Prénom')).toBeInTheDocument()
  })

  it('pre-selects the certificate type by default', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByLabelText('Type de certificat')).toHaveValue('1'))
  })

  it('does not show a payment checkbox — the reception always collects payment before registering', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByLabelText('Prénom')).toBeInTheDocument())
    expect(screen.queryByText('Paiement reçu maintenant')).not.toBeInTheDocument()
  })

  it('registers a new patient and their visit in a single click', async () => {
    renderPage()

    await waitFor(() => expect(screen.getByText('Certificat de santé — 500 G')).toBeInTheDocument())
    await waitFor(() => expect(screen.getByLabelText('Type de certificat')).toHaveValue('1'))

    await userEvent.type(screen.getByLabelText('Prénom'), 'Jean')
    await userEvent.type(screen.getByLabelText('Nom'), 'Baptiste')

    vi.mocked(api.post)
      .mockResolvedValueOnce({ data: { patient: { id: 1, first_name: 'Jean', last_name: 'Baptiste', full_name: 'Jean Baptiste' }, potential_duplicates: [] } })
      .mockResolvedValueOnce({ data: { data: { ...visit, payment_status: 'paid' } } })

    await userEvent.click(screen.getByText('Créer le patient et enregistrer la visite'))

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/visits', {
        patient_id: 1,
        certificate_type_id: 1,
        mark_paid: true,
      }),
    )
    expect(api.post).toHaveBeenCalledWith('/patients', {
      first_name: 'Jean',
      last_name: 'Baptiste',
      sex: null,
      date_of_birth: null,
      residence: null,
    })
  })

  it('keeps the created patient selected if visit registration fails, to allow a retry without duplicating the patient', async () => {
    renderPage()

    await userEvent.type(screen.getByLabelText('Prénom'), 'Jean')
    await userEvent.type(screen.getByLabelText('Nom'), 'Baptiste')

    vi.mocked(api.post)
      .mockResolvedValueOnce({ data: { patient: { id: 1, first_name: 'Jean', last_name: 'Baptiste', full_name: 'Jean Baptiste' }, potential_duplicates: [] } })
      .mockRejectedValueOnce({ response: { data: { message: 'Erreur serveur' } } })

    await userEvent.click(screen.getByText('Créer le patient et enregistrer la visite'))

    await waitFor(() => expect(screen.getByText(/Patient sélectionné/)).toBeInTheDocument())
    expect(screen.getByText('Enregistrer la visite')).toBeInTheDocument()

    vi.mocked(api.post).mockResolvedValueOnce({ data: { data: { ...visit, payment_status: 'paid' } } })
    await userEvent.click(screen.getByText('Enregistrer la visite'))

    await waitFor(() =>
      expect(api.post).toHaveBeenLastCalledWith('/visits', {
        patient_id: 1,
        certificate_type_id: 1,
        mark_paid: true,
      }),
    )
    expect(vi.mocked(api.post).mock.calls.filter(([url]) => url === '/patients')).toHaveLength(1)
  })

  it('shows a progress bar while registering a new patient and their visit', async () => {
    renderPage()

    await userEvent.type(screen.getByLabelText('Prénom'), 'Jean')
    await userEvent.type(screen.getByLabelText('Nom'), 'Baptiste')

    let resolvePatientPost!: (value: unknown) => void
    let resolveVisitPost!: (value: { data: { data: Certificate } }) => void
    vi.mocked(api.post)
      .mockImplementationOnce(() => new Promise((resolve) => { resolvePatientPost = resolve }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveVisitPost = resolve }))

    await userEvent.click(screen.getByText('Créer le patient et enregistrer la visite'))
    expect(screen.getByRole('progressbar', { name: 'Création du patient et enregistrement de la visite...' })).toBeInTheDocument()

    resolvePatientPost({ data: { patient: { id: 1, first_name: 'Jean', last_name: 'Baptiste', full_name: 'Jean Baptiste' }, potential_duplicates: [] } })
    await waitFor(() => expect(screen.getByRole('progressbar', { name: 'Enregistrement de la visite...' })).toBeInTheDocument())

    resolveVisitPost({ data: { data: { ...visit, payment_status: 'paid' } } })

    await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument())
  })

  it('switches to the existing-patient search', async () => {
    renderPage()
    expect(screen.getByLabelText('Prénom')).toBeInTheDocument()
    await userEvent.click(screen.getByText('Patient existant'))
    expect(screen.queryByLabelText('Prénom')).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('Rechercher un patient (nom, prénom...)')).toBeInTheDocument()
  })

  it('shows a print button for finalized visits when the user has certificate.print', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/certificate-types') return Promise.resolve({ data: { data: certificateTypes } })
      if (url === '/visits') return Promise.resolve({ data: { data: [{ ...visit, status: 'finalized', payment_status: 'paid' }] } })
      if (url === '/certificates/10/print') return Promise.resolve({ data: new Blob(['%PDF-1.4']) })
      return Promise.resolve({ data: { data: [] } })
    })
    renderPage(['certificate.create', 'certificate.mark_paid', 'certificate.print'])

    await waitFor(() => expect(screen.getByText('Prêt à imprimer')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Imprimer' }))

    await waitFor(() => expect(screen.getByTitle('Document PDF')).toBeInTheDocument())
    expect(screen.getByTitle('Document PDF')).toHaveAttribute('src', 'blob:mock-url')
  })

  it('prints a multi-selected batch of visits sequentially in the inline modal', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/certificate-types') return Promise.resolve({ data: { data: certificateTypes } })
      if (url === '/visits') {
        return Promise.resolve({
          data: {
            data: [
              { ...visit, id: 10, status: 'finalized', payment_status: 'paid' },
              { ...visit, id: 11, status: 'finalized', payment_status: 'paid' },
            ],
          },
        })
      }
      if (url === '/certificates/10/print' || url === '/certificates/11/print') {
        return Promise.resolve({ data: new Blob(['%PDF-1.4']) })
      }
      return Promise.resolve({ data: { data: [] } })
    })
    renderPage(['certificate.create', 'certificate.mark_paid', 'certificate.print'])

    const table = await screen.findByRole('table')
    await waitFor(() => expect(within(table).getAllByRole('checkbox').length).toBe(2))
    await userEvent.click(within(table).getAllByRole('checkbox')[0])
    await userEvent.click(within(table).getAllByRole('checkbox')[1])

    await userEvent.click(screen.getByText('Imprimer la sélection (2)'))

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/certificates/10/print', { responseType: 'blob' }))
    await waitFor(() => expect(screen.getByTitle('Document PDF')).toBeInTheDocument())

    await userEvent.click(screen.getByLabelText('Fermer'))

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/certificates/11/print', { responseType: 'blob' }))
    await waitFor(() => expect(screen.getByTitle('Document PDF')).toBeInTheDocument())

    await userEvent.click(screen.getByLabelText('Fermer'))
    await waitFor(() => expect(screen.queryByTitle('Document PDF')).not.toBeInTheDocument())
  })

  it('marks a multi-selected batch of visits as printed in one action', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/certificate-types') return Promise.resolve({ data: { data: certificateTypes } })
      if (url === '/visits') {
        return Promise.resolve({
          data: {
            data: [
              { ...visit, id: 10, status: 'finalized', payment_status: 'paid' },
              { ...visit, id: 11, status: 'finalized', payment_status: 'paid' },
            ],
          },
        })
      }
      return Promise.resolve({ data: { data: [] } })
    })
    vi.mocked(api.post).mockResolvedValue({ data: { data: { ...visit, status: 'finalized', payment_status: 'paid', manually_printed_at: new Date().toISOString() } } })
    renderPage(['certificate.create', 'certificate.mark_paid', 'certificate.print'])

    const table = await screen.findByRole('table')
    await waitFor(() => expect(within(table).getAllByRole('checkbox').length).toBe(2))
    await userEvent.click(within(table).getAllByRole('checkbox')[0])
    await userEvent.click(within(table).getAllByRole('checkbox')[1])

    await userEvent.click(screen.getByText('Marquer la sélection imprimée (2)'))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/visits/10/mark-printed'))
    expect(api.post).toHaveBeenCalledWith('/visits/11/mark-printed')
  })

  it('shows the registration date and time for each visit', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Jean Baptiste')).toBeInTheDocument())
    expect(screen.getByText(new Date(visit.created_at).toLocaleString('fr-FR'))).toBeInTheDocument()
  })

  it('searches today\'s visits by patient name, resetting to page 1', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Jean Baptiste')).toBeInTheDocument())

    await userEvent.type(screen.getByLabelText('Rechercher un patient'), 'Jean')

    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith('/visits', {
        params: { patient_name: 'Jean', date_from: undefined, date_to: undefined, page: 1, printed: 0 },
      }),
    )
  })

  it('filters today\'s visits by a registration date range', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Jean Baptiste')).toBeInTheDocument())

    await userEvent.type(screen.getByLabelText('Du'), '2026-07-01')
    await userEvent.type(screen.getByLabelText('Au'), '2026-07-30')

    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith('/visits', {
        params: { patient_name: undefined, date_from: '2026-07-01', date_to: '2026-07-30', page: 1, printed: 0 },
      }),
    )
  })

  it('shows pagination controls and fetches the next page when today\'s visits exceed one page', async () => {
    vi.mocked(api.get).mockImplementation((url: string, config?: { params?: { page?: number } }) => {
      if (url === '/certificate-types') return Promise.resolve({ data: { data: certificateTypes } })
      if (url === '/visits') {
        const page = config?.params?.page ?? 1
        return Promise.resolve({
          data: {
            data: [{ ...visit, id: page }],
            meta: { current_page: page, last_page: 2, per_page: 20, total: 21 },
          },
        })
      }
      return Promise.resolve({ data: { data: [] } })
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Page 1 sur 2 (21 au total)')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Précédent' })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: 'Suivant' }))

    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith('/visits', {
        params: { patient_name: undefined, date_from: undefined, date_to: undefined, page: 2, printed: 0 },
      }),
    )
    await waitFor(() => expect(screen.getByText('Page 2 sur 2 (21 au total)')).toBeInTheDocument())
  })

  it('hides the print button for users without certificate.print', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/certificate-types') return Promise.resolve({ data: { data: certificateTypes } })
      if (url === '/visits') return Promise.resolve({ data: { data: [{ ...visit, status: 'finalized', payment_status: 'paid' }] } })
      return Promise.resolve({ data: { data: [] } })
    })
    renderPage(['certificate.create', 'certificate.mark_paid'])

    await waitFor(() => expect(screen.getByText('Prêt à imprimer')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Imprimer' })).not.toBeInTheDocument()
  })

  it('requests only unprinted visits', async () => {
    renderPage()
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith('/visits', {
        params: { patient_name: undefined, date_from: undefined, date_to: undefined, page: 1, printed: 0 },
      }),
    )
  })

  it('marks a finalized visit as printed, removing it from the list on refetch', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/certificate-types') return Promise.resolve({ data: { data: certificateTypes } })
      if (url === '/visits') return Promise.resolve({ data: { data: [{ ...visit, status: 'finalized', payment_status: 'paid' }] } })
      return Promise.resolve({ data: { data: [] } })
    })
    vi.mocked(api.post).mockResolvedValue({ data: { data: { ...visit, status: 'finalized', payment_status: 'paid', manually_printed_at: new Date().toISOString() } } })
    renderPage(['certificate.create', 'certificate.mark_paid', 'certificate.print'])

    await waitFor(() => expect(screen.getByRole('button', { name: 'Marquer imprimé' })).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Marquer imprimé' }))

    expect(api.post).toHaveBeenCalledWith('/visits/10/mark-printed')
  })

  it('hides the mark-printed button for users without certificate.print', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/certificate-types') return Promise.resolve({ data: { data: certificateTypes } })
      if (url === '/visits') return Promise.resolve({ data: { data: [{ ...visit, status: 'finalized', payment_status: 'paid' }] } })
      return Promise.resolve({ data: { data: [] } })
    })
    renderPage(['certificate.create', 'certificate.mark_paid'])

    await waitFor(() => expect(screen.getByText('Prêt à imprimer')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Marquer imprimé' })).not.toBeInTheDocument()
  })

  it('hides the mark-printed button for a draft visit', async () => {
    renderPage(['certificate.create', 'certificate.mark_paid', 'certificate.print'])
    await waitFor(() => expect(screen.getByText('Jean Baptiste')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Marquer imprimé' })).not.toBeInTheDocument()
  })
})
