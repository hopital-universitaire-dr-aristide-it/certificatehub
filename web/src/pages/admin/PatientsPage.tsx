import { useState } from 'react'
import { Trash2, RotateCcw } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, apiErrorMessage } from '../../lib/api'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { IconButton } from '../../components/ui/IconButton'
import { Badge } from '../../components/ui/Badge'
import { FieldError } from '../../components/ui/Field'
import { PatientAutocomplete } from '../../components/patients/PatientAutocomplete'
import type { Patient, PatientSummary, PaginatedResponse } from '../../types'

export function PatientsPage() {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [selectedPatient, setSelectedPatient] = useState<PatientSummary | Patient | null>(null)
  const [showTrashed, setShowTrashed] = useState(false)

  const { data: trashedPatients } = useQuery({
    queryKey: ['patients-trashed'],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<Patient>>('/patients/trashed')
      return data.data
    },
    enabled: showTrashed,
  })

  function invalidate() {
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Patients"
          subtitle="Rechercher un dossier patient pour le supprimer (récupérable depuis la corbeille)"
          action={
            <Button variant="secondary" onClick={() => setShowTrashed((v) => !v)}>
              {showTrashed ? 'Voir la recherche' : 'Voir la corbeille'}
            </Button>
          }
        />
        <FieldError message={error ?? undefined} />

        {!showTrashed && (
          <div className="space-y-3">
            <PatientAutocomplete onSelect={setSelectedPatient} />
            {selectedPatient && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
                <div className="min-w-48">
                  <p className="text-sm font-medium">{selectedPatient.full_name}</p>
                  {selectedPatient.residence && <p className="text-xs text-neutral-500">{selectedPatient.residence}</p>}
                </div>
                <IconButton
                  icon={Trash2}
                  label="Supprimer"
                  tone="danger"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Supprimer le dossier de ${selectedPatient.full_name} ? Il pourra être rétabli depuis la corbeille.`,
                      )
                    ) {
                      deleteMutation.mutate(selectedPatient.id)
                    }
                  }}
                />
              </div>
            )}
          </div>
        )}

        {showTrashed && (
          <div className="space-y-2">
            {trashedPatients?.map((patient) => (
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
            {trashedPatients?.length === 0 && (
              <p className="py-4 text-center text-sm text-neutral-500">Corbeille vide.</p>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
