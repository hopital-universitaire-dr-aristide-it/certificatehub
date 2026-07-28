import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NewPatientForm } from './NewPatientForm'
import { api } from '../../lib/api'

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api')
  return { ...actual, api: { post: vi.fn() } }
})

function renderForm(onCreated = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <NewPatientForm onCreated={onCreated} />
    </QueryClientProvider>,
  )
  return onCreated
}

describe('NewPatientForm', () => {
  beforeEach(() => {
    vi.mocked(api.post).mockReset()
  })

  it('submits the form and reports potential duplicates', async () => {
    const patient = { id: 5, first_name: 'Jean', last_name: 'Baptiste', full_name: 'Jean Baptiste' }
    vi.mocked(api.post).mockResolvedValue({
      data: { patient, potential_duplicates: [{ id: 6, full_name: 'Jean Baptist', date_of_birth: '1990-01-01' }] },
    })

    const onCreated = renderForm()

    await userEvent.type(screen.getByLabelText('Prenom'), 'Jean')
    await userEvent.type(screen.getByLabelText('Nom'), 'Baptiste')
    await userEvent.click(screen.getByText('Creer le patient'))

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(patient))
    expect(screen.getByText('Jean Baptist')).toBeInTheDocument()
  })
})
