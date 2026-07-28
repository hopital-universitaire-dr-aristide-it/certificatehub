import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DoctorQueuePage } from './DoctorQueuePage'
import { api } from '../../lib/api'
import type { Certificate } from '../../types'

vi.mock('../../lib/api', () => ({ api: { get: vi.fn() } }))

const cert: Certificate = {
  id: 1,
  patient_id: 1,
  patient_name: 'Marie Claire',
  certificate_type_id: 1,
  doctor_id: null,
  fee_amount: 500,
  certificate_number: null,
  status: 'draft',
  payment_status: 'paid',
  finalized_at: null,
  created_at: new Date().toISOString(),
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DoctorQueuePage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('DoctorQueuePage', () => {
  beforeEach(() => vi.mocked(api.get).mockReset())

  it('lists paid certificates awaiting a doctor', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [cert] } })
    renderPage()
    await waitFor(() => expect(screen.getByText('Marie Claire')).toBeInTheDocument())
    expect(screen.getByText('Prendre en charge')).toBeInTheDocument()
  })

  it('shows an empty state when the queue is empty', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } })
    renderPage()
    await waitFor(() => expect(screen.getByText('Aucun certificat en attente.')).toBeInTheDocument())
  })
})
