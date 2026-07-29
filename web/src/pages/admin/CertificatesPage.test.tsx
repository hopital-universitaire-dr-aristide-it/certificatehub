import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CertificatesPage } from './CertificatesPage'
import { renderWithProviders, seedUser, makeUser } from '../../test/renderWithProviders'
import { api } from '../../lib/api'
import type { Certificate } from '../../types'

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api')
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }
})

const oversightPermissions = [
  'certificate.view',
  'certificate.print',
  'certificate.delete',
  'certificate.restore',
  'certificate.cancel_payment',
]

function cert(overrides: Partial<Certificate> = {}): Certificate {
  return {
    id: 1,
    patient_id: 1,
    patient_name: 'Jean Baptiste',
    certificate_type_id: 1,
    doctor_id: null,
    fee_amount: 500,
    certificate_number: 'CS-000001',
    status: 'finalized',
    payment_status: 'paid',
    paid_at: new Date().toISOString(),
    finalized_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    deleted_at: null,
    ...overrides,
  }
}

function renderPage(permissions: string[] = oversightPermissions) {
  seedUser(makeUser({ roles: ['admin'], permissions }))
  renderWithProviders(<CertificatesPage />)
}

describe('CertificatesPage', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.post).mockReset()
    vi.mocked(api.delete).mockReset()
    URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    URL.revokeObjectURL = vi.fn()
  })

  it('lists certificates and requests name/date filters', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [cert()] } })
    renderPage()

    await waitFor(() => expect(screen.getByText('Jean Baptiste')).toBeInTheDocument())

    await userEvent.type(screen.getByLabelText('Nom du patient'), 'Jean')

    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith('/visits', {
        params: { patient_name: 'Jean', date_from: undefined, date_to: undefined },
      }),
    )
  })

  it('cancels a certificate after confirming', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(api.get).mockResolvedValue({ data: { data: [cert()] } })
    vi.mocked(api.delete).mockResolvedValue({ data: {} })
    renderPage()

    await waitFor(() => expect(screen.getByText('Jean Baptiste')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Annuler le certificat' }))

    expect(api.delete).toHaveBeenCalledWith('/certificates/1')
  })

  it('cancels a payment after confirming', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(api.get).mockResolvedValue({ data: { data: [cert()] } })
    vi.mocked(api.post).mockResolvedValue({ data: {} })
    renderPage()

    await waitFor(() => expect(screen.getByText('Jean Baptiste')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Annuler le paiement' }))

    expect(api.post).toHaveBeenCalledWith('/visits/1/cancel-payment')
  })

  it('prints a multi-selected batch sequentially in the inline modal', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/visits') return Promise.resolve({ data: { data: [cert({ id: 1 }), cert({ id: 2 })] } })
      if (url === '/certificates/1/print' || url === '/certificates/2/print') {
        return Promise.resolve({ data: new Blob(['%PDF-1.4']) })
      }
      return Promise.resolve({ data: { data: [] } })
    })
    renderPage()

    await waitFor(() => expect(screen.getAllByRole('checkbox').length).toBe(2))
    await userEvent.click(screen.getAllByRole('checkbox')[0])
    await userEvent.click(screen.getAllByRole('checkbox')[1])

    await userEvent.click(screen.getByText('Imprimer la sélection (2)'))

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/certificates/1/print', { responseType: 'blob' }))
    await waitFor(() => expect(screen.getByTitle('Document PDF')).toBeInTheDocument())

    await userEvent.click(screen.getByLabelText('Fermer'))

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/certificates/2/print', { responseType: 'blob' }))
    await waitFor(() => expect(screen.getByTitle('Document PDF')).toBeInTheDocument())

    await userEvent.click(screen.getByLabelText('Fermer'))
    await waitFor(() => expect(screen.queryByTitle('Document PDF')).not.toBeInTheDocument())
  })

  it('prints a single finalized certificate in the inline modal', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/visits') return Promise.resolve({ data: { data: [cert()] } })
      if (url === '/certificates/1/print') return Promise.resolve({ data: new Blob(['%PDF-1.4']) })
      return Promise.resolve({ data: { data: [] } })
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Jean Baptiste')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Imprimer' }))

    await waitFor(() => expect(screen.getByTitle('Document PDF')).toBeInTheDocument())
    expect(screen.getByTitle('Document PDF')).toHaveAttribute('src', 'blob:mock-url')
  })

  it('shows the trash view with restore action', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/visits') return Promise.resolve({ data: { data: [] } })
      if (url === '/certificates/trashed') return Promise.resolve({ data: { data: [cert({ deleted_at: new Date().toISOString() })] } })
      return Promise.resolve({ data: { data: [] } })
    })
    vi.mocked(api.post).mockResolvedValue({ data: {} })
    renderPage()

    await userEvent.click(screen.getByText('Corbeille'))
    await waitFor(() => expect(screen.getByText('Jean Baptiste')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: 'Rétablir le certificat' }))
    expect(api.post).toHaveBeenCalledWith('/certificates/1/restore')
  })

  it('hides oversight actions and the trash toggle for a user without those permissions', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [cert()] } })
    renderPage(['certificate.view'])

    await waitFor(() => expect(screen.getByText('Jean Baptiste')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Annuler le certificat' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Annuler le paiement' })).not.toBeInTheDocument()
    expect(screen.queryByText('Corbeille')).not.toBeInTheDocument()
  })
})
