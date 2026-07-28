import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api, apiErrorMessage } from '../../lib/api'
import { Input, Label, Select, FieldError } from '../ui/Field'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import type { Patient, PatientSummary } from '../../types'

interface NewPatientFormProps {
  onCreated: (patient: Patient) => void
}

export function NewPatientForm({ onCreated }: NewPatientFormProps) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [sex, setSex] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [residence, setResidence] = useState('')
  const [duplicates, setDuplicates] = useState<PatientSummary[]>([])
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/patients', {
        first_name: firstName,
        last_name: lastName,
        sex: sex || null,
        date_of_birth: dateOfBirth || null,
        residence: residence || null,
      })
      return data as { patient: Patient; potential_duplicates: PatientSummary[] }
    },
    onSuccess: (data) => {
      setDuplicates(data.potential_duplicates)
      onCreated(data.patient)
    },
    onError: (err) => setError(apiErrorMessage(err)),
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    mutation.mutate()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="first_name">Prénom</Label>
          <Input id="first_name" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="last_name">Nom</Label>
          <Input id="last_name" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="sex">Sexe</Label>
          <Select id="sex" value={sex} onChange={(e) => setSex(e.target.value)}>
            <option value="">Non précisé</option>
            <option value="M">Masculin</option>
            <option value="F">Féminin</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="date_of_birth">Date de naissance</Label>
          <Input id="date_of_birth" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
        </div>
        <div className="col-span-2">
          <Label htmlFor="residence">Résidence</Label>
          <Input id="residence" value={residence} onChange={(e) => setResidence(e.target.value)} />
        </div>
      </div>
      <FieldError message={error ?? undefined} />
      {duplicates.length > 0 && (
        <div className="rounded-xl bg-amber-50 p-3 text-sm dark:bg-amber-900/20">
          <p className="mb-1 font-medium text-amber-800 dark:text-amber-300">
            Doublons potentiels détectés :
          </p>
          <ul className="space-y-1">
            {duplicates.map((d) => (
              <li key={d.id}>
                <Badge tone="amber">{d.full_name}</Badge>{' '}
                <span className="text-neutral-500">{d.date_of_birth}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? 'Enregistrement...' : 'Créer le patient'}
      </Button>
    </form>
  )
}
