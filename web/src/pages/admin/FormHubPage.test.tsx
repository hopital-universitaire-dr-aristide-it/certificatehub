import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FormHubPage } from './FormHubPage'
import { api } from '../../lib/api'
import type { FormDefinition, FormField } from '../../types'

vi.mock('../../lib/api', () => ({ api: { get: vi.fn(), patch: vi.fn(), post: vi.fn() } }))

const forms: FormDefinition[] = [
  { id: 1, context_key: 'certificate.sante', module: 'Certificate', label: 'Certificat de santé', description: null, is_active: true },
]

const fields: FormField[] = [
  {
    id: 1,
    field_key: 'outcome',
    label: 'Résultat',
    default_label: 'Résultat',
    field_type: 'select',
    is_required: true,
    is_active: true,
    sort_order: 0,
    config: null,
    children: [],
  },
]

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <FormHubPage />
    </QueryClientProvider>,
  )
}

describe('FormHubPage', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.patch).mockReset()
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/form-definitions') return Promise.resolve({ data: { data: forms } })
      if (url === '/form-definitions/1/admin-fields') return Promise.resolve({ data: { data: fields } })
      return Promise.resolve({ data: { data: [] } })
    })
  })

  it('loads fields once a form is selected and allows renaming', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: {} })
    renderPage()

    await screen.findByText('Certificat de santé')
    await userEvent.selectOptions(screen.getByLabelText('Formulaire'), '1')

    await waitFor(() => expect(screen.getByDisplayValue('Résultat')).toBeInTheDocument())

    const input = screen.getByDisplayValue('Résultat')
    await userEvent.clear(input)
    await userEvent.type(input, 'Diagnostic')
    await userEvent.click(screen.getByRole('button', { name: 'Renommer' }))

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/form-fields/1/rename', { label: 'Diagnostic' }))
  })

  it('toggles a field active state', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: {} })
    renderPage()

    await screen.findByText('Certificat de santé')
    await userEvent.selectOptions(screen.getByLabelText('Formulaire'), '1')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Désactiver' })).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Désactiver' }))

    expect(api.patch).toHaveBeenCalledWith('/form-fields/1/active', { is_active: false })
  })
})
