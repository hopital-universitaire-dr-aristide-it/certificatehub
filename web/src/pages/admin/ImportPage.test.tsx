import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ImportPage } from './ImportPage'
import { renderWithProviders, seedUser, makeUser } from '../../test/renderWithProviders'
import { api } from '../../lib/api'
import type { ImportParseResult, ImportUpload, User } from '../../types'

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api')
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }
})

const doctorUser: User = {
  id: 9,
  name: 'Salomon',
  email: 'salomon@gmail.com',
  is_active: true,
  roles: ['doctor'],
  created_at: new Date().toISOString(),
  deleted_at: null,
}

const pendingUpload: ImportUpload = {
  id: 1,
  tag: 'Lot Test',
  original_filename: 'certs.json',
  uploaded_by_name: 'Super Admin',
  created_at: new Date().toISOString(),
  completed_at: null,
}

function parseResult(overrides: Partial<ImportParseResult> = {}): ImportParseResult {
  return {
    patients: [
      {
        row_id: 'p0',
        source_file: 'a.png',
        first_name: 'Jean',
        last_name: 'Pierre',
        sex: null,
        date_of_birth: '2000-01-01',
        age: null,
        residence: 'Delmas',
        exact_duplicate_patient_id: null,
        potential_duplicates: [],
      },
    ],
    doctors: [
      {
        row_id: 'd0',
        name: 'Dr. Salomon',
        normalized_name: 'salomon',
        matched_user_id: 9,
        matched_user_name: 'Salomon',
        action: 'existing',
      },
    ],
    certificates: [
      {
        row_id: 'c0',
        source_file: 'a.png',
        patient_row_id: 'p0',
        doctor_row_id: 'd0',
        exam_date: '2026-08-01',
        form_data: {
          outcome: 'sain',
          sign_contagieux: false,
          sign_chronique: false,
          sign_debilitant: false,
          sign_trouble_mental: false,
          recommandation: null,
        },
      },
    ],
    skipped: [],
    ...overrides,
  }
}

function mockGetRoutes(routes: { uploads?: ImportUpload[]; parse?: ImportParseResult }) {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/users') return Promise.resolve({ data: { data: [doctorUser] } })
    if (url === '/import/uploads') return Promise.resolve({ data: { data: routes.uploads ?? [] } })
    if (url.startsWith('/import/uploads/') && url.endsWith('/parse')) {
      return Promise.resolve({ data: routes.parse ?? parseResult() })
    }
    return Promise.resolve({ data: { data: [] } })
  })
}

function renderPage(permissions: string[] = ['import.manage', 'import.review']) {
  seedUser(makeUser({ roles: ['superadmin'], permissions }))
  renderWithProviders(<ImportPage />)
}

