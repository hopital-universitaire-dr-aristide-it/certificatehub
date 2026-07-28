import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, apiErrorMessage } from '../../lib/api'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input, Label, FieldError } from '../../components/ui/Field'

export function SettingsPage() {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data } = await api.get<{ data: Record<string, string | null> }>('/settings')
      return data.data
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      await api.put(`/settings/${key}`, { value })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
    onError: (err) => setError(apiErrorMessage(err)),
  })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Paramètres" subtitle="Textes et valeurs configurables de l'application" />
        <FieldError message={error ?? undefined} />
        <div className="space-y-3">
          {settings &&
            Object.entries(settings).map(([key, value]) => (
              <SettingRow key={key} settingKey={key} value={value ?? ''} onSave={(v) => updateMutation.mutate({ key, value: v })} />
            ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Ajouter un paramètre" />
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="new-key">Clé</Label>
            <Input id="new-key" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="new-value">Valeur</Label>
            <Input id="new-value" value={newValue} onChange={(e) => setNewValue(e.target.value)} />
          </div>
          <Button
            disabled={!newKey}
            onClick={() => {
              updateMutation.mutate({ key: newKey, value: newValue })
              setNewKey('')
              setNewValue('')
            }}
          >
            Ajouter
          </Button>
        </div>
      </Card>
    </div>
  )
}

function SettingRow({ settingKey, value, onSave }: { settingKey: string; value: string; onSave: (value: string) => void }) {
  const [draft, setDraft] = useState(value)

  return (
    <div className="flex items-end gap-3 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
      <div className="flex-1">
        <Label htmlFor={`setting-${settingKey}`}>{settingKey}</Label>
        <Input id={`setting-${settingKey}`} value={draft} onChange={(e) => setDraft(e.target.value)} />
      </div>
      <Button variant="secondary" disabled={draft === value} onClick={() => onSave(draft)}>
        Enregistrer
      </Button>
    </div>
  )
}
