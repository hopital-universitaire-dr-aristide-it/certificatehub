import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReceptionCertificatesPage } from './ReceptionCertificatesPage'
import { renderWithProviders, seedUser, makeUser } from '../../test/renderWithProviders'
import { api } from '../../lib/api'
import type { Certificate } from '../../types'

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api')
  return { ...actual, api: { get: vi.fn() } }
})

function cert(overrides: Partial<Certificate> = {}): Certificate {
  return {
    id: 1,
    patient_id: 1,
    patient_name: 'Jean Baptiste',
    certificate_type_id: 1,
    doctor_id: 5,
    doctor_name: 'Dr Aristide',
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

function renderPage(permissions: string[] = ['certificate.create', 'certificate.print']) {
  seedUser(makeUser({ roles: ['reception'], permissions }))
  renderWithProviders(<ReceptionCertificatesPage />)
}

describe('ReceptionCertificatesPage', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    URL.revokeObjectURL = vi.fn()
  })

  it('lists certificates with the doctor who realized them', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [cert()] } })
    renderPage()

    await waitFor(() => expect(screen.getByText('Jean Baptiste')).toBeInTheDocument())
    expect(screen.getByText('Dr Aristide')).toBeInTheDocument()
  })

  it('requests patient name, doctor name and date filters', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [cert()] } })
    renderPage()

    await waitFor(() => expect(screen.getByText('Jean Baptiste')).toBeInTheDocument())

    await userEvent.type(screen.getByLabelText('Nom du patient'), 'Jean')
    await userEvent.type(screen.getByLabelText('Médecin'), 'Aristide')

    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith('/visits', {
        params: { patient_name: 'Jean', doctor_name: 'Aristide', date_from: undefined, date_to: undefined },
      }),
    )
  })

  it('prints a finalized certificate in the inline modal', async () => {
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

  it('hides print actions for users without certificate.print', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [cert()] } })
    renderPage(['certificate.create'])

    await waitFor(() => expect(screen.getByText('Jean Baptiste')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Imprimer' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Imprimer la facture' })).not.toBeInTheDocument()
  })

  it('shows an empty state when no certificates match', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } })
    renderPage()

    await waitFor(() => expect(screen.getByText('Aucun certificat trouvé.')).toBeInTheDocument())
  })
})
