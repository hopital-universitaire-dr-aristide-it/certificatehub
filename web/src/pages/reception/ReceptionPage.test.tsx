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
    await waitFor(() => expect(screen.getByText('Enregistrer la visite')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Enregistrer la visite'))
    expect(screen.getByText('Sélectionnez un patient et un type de certificat.')).toBeInTheDocument()
  })

  it('pre-selects the certificate type and pre-checks payment received by default', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByLabelText('Type de certificat')).toHaveValue('1'))
    expect(screen.getByLabelText('Paiement reçu maintenant')).toBeChecked()
  })

  it('registers a visit with mark_paid, using the pre-filled type and checkbox', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { ...visit, payment_status: 'paid' } } })
    renderPage()

    await waitFor(() => expect(screen.getByText('Certificat de santé — 500 G')).toBeInTheDocument())
    await waitFor(() => expect(screen.getByLabelText('Type de certificat')).toHaveValue('1'))
    expect(screen.getByLabelText('Paiement reçu maintenant')).toBeChecked()

    // Simule la selection d'un patient sans passer par l'autocomplete reel.
    await userEvent.click(screen.getByText('Nouveau patient'))
    await userEvent.type(screen.getByLabelText('Prénom'), 'Jean')
    await userEvent.type(screen.getByLabelText('Nom'), 'Baptiste')

    vi.mocked(api.post).mockResolvedValueOnce({ data: { patient: { id: 1, first_name: 'Jean', last_name: 'Baptiste', full_name: 'Jean Baptiste' }, potential_duplicates: [] } })
    await userEvent.click(screen.getByText('Créer le patient'))

    await waitFor(() => expect(screen.getByText(/Patient sélectionné/)).toBeInTheDocument())
    await userEvent.click(screen.getByText('Enregistrer la visite'))

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/visits', {
        patient_id: 1,
        certificate_type_id: 1,
        mark_paid: true,
      }),
    )
  })

  it('shows a progress bar while registering a visit', async () => {
    let resolvePost!: (value: { data: { data: Certificate } }) => void
    vi.mocked(api.post).mockImplementation(
      () => new Promise((resolve) => { resolvePost = resolve }),
    )
    renderPage()

    await userEvent.click(screen.getByText('Nouveau patient'))
    await userEvent.type(screen.getByLabelText('Prénom'), 'Jean')
    await userEvent.type(screen.getByLabelText('Nom'), 'Baptiste')

    let resolvePatientPost!: (value: unknown) => void
    vi.mocked(api.post).mockImplementationOnce(() => new Promise((resolve) => { resolvePatientPost = resolve }))
    await userEvent.click(screen.getByText('Créer le patient'))
    expect(screen.getByRole('progressbar', { name: 'Enregistrement du patient...' })).toBeInTheDocument()
    resolvePatientPost({ data: { patient: { id: 1, first_name: 'Jean', last_name: 'Baptiste', full_name: 'Jean Baptiste' }, potential_duplicates: [] } })

    await waitFor(() => expect(screen.getByText(/Patient sélectionné/)).toBeInTheDocument())
    await userEvent.click(screen.getByText('Enregistrer la visite'))

    expect(screen.getByRole('progressbar', { name: 'Enregistrement de la visite...' })).toBeInTheDocument()
    resolvePost({ data: { data: { ...visit, payment_status: 'paid' } } })

    await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument())
  })

  it('switches to the new-patient form', async () => {
    renderPage()
    await userEvent.click(screen.getByText('Nouveau patient'))
    expect(screen.getByLabelText('Prénom')).toBeInTheDocument()
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
})
