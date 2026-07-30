import { Input, Label, Select } from '../ui/Field'
import { Badge } from '../ui/Badge'
import type { PatientSummary } from '../../types'

export interface NewPatientValues {
  firstName: string
  lastName: string
  sex: string
  dateOfBirth: string
  residence: string
}

export const emptyNewPatientValues: NewPatientValues = {
  firstName: '',
  lastName: '',
  sex: '',
  dateOfBirth: '',
  residence: '',
}

interface NewPatientFormProps {
  values: NewPatientValues
  onChange: (values: NewPatientValues) => void
  duplicates?: PatientSummary[]
}

export function NewPatientForm({ values, onChange, duplicates = [] }: NewPatientFormProps) {
  function set<K extends keyof NewPatientValues>(key: K, value: NewPatientValues[K]) {
    onChange({ ...values, [key]: value })
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="first_name">Prénom</Label>
          <Input id="first_name" required value={values.firstName} onChange={(e) => set('firstName', e.target.value)} />
        </div>
        <div>
          <Label htmlFor="last_name">Nom</Label>
          <Input id="last_name" required value={values.lastName} onChange={(e) => set('lastName', e.target.value)} />
        </div>
        <div>
          <Label htmlFor="sex">Sexe</Label>
          <Select id="sex" value={values.sex} onChange={(e) => set('sex', e.target.value)}>
            <option value="">Non précisé</option>
            <option value="M">Masculin</option>
            <option value="F">Féminin</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="date_of_birth">Date de naissance</Label>
          <Input id="date_of_birth" type="date" value={values.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />
        </div>
        <div className="col-span-2">
          <Label htmlFor="residence">Résidence</Label>
          <Input id="residence" value={values.residence} onChange={(e) => set('residence', e.target.value)} />
        </div>
      </div>
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
    </div>
  )
}
