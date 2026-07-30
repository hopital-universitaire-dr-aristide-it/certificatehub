import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, apiErrorMessage } from '../../lib/api'
import { Button } from '../ui/Button'
import { FieldError } from '../ui/Field'
import { NewPatientForm, emptyNewPatientValues, type NewPatientValues } from './NewPatientForm'
import type { Patient } from '../../types'

interface PatientEditModalProps {
  patientId: number
  onClose: () => void
}

export function PatientEditModal({ patientId, onClose }: PatientEditModalProps) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [values, setValues] = useState<NewPatientValues>(emptyNewPatientValues)

  const { data: patient } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: async () => {
      const { data } = await api.get<{ data: Patient }>(`/patients/${patientId}`)
      return data.data
    },
  })

  useEffect(() => {
    if (!patient) return
    setValues({
      firstName: patient.first_name,
      lastName: patient.last_name,
      sex: patient.sex ?? '',
      dateOfBirth: patient.date_of_birth ?? '',
      residence: patient.residence ?? '',
    })
  }, [patient])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.put<{ data: Patient }>(`/patients/${patientId}`, {
        first_name: values.firstName,
        last_name: values.lastName,
        sex: values.sex || null,
        date_of_birth: values.dateOfBirth || null,
        residence: values.residence || null,
      })
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      queryClient.invalidateQueries({ queryKey: ['patients-trashed'] })
      onClose()
    },
    onError: (err) => setError(apiErrorMessage(err)),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <p className="text-sm font-medium">Modifier le patient</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-4 py-4">
          <NewPatientForm values={values} onChange={setValues} />
          <FieldError message={error ?? undefined} />
        </div>

        <div className="flex justify-end gap-2 border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !patient}>
            {saveMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </div>
      </div>
    </div>
  )
}
