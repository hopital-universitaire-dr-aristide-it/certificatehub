import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, apiErrorMessage } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Input, Label, Select, Textarea, FieldError } from '../../components/ui/Field'
import type {
  ImportCertificateRow,
  ImportConfirmResult,
  ImportDoctorRow,
  ImportParseResult,
  ImportPatientRow,
  ImportUpload,
  User,
} from '../../types'

const fileInputClasses =
  'w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:file:bg-neutral-800 dark:hover:file:bg-neutral-700'

export function ImportPage() {
  const queryClient = useQueryClient()
  const { hasPermission } = useAuth()
  const canUpload = hasPermission('import.manage')

  const [file, setFile] = useState<File | null>(null)
  const [tag, setTag] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<ImportConfirmResult | null>(null)
  const [justUploaded, setJustUploaded] = useState<ImportUpload | null>(null)

  const [activeUpload, setActiveUpload] = useState<ImportUpload | null>(null)
  const [patients, setPatients] = useState<ImportPatientRow[]>([])
  const [doctors, setDoctors] = useState<ImportDoctorRow[]>([])
  const [certificates, setCertificates] = useState<ImportCertificateRow[]>([])
  const [skipped, setSkipped] = useState<ImportParseResult['skipped']>([])

  const { data: pendingUploads } = useQuery({
    queryKey: ['import-uploads'],
    queryFn: async () => {
      const { data } = await api.get<{ data: ImportUpload[] }>('/import/uploads')
      return data.data
    },
  })

  const { data: doctorUsers } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await api.get<{ data: User[] }>('/users')
      return data.data
    },
  })
  const existingDoctors = (doctorUsers ?? []).filter((u) => u.roles.includes('doctor'))

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Aucun fichier sélectionné.')
      const formData = new FormData()
      formData.append('file', file)
      formData.append('tag', tag)
      const { data } = await api.post<ImportUpload>('/import/uploads', formData)
      return data
    },
    onSuccess: (data) => {
      setError(null)
      setJustUploaded(data)
      setFile(null)
      setTag('')
      queryClient.invalidateQueries({ queryKey: ['import-uploads'] })
    },
    onError: (err) => setError(apiErrorMessage(err)),
  })

  const parseMutation = useMutation({
    mutationFn: async (upload: ImportUpload) => {
      const { data } = await api.get<ImportParseResult>(`/import/uploads/${upload.id}/parse`)
      return { upload, result: data }
    },
    onSuccess: ({ upload, result }) => {
      setError(null)
      setSummary(null)
      setJustUploaded(null)
      setActiveUpload(upload)
      setPatients(result.patients)
      setDoctors(result.doctors)
      setCertificates(result.certificates)
      setSkipped(result.skipped)
    },
    onError: (err) => setError(apiErrorMessage(err)),
  })

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!activeUpload) throw new Error('Aucun import en cours.')
      const { data } = await api.post<ImportConfirmResult>(`/import/uploads/${activeUpload.id}/confirm`, {
        tag: activeUpload.tag,
        doctors: doctors.map((d) => ({
          row_id: d.row_id,
          name: d.name,
          action: d.action,
          matched_user_id: d.matched_user_id,
        })),
        patients: patients.map((p) => ({
          row_id: p.row_id,
          first_name: p.first_name,
          last_name: p.last_name,
          sex: p.sex,
          date_of_birth: p.date_of_birth,
          age: p.age,
          residence: p.residence,
        })),
        certificates: certificates.map((c) => ({
          row_id: c.row_id,
          patient_row_id: c.patient_row_id,
          doctor_row_id: c.doctor_row_id,
          exam_date: c.exam_date,
          form_data: c.form_data,
        })),
      })
      return data
    },
    onSuccess: (data) => {
      setError(null)
      setSummary(data)
      closePreview()
      queryClient.invalidateQueries({ queryKey: ['visits'] })
      queryClient.invalidateQueries({ queryKey: ['reception-certificates'] })
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['import-batches'] })
      queryClient.invalidateQueries({ queryKey: ['import-uploads'] })
    },
    onError: (err) => setError(apiErrorMessage(err)),
  })

  function closePreview() {
    setActiveUpload(null)
    setPatients([])
    setDoctors([])
    setCertificates([])
    setSkipped([])
  }

  function updatePatient(rowId: string, changes: Partial<ImportPatientRow>) {
    setPatients((prev) => prev.map((p) => (p.row_id === rowId ? { ...p, ...changes } : p)))
  }

  function updateDoctor(rowId: string, changes: Partial<ImportDoctorRow>) {
    setDoctors((prev) => prev.map((d) => (d.row_id === rowId ? { ...d, ...changes } : d)))
  }

  function updateCertificate(rowId: string, changes: Partial<ImportCertificateRow>) {
    setCertificates((prev) => prev.map((c) => (c.row_id === rowId ? { ...c, ...changes } : c)))
  }

  const hasPreview = activeUpload !== null
  const canConfirm = hasPreview && doctors.every((d) => d.action === 'create' || d.matched_user_id !== null)

  return (
    <div className="space-y-6">
      {canUpload && (
        <Card>
          <CardHeader
            title="Déposer un nouveau JSON"
            subtitle="Enregistre le fichier pour traitement — vous pouvez continuer tout de suite ou laisser quelqu'un d'autre reprendre plus tard."
          />
          <FieldError message={error ?? undefined} />

          {justUploaded && (
            <div className="mb-4 flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
              <span>
                Import « {justUploaded.tag} » déposé. Vous pouvez le reprendre maintenant, ou le laisser dans la liste
                ci-dessous pour plus tard.
              </span>
              <Button
                variant="secondary"
                disabled={parseMutation.isPending}
                onClick={() => parseMutation.mutate(justUploaded)}
              >
                Continuer maintenant
              </Button>
            </div>
          )}

          {summary && (
            <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
              Import terminé pour l'étiquette « {summary.batch.tag} » : {summary.patients_created} patient(s)
              créé(s), {summary.doctors_created} médecin(s) créé(s), {summary.certificates_created} certificat(s)
              créé(s).
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Label htmlFor="import-tag">Étiquette (tag)</Label>
              <Input
                id="import-tag"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="Ex: Lot Août 2026"
              />
            </div>
            <div className="flex items-end">
              <Button
                className="w-full"
                disabled={!file || !tag || uploadMutation.isPending}
                onClick={() => uploadMutation.mutate()}
              >
                {uploadMutation.isPending ? 'Envoi...' : 'Uploader'}
              </Button>
            </div>
            <div className="sm:col-span-3">
              <Label htmlFor="import-file">Fichier JSON</Label>
              <input
                id="import-file"
                type="file"
                accept="application/json,.json"
                className={fileInputClasses}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
        </Card>
      )}

      {!canUpload && <FieldError message={error ?? undefined} />}
      {!canUpload && summary && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
          Import terminé pour l'étiquette « {summary.batch.tag} » : {summary.patients_created} patient(s) créé(s),{' '}
          {summary.doctors_created} médecin(s) créé(s), {summary.certificates_created} certificat(s) créé(s).
        </div>
      )}

      <Card>
        <CardHeader
          title="Imports en attente"
          subtitle={`${pendingUploads?.length ?? 0} import(s) déposé(s) restant à reprendre`}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
                <th className="py-2 pr-4">Étiquette</th>
                <th className="py-2 pr-4">Fichier</th>
                <th className="py-2 pr-4">Déposé par</th>
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {pendingUploads?.map((u) => (
                <tr key={u.id} className="border-b border-neutral-100 dark:border-neutral-900">
                  <td className="py-2 pr-4">{u.tag}</td>
                  <td className="py-2 pr-4 text-neutral-500">{u.original_filename ?? '—'}</td>
                  <td className="py-2 pr-4">{u.uploaded_by_name ?? '—'}</td>
                  <td className="py-2 pr-4">{new Date(u.created_at).toLocaleDateString('fr-FR')}</td>
                  <td className="py-2 pr-4 text-right">
                    <Button
                      variant="secondary"
                      disabled={parseMutation.isPending}
                      onClick={() => parseMutation.mutate(u)}
                    >
                      Continuer
                    </Button>
                  </td>
                </tr>
              ))}
              {pendingUploads?.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-neutral-500">
                    Aucun import en attente.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {hasPreview && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-neutral-500">
              Reprise de l'import « {activeUpload.tag} » — déposé par {activeUpload.uploaded_by_name ?? '—'}
            </p>
            <Button variant="ghost" onClick={closePreview}>
              Annuler / retour à la liste
            </Button>
          </div>

          {skipped.length > 0 && (
            <Card>
              <CardHeader title="Lignes ignorées" subtitle={`${skipped.length} entrée(s) sans données exploitables`} />
              <ul className="max-h-48 space-y-1 overflow-y-auto text-sm text-neutral-600 dark:text-neutral-400">
                {skipped.map((s, i) => (
                  <li key={i}>
                    <span className="font-medium">{s.source_file}</span> — {s.reason}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {doctors.length > 0 && (
            <Card>
              <CardHeader title="Médecins" subtitle={`${doctors.length} médecin(s) détecté(s)`} />
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
                      <th className="py-2 pr-4">Nom (JSON)</th>
                      <th className="py-2 pr-4">Action</th>
                      <th className="py-2 pr-4">Compte</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doctors.map((d) => (
                      <tr key={d.row_id} className="border-b border-neutral-100 dark:border-neutral-900">
                        <td className="py-2 pr-4">
                          <Input value={d.name} onChange={(e) => updateDoctor(d.row_id, { name: e.target.value })} />
                        </td>
                        <td className="py-2 pr-4">
                          <Select
                            value={d.action}
                            onChange={(e) =>
                              updateDoctor(d.row_id, {
                                action: e.target.value as 'existing' | 'create',
                                matched_user_id: e.target.value === 'create' ? null : d.matched_user_id,
                              })
                            }
                          >
                            <option value="create">Créer un nouveau compte</option>
                            <option value="existing">Compte existant</option>
                          </Select>
                        </td>
                        <td className="py-2 pr-4">
                          {d.action === 'existing' ? (
                            <Select
                              value={d.matched_user_id ?? ''}
                              onChange={(e) =>
                                updateDoctor(d.row_id, { matched_user_id: e.target.value ? Number(e.target.value) : null })
                              }
                            >
                              <option value="">— Choisir —</option>
                              {existingDoctors.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name}
                                </option>
                              ))}
                            </Select>
                          ) : (
                            <Badge tone="blue">
                              {d.name.toLowerCase().replace(/[^a-z]/g, '') || 'medecin'}@gmail.com
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {patients.length > 0 && (
            <Card>
              <CardHeader title="Patients" subtitle={`${patients.length} patient(s) détecté(s)`} />
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
                      <th className="py-2 pr-4">Prénom</th>
                      <th className="py-2 pr-4">Nom</th>
                      <th className="py-2 pr-4">Sexe</th>
                      <th className="py-2 pr-4">Naissance</th>
                      <th className="py-2 pr-4">Âge</th>
                      <th className="py-2 pr-4">Résidence</th>
                      <th className="py-2 pr-4">Doublon</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patients.map((p) => (
                      <tr key={p.row_id} className="border-b border-neutral-100 dark:border-neutral-900">
                        <td className="py-2 pr-4">
                          <Input
                            className="w-32"
                            value={p.first_name}
                            onChange={(e) => updatePatient(p.row_id, { first_name: e.target.value })}
                          />
                        </td>
                        <td className="py-2 pr-4">
                          <Input
                            className="w-32"
                            value={p.last_name}
                            onChange={(e) => updatePatient(p.row_id, { last_name: e.target.value })}
                          />
                        </td>
                        <td className="py-2 pr-4">
                          <Select
                            className="w-20"
                            value={p.sex ?? ''}
                            onChange={(e) => updatePatient(p.row_id, { sex: (e.target.value || null) as 'M' | 'F' | null })}
                          >
                            <option value="">—</option>
                            <option value="M">M</option>
                            <option value="F">F</option>
                          </Select>
                        </td>
                        <td className="py-2 pr-4">
                          <Input
                            type="date"
                            className="w-36"
                            value={p.date_of_birth ?? ''}
                            onChange={(e) => updatePatient(p.row_id, { date_of_birth: e.target.value || null })}
                          />
                        </td>
                        <td className="py-2 pr-4">
                          <Input
                            type="number"
                            className="w-16"
                            value={p.age ?? ''}
                            onChange={(e) => updatePatient(p.row_id, { age: e.target.value ? Number(e.target.value) : null })}
                          />
                        </td>
                        <td className="py-2 pr-4">
                          <Input
                            className="w-36"
                            value={p.residence ?? ''}
                            onChange={(e) => updatePatient(p.row_id, { residence: e.target.value })}
                          />
                        </td>
                        <td className="py-2 pr-4">
                          {p.exact_duplicate_patient_id && <Badge tone="green">Dossier existant réutilisé</Badge>}
                          {!p.exact_duplicate_patient_id && p.potential_duplicates.length > 0 && (
                            <Badge tone="amber">{p.potential_duplicates.length} ressemblance(s)</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {certificates.length > 0 && (
            <Card>
              <CardHeader title="Certificats" subtitle={`${certificates.length} certificat(s) détecté(s)`} />
              <div className="max-h-[32rem] overflow-y-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
                      <th className="py-2 pr-4">Source</th>
                      <th className="py-2 pr-4">Patient</th>
                      <th className="py-2 pr-4">Médecin</th>
                      <th className="py-2 pr-4">Date d'examen</th>
                      <th className="py-2 pr-4">Résultat</th>
                      <th className="py-2 pr-4">Signes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {certificates.map((c) => {
                      const patient = patients.find((p) => p.row_id === c.patient_row_id)
                      const presenteSignes = c.form_data.outcome === 'presente_signes'
                      return (
                        <tr key={c.row_id} className="border-b border-neutral-100 dark:border-neutral-900 align-top">
                          <td className="py-2 pr-4 text-xs text-neutral-500">{c.source_file}</td>
                          <td className="py-2 pr-4">{patient ? `${patient.first_name} ${patient.last_name}` : '—'}</td>
                          <td className="py-2 pr-4">
                            <Select
                              className="w-40"
                              value={c.doctor_row_id ?? ''}
                              onChange={(e) => updateCertificate(c.row_id, { doctor_row_id: e.target.value || null })}
                            >
                              <option value="">— Aucun —</option>
                              {doctors.map((d) => (
                                <option key={d.row_id} value={d.row_id}>
                                  {d.name}
                                </option>
                              ))}
                            </Select>
                          </td>
                          <td className="py-2 pr-4">
                            <Input
                              type="date"
                              className="w-36"
                              value={c.exam_date ?? ''}
                              onChange={(e) => updateCertificate(c.row_id, { exam_date: e.target.value || null })}
                            />
                          </td>
                          <td className="py-2 pr-4">
                            <Select
                              className="w-40"
                              value={c.form_data.outcome}
                              onChange={(e) =>
                                updateCertificate(c.row_id, { form_data: { ...c.form_data, outcome: e.target.value } })
                              }
                            >
                              <option value="sain">Sain</option>
                              <option value="presente_signes">Présente des signes</option>
                            </Select>
                          </td>
                          <td className="py-2 pr-4">
                            {presenteSignes ? (
                              <div className="space-y-1">
                                <label className="flex items-center gap-2 text-xs">
                                  <input
                                    type="checkbox"
                                    checked={!!c.form_data.sign_contagieux}
                                    onChange={(e) =>
                                      updateCertificate(c.row_id, {
                                        form_data: { ...c.form_data, sign_contagieux: e.target.checked },
                                      })
                                    }
                                  />
                                  Contagieux
                                </label>
                                <label className="flex items-center gap-2 text-xs">
                                  <input
                                    type="checkbox"
                                    checked={!!c.form_data.sign_chronique}
                                    onChange={(e) =>
                                      updateCertificate(c.row_id, {
                                        form_data: { ...c.form_data, sign_chronique: e.target.checked },
                                      })
                                    }
                                  />
                                  Chronique
                                </label>
                                <label className="flex items-center gap-2 text-xs">
                                  <input
                                    type="checkbox"
                                    checked={!!c.form_data.sign_debilitant}
                                    onChange={(e) =>
                                      updateCertificate(c.row_id, {
                                        form_data: { ...c.form_data, sign_debilitant: e.target.checked },
                                      })
                                    }
                                  />
                                  Débilitant
                                </label>
                                <label className="flex items-center gap-2 text-xs">
                                  <input
                                    type="checkbox"
                                    checked={!!c.form_data.sign_trouble_mental}
                                    onChange={(e) =>
                                      updateCertificate(c.row_id, {
                                        form_data: { ...c.form_data, sign_trouble_mental: e.target.checked },
                                      })
                                    }
                                  />
                                  Trouble mental
                                </label>
                                <Textarea
                                  className="w-48"
                                  rows={2}
                                  placeholder="Recommandation"
                                  value={c.form_data.recommandation ?? ''}
                                  onChange={(e) =>
                                    updateCertificate(c.row_id, {
                                      form_data: { ...c.form_data, recommandation: e.target.value },
                                    })
                                  }
                                />
                              </div>
                            ) : (
                              <span className="text-neutral-400">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <div className="flex justify-end">
            <Button disabled={!canConfirm || confirmMutation.isPending} onClick={() => confirmMutation.mutate()}>
              {confirmMutation.isPending ? 'Validation...' : "Valider l'import"}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
