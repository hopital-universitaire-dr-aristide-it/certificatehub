import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
  patient_age: 34,
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

  it('lists paid certificates awaiting a doctor without showing the fee amount', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [cert] } })
    renderPage()
    await waitFor(() => expect(screen.getByText('Marie Claire')).toBeInTheDocument())
    expect(screen.getByText('Prendre en charge')).toBeInTheDocument()
    expect(screen.getByText('34')).toBeInTheDocument()
    expect(screen.queryByText('Montant')).not.toBeInTheDocument()
    expect(screen.queryByText(/500/)).not.toBeInTheDocument()
  })

  it('shows an empty state when the queue is empty', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } })
    renderPage()
    await waitFor(() => expect(screen.getByText('Aucun certificat en attente.')).toBeInTheDocument())
  })

  it('searches by patient name, resetting to page 1', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [cert] } })
    renderPage()
    await waitFor(() => expect(screen.getByText('Marie Claire')).toBeInTheDocument())

    await userEvent.type(screen.getByLabelText('Rechercher un patient'), 'Marie')

    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith('/certificates/queue', {
        params: { patient_name: 'Marie', page: 1 },
      }),
    )
  })

  it('shows pagination controls and fetches the next page when the backlog exceeds one page', async () => {
    vi.mocked(api.get).mockImplementation((_url: string, config?: { params?: { page?: number } }) => {
      const page = config?.params?.page ?? 1
      return Promise.resolve({
        data: {
          data: [{ ...cert, id: page }],
          meta: { current_page: page, last_page: 2, per_page: 20, total: 21 },
        },
      })
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Page 1 sur 2 (21 au total)')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Précédent' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Suivant' })).not.toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: 'Suivant' }))

    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith('/certificates/queue', {
        params: { patient_name: undefined, page: 2 },
      }),
    )
    await waitFor(() => expect(screen.getByText('Page 2 sur 2 (21 au total)')).toBeInTheDocument())
  })

  it('hides pagination controls when everything fits on one page', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { data: [cert], meta: { current_page: 1, last_page: 1, per_page: 20, total: 1 } },
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Marie Claire')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Suivant' })).not.toBeInTheDocument()
  })
})
