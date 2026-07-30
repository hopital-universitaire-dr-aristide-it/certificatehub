import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, apiErrorMessage } from '../../lib/api'
import { Button } from '../ui/Button'
import { Input, Label, Select, FieldError } from '../ui/Field'
import { DynamicForm, type FormValues } from '../forms/DynamicForm'
import type { Certificate, CertificateType, FormField, Patient, User } from '../../types'

interface AdminCertificateEditModalProps {
  certificate: Certificate
  onClose: () => void
}

export function AdminCertificateEditModal({ certificate, onClose }: AdminCertificateEditModalProps) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [sex, setSex] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [residence, setResidence] = useState('')
  const [certificateTypeId, setCertificateTypeId] = useState(certificate.certificate_type_id)
  const [doctorId, setDoctorId] = useState<number | ''>(certificate.doctor_id ?? '')
  const [formValues, setFormValues] = useState<FormValues>(certificate.form_data ?? {})

  const { data: patient } = useQuery({
    queryKey: ['patient', certificate.patient_id],
    queryFn: async () => {
      const { data } = await api.get<{ data: Patient }>(`/patients/${certificate.patient_id}`)
      return data.data
    },
  })

  useEffect(() => {
    if (!patient) return
    setFirstName(patient.first_name)
    setLastName(patient.last_name)
    setSex(patient.sex ?? '')
    setDateOfBirth(patient.date_of_birth ?? '')
    setResidence(patient.residence ?? '')
  }, [patient])

  const { data: certificateTypes } = useQuery({
    queryKey: ['certificate-types'],
    queryFn: async () => {
      const { data } = await api.get<{ data: CertificateType[] }>('/certificate-types')
      return data.data
    },
  })

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await api.get<{ data: User[] }>('/users')
      return data.data
    },
  })
  const doctors = users?.filter((u) => u.roles.includes('doctor')) ?? []

  const certificateType = certificateTypes?.find((t) => t.id === certificateTypeId)

  const { data: fields } = useQuery({
    queryKey: ['form-fields', certificateType?.form_definition_id],
    queryFn: async () => {
      const { data } = await api.get<{ data: FormField[] }>(
        `/form-definitions/${certificateType!.form_definition_id}/fields`,
      )
      return data.data
    },
    enabled: !!certificateType,
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.put<{ data: Certificate }>(`/certificates/${certificate.id}/manage`, {
        patient: {
          first_name: firstName,
          last_name: lastName,
          sex: sex || null,
          date_of_birth: dateOfBirth || null,
          residence: residence || null,
        },
        certificate_type_id: Number(certificateTypeId),
        doctor_id: doctorId === '' ? null : Number(doctorId),
        data: formValues,
      })
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificates-oversight'] })
      onClose()
    },
    onError: (err) => setError(apiErrorMessage(err)),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <p className="text-sm font-medium">Modifier le certificat</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto px-4 py-4">
          <div>
            <p className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">Patient</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="admin-cert-first-name">Prénom</Label>
                <Input id="admin-cert-first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="admin-cert-last-name">Nom</Label>
                <Input id="admin-cert-last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="admin-cert-sex">Sexe</Label>
                <Select id="admin-cert-sex" value={sex} onChange={(e) => setSex(e.target.value)}>
                  <option value="">Non précisé</option>
                  <option value="M">Masculin</option>
                  <option value="F">Féminin</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="admin-cert-dob">Date de naissance</Label>
                <Input id="admin-cert-dob" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
              </div>
              <div className="col-span-2">
                <Label htmlFor="admin-cert-residence">Résidence</Label>
                <Input id="admin-cert-residence" value={residence} onChange={(e) => setResidence(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="admin-cert-type">Type de certificat</Label>
              <Select
                id="admin-cert-type"
                value={certificateTypeId}
                onChange={(e) => setCertificateTypeId(Number(e.target.value))}
              >
                {certificateTypes?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.form_label ?? `Type #${t.id}`}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="admin-cert-doctor">Médecin assigné</Label>
              <Select
                id="admin-cert-doctor"
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value === '' ? '' : Number(e.target.value))}
              >
                <option value="">Aucun (en attente de prise en charge)</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">Formulaire médical</p>
            {fields ? (
              <DynamicForm
                fields={fields}
                values={formValues}
                onChange={(key, value) => setFormValues((prev) => ({ ...prev, [key]: value }))}
              />
            ) : (
              <p className="text-sm text-neutral-500">Chargement du formulaire...</p>
            )}
          </div>

          <FieldError message={error ?? undefined} />
        </div>

        <div className="flex justify-end gap-2 border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </div>
      </div>
    </div>
  )
}
