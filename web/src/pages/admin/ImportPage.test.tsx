import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ImportPage } from './ImportPage'
import { renderWithProviders, seedUser, makeUser } from '../../test/renderWithProviders'
import { api } from '../../lib/api'
import type { ImportParseResult, User } from '../../types'

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api')
  return { ...actual, api: { get: vi.fn(), post: vi.fn() } }
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

function renderPage() {
  seedUser(makeUser({ roles: ['superadmin'], permissions: ['import.manage'] }))
  renderWithProviders(<ImportPage />)
}

async function uploadAndAnalyze(result: ImportParseResult) {
  vi.mocked(api.post).mockResolvedValueOnce({ data: result })

  const file = new File([JSON.stringify([])], 'certs.json', { type: 'application/json' })
  await userEvent.upload(screen.getByLabelText('Fichier JSON'), file)
  await userEvent.type(screen.getByLabelText('Étiquette (tag)'), 'Lot Test')
  await userEvent.click(screen.getByRole('button', { name: 'Analyser' }))

  await waitFor(() => expect(screen.getByText('Médecins')).toBeInTheDocument())
}

describe('ImportPage', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.post).mockReset()
    vi.mocked(api.get).mockResolvedValue({ data: { data: [doctorUser] } })
  })

  it('parses an uploaded file and shows editable preview lists', async () => {
    renderPage()

    await uploadAndAnalyze(parseResult())

    expect(screen.getByDisplayValue('Jean')).toBeInTheDocument()
    // "Dr. Salomon" appears twice: the doctors-table Input, and the certificate row's doctor <select>.
    expect(screen.getAllByDisplayValue('Dr. Salomon')).toHaveLength(2)
    expect(screen.getByText('Certificats')).toBeInTheDocument()

    const [, sentBody] = vi.mocked(api.post).mock.calls[0]
    expect(sentBody).toBeInstanceOf(FormData)
    expect((sentBody as FormData).get('tag')).toBe('Lot Test')
  })

  it('lists skipped entries separately', async () => {
    renderPage()

    await uploadAndAnalyze(
      parseResult({ skipped: [{ source_file: 'blank.png', reason: 'scan vierge / illisible' }] }),
    )

    expect(screen.getByText('Lignes ignorées')).toBeInTheDocument()
    expect(screen.getByText(/blank.png/)).toBeInTheDocument()
  })

  it('submits the edited preview to /import/confirm', async () => {
    renderPage()
    await uploadAndAnalyze(parseResult())

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
      expect(api.post).toHaveBeenCalledWith('/import/confirm', expect.objectContaining({
        tag: 'Lot Test',
        patients: [expect.objectContaining({ row_id: 'p0', first_name: 'Jeanne' })],
      })),
    )
    await waitFor(() => expect(screen.getByText(/Import terminé/)).toBeInTheDocument())
  })

  it('disables the confirm button until an existing-doctor row has a matched account', async () => {
    renderPage()
    await uploadAndAnalyze(
      parseResult({
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
    )

    expect(screen.getByRole('button', { name: "Valider l'import" })).toBeDisabled()
  })
})