describe('ImportPage', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.post).mockReset()
  })

  it('uploads a file, then continues immediately into the editable preview', async () => {
    mockGetRoutes({})
    vi.mocked(api.post).mockResolvedValueOnce({ data: pendingUpload })
    renderPage()

    const file = new File([JSON.stringify([])], 'certs.json', { type: 'application/json' })
    await userEvent.upload(screen.getByLabelText('Fichier JSON'), file)
    await userEvent.type(screen.getByLabelText('Étiquette (tag)'), 'Lot Test')
    await userEvent.click(screen.getByRole('button', { name: 'Uploader' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Continuer maintenant' })).toBeInTheDocument())
    const [, sentBody] = vi.mocked(api.post).mock.calls[0]
    expect(sentBody).toBeInstanceOf(FormData)
    expect((sentBody as FormData).get('tag')).toBe('Lot Test')

    await userEvent.click(screen.getByRole('button', { name: 'Continuer maintenant' }))

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/import/uploads/1/parse'))
    await waitFor(() => expect(screen.getByText('Médecins')).toBeInTheDocument())
    expect(screen.getByDisplayValue('Jean')).toBeInTheDocument()
  })

  it('lists pending uploads and lets you continue one from the list', async () => {
    mockGetRoutes({ uploads: [pendingUpload] })
    renderPage()

    await waitFor(() => expect(screen.getByText('Lot Test')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Continuer' }))

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/import/uploads/1/parse'))
    await waitFor(() => expect(screen.getByText('Certificats')).toBeInTheDocument())
  })

  it('lists skipped entries separately', async () => {
    mockGetRoutes({ uploads: [pendingUpload], parse: parseResult({ skipped: [{ source_file: 'blank.png', reason: 'scan vierge / illisible' }] }) })
    renderPage()

    await waitFor(() => expect(screen.getByText('Lot Test')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Continuer' }))

    await waitFor(() => expect(screen.getByText('Lignes ignorées')).toBeInTheDocument())
    expect(screen.getByText(/blank.png/)).toBeInTheDocument()
  })

  it('submits the edited preview to the upload-scoped confirm endpoint', async () => {
    mockGetRoutes({ uploads: [pendingUpload] })
    renderPage()

    await waitFor(() => expect(screen.getByText('Lot Test')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Continuer' }))
    await waitFor(() => expect(screen.getByText('Certificats')).toBeInTheDocument())

    const firstNameInput = screen.getByDisplayValue('Jean')
    await userEvent.clear(firstNameInput)
    await userEvent.type(firstNameInput, 'Jeanne')

    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        batch: { id: 1, tag: 'Lot Test' },
        doctors_created: 0,
        patients_created: 1,
        certificates_created: 1,
      },
    })

    await userEvent.click(screen.getByRole('button', { name: "Valider l'import" }))

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/import/uploads/1/confirm',
        expect.objectContaining({
          tag: 'Lot Test',
          patients: [expect.objectContaining({ row_id: 'p0', first_name: 'Jeanne' })],
        }),
      ),
    )
    await waitFor(() => expect(screen.getByText(/Import terminé/)).toBeInTheDocument())
  })

  it('disables the confirm button until an existing-doctor row has a matched account', async () => {
    mockGetRoutes({
      uploads: [pendingUpload],
      parse: parseResult({
        doctors: [
          {
            row_id: 'd0',
            name: 'Inconnu',
            normalized_name: 'inconnu',
            matched_user_id: null,
            matched_user_name: null,
            action: 'existing',
          },
        ],
      }),
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Lot Test')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Continuer' }))

    await waitFor(() => expect(screen.getByRole('button', { name: "Valider l'import" })).toBeDisabled())
  })

  it('hides the upload form for manager_ext but still shows the pending list', async () => {
    mockGetRoutes({ uploads: [pendingUpload] })
    seedUser(makeUser({ roles: ['manager_ext'], permissions: ['import.review'] }))
    renderWithProviders(<ImportPage />)

    expect(screen.queryByLabelText('Fichier JSON')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Lot Test')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Continuer' })).toBeInTheDocument()
  })

  it('lets a superadmin delete a pending upload after confirmation', async () => {
    mockGetRoutes({ uploads: [pendingUpload] })
    vi.mocked(api.delete).mockResolvedValueOnce({ data: undefined })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderPage()

    await waitFor(() => expect(screen.getByText('Lot Test')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }))

    expect(window.confirm).toHaveBeenCalled()
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/import/uploads/1'))
  })

  it('hides the delete button for manager_ext', async () => {
    mockGetRoutes({ uploads: [pendingUpload] })
    seedUser(makeUser({ roles: ['manager_ext'], permissions: ['import.review'] }))
    renderWithProviders(<ImportPage />)

    await waitFor(() => expect(screen.getByText('Lot Test')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Supprimer' })).not.toBeInTheDocument()
  })

  it('shows the validated badge and hides Continuer/Supprimer for a completed upload', async () => {
    mockGetRoutes({
      uploads: [
        {
          ...pendingUpload,
          completed_at: '2026-08-18T10:00:00Z',
          completed_by_name: 'Marie Reception',
        },
      ],
    })
    renderPage()

    await waitFor(() => expect(screen.getByText(/Validé le/)).toBeInTheDocument())
    expect(screen.getByText(/Marie Reception/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Continuer' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Supprimer' })).not.toBeInTheDocument()
  })
})
