import { useState } from 'react'
import { Pencil, Trash2, RotateCcw } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, apiErrorMessage } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { IconButton } from '../../components/ui/IconButton'
import { Badge } from '../../components/ui/Badge'
import { FieldError } from '../../components/ui/Field'
import { PatientAutocomplete } from '../../components/patients/PatientAutocomplete'
import { PatientEditModal } from '../../components/patients/PatientEditModal'
import type { Patient, PatientSummary, PaginatedResponse } from '../../types'

type View = 'list' | 'search' | 'trash'

export function PatientsPage() {
  const queryClient = useQueryClient()
  const { hasPermission } = useAuth()
  const canEditPatient = hasPermission('patient.update')
  const [error, setError] = useState<string | null>(null)
  const [selectedPatient, setSelectedPatient] = useState<PatientSummary | Patient | null>(null)
  const [editingPatientId, setEditingPatientId] = useState<number | null>(null)
  const [view, setView] = useState<View>('list')
  const [listPage, setListPage] = useState(1)
  const [trashPage, setTrashPage] = useState(1)

  const { data: listResponse, isError: isListError } = useQuery({
    queryKey: ['patients', listPage],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<Patient>>('/patients', { params: { page: listPage } })
      return data
    },
    enabled: view === 'list',
  })
  const patients = listResponse?.data
  const listMeta = listResponse?.meta

  const { data: trashedResponse, isError: isTrashError } = useQuery({
    queryKey: ['patients-trashed', trashPage],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<Patient>>('/patients/trashed', { params: { page: trashPage } })
      return data
    },
    enabled: view === 'trash',
  })
  const trashedPatients = trashedResponse?.data
  const trashMeta = trashedResponse?.meta

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['patients'] })
    queryClient.invalidateQueries({ queryKey: ['patients-trashed'] })
  }

  const deleteMutation = useMutation({
    mutationFn: async (patientId: number) => {
      await api.delete(`/patients/${patientId}`)
    },
    onSuccess: () => {
      setSelectedPatient(null)
      invalidate()
    },
    onError: (err) => setError(apiErrorMessage(err)),
  })

  const restoreMutation = useMutation({
    mutationFn: async (patientId: number) => {
      await api.post(`/patients/${patientId}/restore`)
    },
    onSuccess: invalidate,
    onError: (err) => setError(apiErrorMessage(err)),
  })

  function confirmDelete(patient: { id: number; full_name: string }) {
    if (window.confirm(`Supprimer le dossier de ${patient.full_name} ? Il pourra être rétabli depuis la corbeille.`)) {
      deleteMutation.mutate(patient.id)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Patients"
          subtitle="Liste des dossiers patients"
          action={
            <div className="flex gap-2">
              <Button variant={view === 'list' ? 'primary' : 'secondary'} onClick={() => setView('list')}>
                Liste
              </Button>
              <Button variant={view === 'search' ? 'primary' : 'secondary'} onClick={() => setView('search')}>
                Rechercher
              </Button>
              <Button variant={view === 'trash' ? 'primary' : 'secondary'} onClick={() => setView('trash')}>
                Corbeille
              </Button>
            </div>
          }
        />
        <FieldError message={error ?? undefined} />

        {view === 'list' && (
          <div className="overflow-x-auto">
            {isListError && <p className="py-4 text-center text-sm text-red-600">Impossible de charger la liste des patients.</p>}
            {!isListError && (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
                    <th className="py-2 pr-4">Nom</th>
                    <th className="py-2 pr-4">Date de naissance</th>
                    <th className="py-2 pr-4">Résidence</th>
                    <th className="py-2 pr-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {patients?.map((patient) => (
                    <tr key={patient.id} className="border-b border-neutral-100 dark:border-neutral-900">
                      <td className="py-2 pr-4">{patient.full_name}</td>
                      <td className="py-2 pr-4">{patient.date_of_birth ?? '—'}</td>
                      <td className="py-2 pr-4">{patient.residence ?? '—'}</td>
                      <td className="py-2 pr-4 text-right">
                        <div className="flex justify-end gap-1">
                          {canEditPatient && (
                            <IconButton icon={Pencil} label="Modifier" onClick={() => setEditingPatientId(patient.id)} />
                          )}
                          <IconButton icon={Trash2} label="Supprimer" tone="danger" onClick={() => confirmDelete(patient)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {patients?.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-neutral-500">
                        Aucun patient enregistré.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
            {listMeta && listMeta.last_page > 1 && (
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-neutral-500">
                  Page {listMeta.current_page} sur {listMeta.last_page} ({listMeta.total} au total)
                </span>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setListPage((p) => p - 1)} disabled={listMeta.current_page <= 1}>
                    Précédent
                  </Button>
                  <Button variant="secondary" onClick={() => setListPage((p) => p + 1)} disabled={listMeta.current_page >= listMeta.last_page}>
                    Suivant
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {view === 'search' && (
          <div className="space-y-3">
            <PatientAutocomplete onSelect={setSelectedPatient} />
            {selectedPatient && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
                <div className="min-w-48">
                  <p className="text-sm font-medium">{selectedPatient.full_name}</p>
                  {selectedPatient.residence && <p className="text-xs text-neutral-500">{selectedPatient.residence}</p>}
                </div>
                {canEditPatient && (
                  <IconButton icon={Pencil} label="Modifier" onClick={() => setEditingPatientId(selectedPatient.id)} />
                )}
                <IconButton icon={Trash2} label="Supprimer" tone="danger" onClick={() => confirmDelete(selectedPatient)} />
              </div>
            )}
          </div>
        )}

        {view === 'trash' && (
          <div className="space-y-2">
            {isTrashError && <p className="py-4 text-center text-sm text-red-600">Impossible de charger la corbeille.</p>}
            {!isTrashError && trashedPatients?.map((patient) => (
              <div key={patient.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 p-3 opacity-70 dark:border-neutral-800">
                <div className="min-w-48">
                  <p className="text-sm font-medium">{patient.full_name}</p>
                  {patient.residence && <p className="text-xs text-neutral-500">{patient.residence}</p>}
                </div>
                <Badge tone="red">Supprimé</Badge>
                <IconButton
                  icon={RotateCcw}
                  label="Rétablir"
                  tone="primary"
                  onClick={() => restoreMutation.mutate(patient.id)}
                />
              </div>
            ))}
            {!isTrashError && trashedPatients?.length === 0 && (
              <p className="py-4 text-center text-sm text-neutral-500">Corbeille vide.</p>
            )}
            {trashMeta && trashMeta.last_page > 1 && (
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-neutral-500">
                  Page {trashMeta.current_page} sur {trashMeta.last_page} ({trashMeta.total} au total)
                </span>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setTrashPage((p) => p - 1)} disabled={trashMeta.current_page <= 1}>
                    Précédent
                  </Button>
                  <Button variant="secondary" onClick={() => setTrashPage((p) => p + 1)} disabled={trashMeta.current_page >= trashMeta.last_page}>
                    Suivant
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
      {editingPatientId && (
        <PatientEditModal patientId={editingPatientId} onClose={() => setEditingPatientId(null)} />
      )}
    </div>
  )
}
