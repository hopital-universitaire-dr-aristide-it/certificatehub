import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PatientsPage } from './PatientsPage'
import { renderWithProviders, seedUser, makeUser } from '../../test/renderWithProviders'
import { api } from '../../lib/api'
import type { Patient, PatientSummary } from '../../types'

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api')
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

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

function renderPage(permissions: string[] = ['patient.update']) {
  seedUser(makeUser({ roles: ['superadmin'], permissions }))
  renderWithProviders(<PatientsPage />)
}

describe('PatientsPage', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.post).mockReset()
    vi.mocked(api.put).mockReset()
    vi.mocked(api.delete).mockReset()
  })

  it('shows the full patient list by default', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [listedPatient] } })
    renderPage()

    await waitFor(() => expect(screen.getByText('Bertin Louissaint')).toBeInTheDocument())
    expect(api.get).toHaveBeenCalledWith('/patients', { params: { page: 1 } })
  })

  it('shows pagination controls in the list view and fetches the next page', async () => {
    vi.mocked(api.get).mockImplementation((url: string, config?: { params?: { page?: number } }) => {
      if (url === '/patients') {
        const page = config?.params?.page ?? 1
        return Promise.resolve({
          data: { data: [{ ...listedPatient, id: page }], meta: { current_page: page, last_page: 2, per_page: 20, total: 21 } },
        })
      }
      return Promise.resolve({ data: { data: [] } })
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Page 1 sur 2 (21 au total)')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Précédent' })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: 'Suivant' }))

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/patients', { params: { page: 2 } }))
    await waitFor(() => expect(screen.getByText('Page 2 sur 2 (21 au total)')).toBeInTheDocument())
  })

  it('shows pagination controls in the trash view and fetches the next page', async () => {
    vi.mocked(api.get).mockImplementation((url: string, config?: { params?: { page?: number } }) => {
      if (url === '/patients/trashed') {
        const page = config?.params?.page ?? 1
        return Promise.resolve({
          data: { data: [{ ...trashedPatient, id: page }], meta: { current_page: page, last_page: 2, per_page: 20, total: 21 } },
        })
      }
      return Promise.resolve({ data: { data: [] } })
    })
    renderPage()

    await userEvent.click(screen.getByText('Corbeille'))
    await waitFor(() => expect(screen.getByText('Page 1 sur 2 (21 au total)')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: 'Suivant' }))

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/patients/trashed', { params: { page: 2 } }))
    await waitFor(() => expect(screen.getByText('Page 2 sur 2 (21 au total)')).toBeInTheDocument())
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

  it('hides the "Modifier" button without patient.update', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [listedPatient] } })
    renderPage([])

    await waitFor(() => expect(screen.getByText('Bertin Louissaint')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Modifier' })).not.toBeInTheDocument()
  })

  it('lets a superadmin edit a patient\'s info from the list', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/patients') return Promise.resolve({ data: { data: [listedPatient] } })
      if (url === '/patients/3') return Promise.resolve({ data: { data: listedPatient } })
      return Promise.resolve({ data: { data: [] } })
    })
    vi.mocked(api.put).mockResolvedValue({ data: { data: { ...listedPatient, residence: 'Delmas' } } })
    renderPage()

    await waitFor(() => expect(screen.getByText('Bertin Louissaint')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Modifier' }))

    await waitFor(() => expect(screen.getByLabelText('Prénom')).toHaveValue('Bertin'))
    await userEvent.clear(screen.getByLabelText('Résidence'))
    await userEvent.type(screen.getByLabelText('Résidence'), 'Delmas')
    await userEvent.click(screen.getByText('Enregistrer'))

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/patients/3', {
        first_name: 'Bertin',
        last_name: 'Louissaint',
        sex: 'M',
        date_of_birth: '1985-05-05',
        residence: 'Delmas',
      }),
    )
    await waitFor(() => expect(screen.queryByText('Modifier le patient')).not.toBeInTheDocument())
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
