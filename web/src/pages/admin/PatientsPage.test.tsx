import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PatientsPage } from './PatientsPage'
import { api } from '../../lib/api'
import type { Patient, PatientSummary } from '../../types'

vi.mock('../../lib/api', () => ({ api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }))

const searchResult: PatientSummary = { id: 1, full_name: 'Jean Baptiste', date_of_birth: '1990-01-01', residence: 'Port-au-Prince' }

const listedPatient: Patient = {
  id: 3,
  first_name: 'Bertin',
  last_name: 'Louissaint',
  full_name: 'Bertin Louissaint',
  sex: 'M',
  date_of_birth: '1985-05-05',
  age: null,
  residence: 'Tabarre',
  created_by: 1,
  created_at: new Date().toISOString(),
  deleted_at: null,
}

const trashedPatient: Patient = {
  id: 2,
  first_name: 'Marie',
  last_name: 'Claire',
  full_name: 'Marie Claire',
  sex: 'F',
  date_of_birth: null,
  age: 40,
  residence: null,
  created_by: 1,
  created_at: new Date().toISOString(),
  deleted_at: new Date().toISOString(),
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <PatientsPage />
    </QueryClientProvider>,
  )
}

describe('PatientsPage', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.post).mockReset()
    vi.mocked(api.delete).mockReset()
  })

  it('shows the full patient list by default', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [listedPatient] } })
    renderPage()

    await waitFor(() => expect(screen.getByText('Bertin Louissaint')).toBeInTheDocument())
    expect(api.get).toHaveBeenCalledWith('/patients')
  })

  it('searches, selects and soft-deletes a patient after confirming', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(api.get).mockResolvedValue({ data: { data: [searchResult] } })
    vi.mocked(api.delete).mockResolvedValue({ data: {} })

    renderPage()
    await userEvent.click(screen.getByText('Rechercher'))
    await userEvent.type(screen.getByPlaceholderText(/rechercher un patient/i), 'Je')
    await waitFor(() => expect(screen.getByText('Jean Baptiste')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Jean Baptiste'))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Supprimer' })).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }))

    expect(api.delete).toHaveBeenCalledWith('/patients/1')
  })

  it('lists trashed patients and lets a superadmin restore one', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/patients/trashed') return Promise.resolve({ data: { data: [trashedPatient] } })
      return Promise.resolve({ data: { data: [] } })
    })
    vi.mocked(api.post).mockResolvedValue({ data: {} })

    renderPage()
    await userEvent.click(screen.getByText('Corbeille'))

    await waitFor(() => expect(screen.getByText('Marie Claire')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Rétablir' }))

    expect(api.post).toHaveBeenCalledWith('/patients/2/restore')
  })
})
