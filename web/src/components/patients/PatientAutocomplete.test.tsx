import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { PatientAutocomplete } from './PatientAutocomplete'
import { api } from '../../lib/api'
import type { PatientSummary } from '../../types'

vi.mock('../../lib/api', () => ({ api: { get: vi.fn() } }))

function renderAutocomplete(onSelect = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <PatientAutocomplete onSelect={onSelect} />
    </QueryClientProvider>,
  )
  return onSelect
}

describe('PatientAutocomplete', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
  })

  it('searches after 2+ characters and lists results', async () => {
    const patients: PatientSummary[] = [
      { id: 1, full_name: 'Jean Baptiste', date_of_birth: '1990-01-01', residence: 'Port-au-Prince' },
    ]
    vi.mocked(api.get).mockResolvedValue({ data: { data: patients } })

    const onSelect = renderAutocomplete()
    await userEvent.type(screen.getByPlaceholderText(/rechercher un patient/i), 'Je')

    await waitFor(() => expect(screen.getByText('Jean Baptiste')).toBeInTheDocument(), { timeout: 2000 })

    await userEvent.click(screen.getByText('Jean Baptiste'))
    expect(onSelect).toHaveBeenCalledWith(patients[0])
  })

  it('shows a no-results message when the search is empty', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } })

    renderAutocomplete()
    await userEvent.type(screen.getByPlaceholderText(/rechercher un patient/i), 'Zz')

    await waitFor(() => expect(screen.getByText('Aucun patient trouvé.')).toBeInTheDocument(), { timeout: 2000 })
  })
})
