import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CertificateTypesPage } from './CertificateTypesPage'
import { api } from '../../lib/api'
import type { CertificateType, FormDefinition } from '../../types'

vi.mock('../../lib/api', () => ({ api: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }))

const types: CertificateType[] = [
  { id: 1, form_definition_id: 1, form_label: 'Certificat de santé', is_active: true, fee_amount: 500, numbering_prefix: 'CS-', numbering_next_value: 4827 },
]

const forms: FormDefinition[] = [
  { id: 1, context_key: 'certificate.sante', module: 'Certificate', label: 'Certificat de santé', description: null, is_active: true },
]

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <CertificateTypesPage />
    </QueryClientProvider>,
  )
}

describe('CertificateTypesPage', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.put).mockReset()
    vi.mocked(api.post).mockReset()
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/certificate-types') return Promise.resolve({ data: { data: types } })
      if (url === '/form-definitions') return Promise.resolve({ data: { data: forms } })
      return Promise.resolve({ data: { data: [] } })
    })
  })

  it('lists existing certificate types and saves fee/numbering changes', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: {} })
    renderPage()

    await waitFor(() => expect(screen.getByText('Certificat de santé', { selector: 'p' })).toBeInTheDocument())

    const feeInput = screen.getByLabelText('Tarif (HTG)', { selector: '#fee-1' })
    await userEvent.clear(feeInput)
    await userEvent.type(feeInput, '750')
    await userEvent.click(screen.getAllByRole('button', { name: 'Enregistrer' })[0])

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/certificate-types/1', {
        fee_amount: 750,
        numbering_prefix: 'CS-',
        numbering_next_value: 4827,
      }),
    )
  })

  it('creates a new certificate type', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: {} })
    renderPage()

    await screen.findByText('Certificat de santé', { selector: 'option' })
    await userEvent.selectOptions(screen.getByLabelText('Formulaire'), '1')
    await userEvent.type(screen.getByLabelText('Tarif (HTG)', { selector: '#new-fee' }), '300')
    await userEvent.click(screen.getByText('Créer'))

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/certificate-types', {
        form_definition_id: 1,
        fee_amount: 300,
        numbering_prefix: '',
        numbering_next_value: 1,
      }),
    )
  })
})
