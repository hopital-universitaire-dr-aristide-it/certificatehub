import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, apiErrorMessage } from '../../lib/api'
import { openPdfInNewTab } from '../../lib/pdf'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { FieldError } from '../../components/ui/Field'
import { DynamicForm, type FormValues } from '../../components/forms/DynamicForm'
import type { Certificate, CertificateType, FormField, Patient } from '../../types'

export function CertificateEditPage() {
  const { id } = useParams<{ id: string }>()
  const certificateId = Number(id)
  const queryClient = useQueryClient()
  const [values, setValues] = useState<FormValues>({})
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)

  const { data: certificate, isLoading: isLoadingCertificate } = useQuery({
    queryKey: ['certificate', certificateId],
    queryFn: async () => {
      const { data } = await api.get<Certificate>(`/certificates/${certificateId}`)
      return data
    },
  })

  const { data: certificateTypes } = useQuery({
    queryKey: ['certificate-types'],
    queryFn: async () => {
      const { data } = await api.get<{ data: CertificateType[] }>('/certificate-types')
      return data.data
    },
  })

  const certificateType = certificateTypes?.find((t) => t.id === certificate?.certificate_type_id)

  const { data: patient } = useQuery({
    queryKey: ['patient', certificate?.patient_id],
    queryFn: async () => {
      const { data } = await api.get<Patient>(`/patients/${certificate!.patient_id}`)
      return data
    },
    enabled: !!certificate,
  })

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

  useEffect(() => {
    if (certificate?.data) {
      setValues(certificate.data)
    }
  }, [certificate?.data])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.put(`/certificates/${certificateId}`, { data: values })
      return data as Certificate
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['certificate', certificateId] }),
    onError: (err) => setError(apiErrorMessage(err)),
  })

  const finalizeMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/certificates/${certificateId}/finalize`)
      return data as Certificate
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['certificate', certificateId] }),
    onError: (err) => setError(apiErrorMessage(err)),
  })

  async function handlePreview() {
    setError(null)
    setIsBusy(true)
    try {
      await openPdfInNewTab(`/certificates/${certificateId}/preview`)
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setIsBusy(false)
    }
  }

  if (isLoadingCertificate || !certificate) {
    return <Card>Chargement...</Card>
  }

  const isFinalized = certificate.status === 'finalized'

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title={certificate.patient_name ?? 'Patient'}
          subtitle={certificateType?.form_label ?? undefined}
          action={
            <Badge tone={isFinalized ? 'blue' : 'neutral'}>{isFinalized ? 'Finalise' : 'Brouillon'}</Badge>
          }
        />
        {patient && (
          <dl className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <dt className="text-neutral-500">Age</dt>
              <dd>{patient.age ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Sexe</dt>
              <dd>{patient.sex ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Residence</dt>
              <dd>{patient.residence ?? '—'}</dd>
            </div>
          </dl>
        )}
      </Card>

      <Card>
        <CardHeader title="Formulaire" />
        {fields ? (
          <DynamicForm fields={fields} values={values} onChange={(key, value) => setValues((prev) => ({ ...prev, [key]: value }))} disabled={isFinalized} />
        ) : (
          <p className="text-sm text-neutral-500">Chargement du formulaire...</p>
        )}

        <FieldError message={error ?? undefined} />

        <div className="mt-6 flex flex-wrap gap-2">
          {!isFinalized && (
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          )}
          <Button variant="secondary" onClick={handlePreview} disabled={isBusy}>
            Apercu
          </Button>
          {!isFinalized && (
            <Button variant="secondary" onClick={() => finalizeMutation.mutate()} disabled={finalizeMutation.isPending}>
              {finalizeMutation.isPending ? 'Finalisation...' : 'Finaliser'}
            </Button>
          )}
        </div>
        {isFinalized && (
          <p className="mt-3 text-sm text-neutral-500">
            Certificat finalise — pret a etre imprime a l'accueil.
          </p>
        )}
      </Card>
    </div>
  )
}
