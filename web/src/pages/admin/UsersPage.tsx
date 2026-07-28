import { useState } from 'react'
import { Power, Trash2, RotateCcw } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, apiErrorMessage } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { IconButton } from '../../components/ui/IconButton'
import { Badge } from '../../components/ui/Badge'
import { Input, Label, Select, FieldError } from '../../components/ui/Field'
import type { Role, User } from '../../types'

const ROLES: Role[] = ['reception', 'doctor', 'it', 'admin', 'superadmin']

export function UsersPage() {
  const queryClient = useQueryClient()
  const { hasRole } = useAuth()
  const isSuperadmin = hasRole('superadmin')
  const [error, setError] = useState<string | null>(null)
  const [showTrashed, setShowTrashed] = useState(false)

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await api.get<{ data: User[] }>('/users')
      return data.data
    },
  })

  const { data: trashedUsers } = useQuery({
    queryKey: ['users-trashed'],
    queryFn: async () => {
      const { data } = await api.get<{ data: User[] }>('/users/trashed')
      return data.data
    },
    enabled: isSuperadmin && showTrashed,
  })

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['users'] })
    queryClient.invalidateQueries({ queryKey: ['users-trashed'] })
  }

  const deleteMutation = useMutation({
    mutationFn: async (userId: number) => {
      await api.delete(`/users/${userId}`)
    },
    onSuccess: invalidate,
    onError: (err) => setError(apiErrorMessage(err)),
  })

  const restoreMutation = useMutation({
    mutationFn: async (userId: number) => {
      await api.post(`/users/${userId}/restore`)
    },
    onSuccess: invalidate,
    onError: (err) => setError(apiErrorMessage(err)),
  })

  const createMutation = useMutation({
    mutationFn: async (payload: { name: string; email: string; password: string; role: string }) => {
      await api.post('/users', payload)
    },
    onSuccess: invalidate,
    onError: (err) => setError(apiErrorMessage(err)),
  })

  const assignRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: number; role: string }) => {
      await api.post(`/users/${userId}/role`, { role })
    },
    onSuccess: invalidate,
    onError: (err) => setError(apiErrorMessage(err)),
  })

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: number; isActive: boolean }) => {
      await api.post(`/users/${userId}/${isActive ? 'reactivate' : 'deactivate'}`)
    },
    onSuccess: invalidate,
    onError: (err) => setError(apiErrorMessage(err)),
  })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Utilisateurs"
          action={
            isSuperadmin && (
              <Button variant="secondary" onClick={() => setShowTrashed((v) => !v)}>
                {showTrashed ? 'Voir les actifs' : 'Voir la corbeille'}
              </Button>
            )
          }
        />
        <FieldError message={error ?? undefined} />
        <div className="space-y-2">
          {!showTrashed &&
            users?.map((user) => (
              <div key={user.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
                <div className="min-w-48">
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs text-neutral-500">{user.email}</p>
                </div>
                <Badge tone={user.is_active ? 'green' : 'red'}>{user.is_active ? 'Actif' : 'Désactivé'}</Badge>
                <Select
                  value={user.roles[0] ?? ''}
                  onChange={(e) => assignRoleMutation.mutate({ userId: user.id, role: e.target.value })}
                  className="w-40"
                >
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </Select>
                <IconButton
                  icon={Power}
                  label={user.is_active ? 'Désactiver' : 'Réactiver'}
                  tone={user.is_active ? 'danger' : 'primary'}
                  onClick={() => toggleActiveMutation.mutate({ userId: user.id, isActive: !user.is_active })}
                />
                {isSuperadmin && (
                  <IconButton
                    icon={Trash2}
                    label="Supprimer"
                    tone="danger"
                    onClick={() => {
                      if (window.confirm(`Supprimer le compte de ${user.name} ? Il pourra être rétabli depuis la corbeille.`)) {
                        deleteMutation.mutate(user.id)
                      }
                    }}
                  />
                )}
              </div>
            ))}

          {showTrashed &&
            trashedUsers?.map((user) => (
              <div key={user.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 p-3 opacity-70 dark:border-neutral-800">
                <div className="min-w-48">
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs text-neutral-500">{user.email}</p>
                </div>
                <Badge tone="red">Supprimé</Badge>
                <IconButton
                  icon={RotateCcw}
                  label="Rétablir"
                  tone="primary"
                  onClick={() => restoreMutation.mutate(user.id)}
                />
              </div>
            ))}

          {showTrashed && trashedUsers?.length === 0 && (
            <p className="py-4 text-center text-sm text-neutral-500">Corbeille vide.</p>
          )}
        </div>
      </Card>

      {!showTrashed && (
        <Card>
          <CardHeader title="Nouvel utilisateur" />
          <NewUserForm onSubmit={(payload) => createMutation.mutate(payload)} />
        </Card>
      )}
    </div>
  )
}

function NewUserForm({
  onSubmit,
}: {
  onSubmit: (payload: { name: string; email: string; password: string; role: string }) => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('reception')

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <Label htmlFor="new-user-name">Nom</Label>
        <Input id="new-user-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="new-user-email">E-mail</Label>
        <Input id="new-user-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="new-user-password">Mot de passe</Label>
        <Input id="new-user-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="new-user-role">Rôle</Label>
        <Select id="new-user-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>
      </div>
      <Button disabled={!name || !email || !password} onClick={() => onSubmit({ name, email, password, role })}>
        Créer
      </Button>
    </div>
  )
}
