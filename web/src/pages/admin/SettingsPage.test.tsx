import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SettingsPage } from './SettingsPage'
import { api } from '../../lib/api'

vi.mock('../../lib/api', () => ({ api: { get: vi.fn(), put: vi.fn() } }))

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <SettingsPage />
    </QueryClientProvider>,
  )
}

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.put).mockReset()
    vi.mocked(api.get).mockResolvedValue({ data: { data: { directeur_medical_name: 'Dr. Joseph Edmond Pierre' } } })
  })

  it('displays existing settings and saves an edit', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: {} })
    renderPage()

    const input = await screen.findByLabelText('directeur_medical_name')
    await userEvent.clear(input)
    await userEvent.type(input, 'Dr. Nouveau Nom')
    await userEvent.click(screen.getAllByText('Enregistrer')[0])

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/settings/directeur_medical_name', { value: 'Dr. Nouveau Nom' }))
  })

  it('adds a new setting', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: {} })
    renderPage()

    await screen.findByLabelText('directeur_medical_name')
    await userEvent.type(screen.getByLabelText('Clé'), 'hopital_telephone')
    await userEvent.type(screen.getByLabelText('Valeur'), '+509 1234-5678')
    await userEvent.click(screen.getByText('Ajouter'))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/settings/hopital_telephone', { value: '+509 1234-5678' }))
  })
})
