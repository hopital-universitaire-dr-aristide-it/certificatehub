import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MyCertificatesPage } from './MyCertificatesPage'
import { api } from '../../lib/api'
import type { Certificate } from '../../types'

vi.mock('../../lib/api', () => ({ api: { get: vi.fn() } }))

const cert: Certificate = {
  id: 1,
  patient_id: 1,
  patient_name: 'Marie Claire',
  certificate_type_id: 1,
  doctor_id: 1,
  fee_amount: 500,
  certificate_number: 'CS-000001',
  status: 'finalized',
  payment_status: 'paid',
  paid_at: new Date().toISOString(),
  finalized_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  deleted_at: null,
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MyCertificatesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('MyCertificatesPage', () => {
  beforeEach(() => vi.mocked(api.get).mockReset())

  it("lists the doctor's own certificate history", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [cert] } })
    renderPage()

    await waitFor(() => expect(screen.getByText('Marie Claire')).toBeInTheDocument())
    expect(api.get).toHaveBeenCalledWith('/certificates/mine')
    expect(screen.getByText('CS-000001')).toBeInTheDocument()
    expect(screen.getByText('Finalisé')).toBeInTheDocument()
    expect(screen.getByText('Voir')).toBeInTheDocument()
  })

  it('shows an empty state when the doctor has no certificates yet', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } })
    renderPage()
    await waitFor(() => expect(screen.getByText("Aucun certificat réalisé pour l'instant.")).toBeInTheDocument())
  })
})
