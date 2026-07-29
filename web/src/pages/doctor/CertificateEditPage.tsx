import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, apiErrorMessage } from '../../lib/api'
import { usePdfPreview } from '../../lib/usePdfPreview'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { FieldError } from '../../components/ui/Field'
import { PdfModal } from '../../components/ui/PdfModal'
import { DynamicForm, type FormValues } from '../../components/forms/DynamicForm'
import type { Certificate, CertificateType, FormField, Patient } from '../../types'

export function CertificateEditPage() {
  const { id } = useParams<{ id: string }>()
  const certificateId = Number(id)
  const queryClient = useQueryClient()
  const [values, setValues] = useState<FormValues>({})
  const [isDirty, setIsDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const pdfPreview = usePdfPreview()

  const {
    data: certificate,
    isLoading: isLoadingCertificate,
    isError: isCertificateError,
    error: certificateError,
  } = useQuery({
    queryKey: ['certificate', certificateId],
    queryFn: async () => {
      const { data } = await api.get<{ data: Certificate }>(`/certificates/${certificateId}`)
      return data.data
    },
  })

  const { data: certificateTypes, isError: isCertificateTypesError, error: certificateTypesError } = useQuery({
    queryKey: ['certificate-types'],
    queryFn: async () => {
      const { data } = await api.get<{ data: CertificateType[] }>('/certificate-types')
      return data.data
    },
  })

  const certificateType = certificateTypes?.find((t) => t.id === certificate?.certificate_type_id)

  const { data: patient, isError: isPatientError, error: patientError } = useQuery({
    queryKey: ['patient', certificate?.patient_id],
    queryFn: async () => {
      const { data } = await api.get<{ data: Patient }>(`/patients/${certificate!.patient_id}`)
      return data.data
    },
    enabled: !!certificate?.patient_id,
  })

  const { data: fields, isError: isFieldsError, error: fieldsError } = useQuery({
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
    if (certificate?.form_data) {
      setValues(certificate.form_data)
      setIsDirty(false)
    }
  }, [certificate?.form_data])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.put<{ data: Certificate }>(`/certificates/${certificateId}`, { data: values })
      return data.data
    },
    onSuccess: () => {
      setIsDirty(false)
      queryClient.invalidateQueries({ queryKey: ['certificate', certificateId] })
    },
    onError: (err) => setError(apiErrorMessage(err)),
  })

  const finalizeMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ data: Certificate }>(`/certificates/${certificateId}/finalize`)
      return data.data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['certificate', certificateId] }),
    onError: (err) => setError(apiErrorMessage(err)),
  })

  function handleFieldChange(key: string, value: unknown) {
    setValues((prev) => ({ ...prev, [key]: value }))
    setIsDirty(true)
  }

  async function handlePreview() {
    setError(null)
    setIsBusy(true)
    try {
      await pdfPreview.open(`/certificates/${certificateId}/preview`)
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setIsBusy(false)
    }
  }

  const loadError = [certificateError, certificateTypesError, patientError, fieldsError]
    .filter(Boolean)
    .map((err) => apiErrorMessage(err))
    .at(0)

  if (isLoadingCertificate) {
    return <Card>Chargement...</Card>
  }

  if (isCertificateError || !certificate) {
    return <Card>{loadError ?? 'Impossible de charger ce certificat.'}</Card>
  }

  const isFinalized = certificate.status === 'finalized'
  const hasSavedData = !!(certificate.form_data && Object.keys(certificate.form_data).length > 0)
  const canPreview = hasSavedData && !isBusy

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title={certificate.patient_name ?? 'Patient'}
          subtitle={certificateType?.form_label ?? undefined}
          action={
            <Badge tone={isFinalized ? 'blue' : 'neutral'}>{isFinalized ? 'Finalisé' : 'Brouillon'}</Badge>
          }
        />
        {isPatientError && <FieldError message="Impossible de charger les informations du patient." />}
        {patient && (
          <dl className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <dt className="text-neutral-500">Âge</dt>
              <dd>{patient.age ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Sexe</dt>
              <dd>{patient.sex ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Résidence</dt>
              <dd>{patient.residence ?? '—'}</dd>
            </div>
          </dl>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Formulaire"
          action={
            !isFinalized && !isDirty && hasSavedData ? <Badge tone="green">Enregistré</Badge> : undefined
          }
        />
        {isCertificateTypesError && <FieldError message="Impossible de charger les types de certificats." />}
        {isFieldsError && <FieldError message="Impossible de charger le formulaire." />}
        {fields ? (
          <DynamicForm fields={fields} values={values} onChange={handleFieldChange} disabled={isFinalized} />
        ) : (
          !isCertificateTypesError && !isFieldsError && <p className="text-sm text-neutral-500">Chargement du formulaire...</p>
        )}

        <FieldError message={error ?? undefined} />

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {!isFinalized && (
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          )}
          <Button variant="secondary" onClick={handlePreview} disabled={!canPreview} title={!hasSavedData ? "Enregistrez d'abord le formulaire" : undefined}>
            Aperçu
          </Button>
          {!isFinalized && (
            <Button variant="secondary" onClick={() => finalizeMutation.mutate()} disabled={finalizeMutation.isPending}>
              {finalizeMutation.isPending ? 'Finalisation...' : 'Finaliser'}
            </Button>
          )}
          {!isFinalized && !hasSavedData && (
            <span className="text-sm text-neutral-500">Aperçu non disponible avant le premier enregistrement.</span>
          )}
        </div>
        {isFinalized && (
          <p className="mt-3 text-sm text-neutral-500">
            Certificat finalisé — prêt à être imprimé à l'accueil.
          </p>
        )}
      </Card>
      {pdfPreview.url && <PdfModal url={pdfPreview.url} onClose={pdfPreview.close} />}
    </div>
  )
}
