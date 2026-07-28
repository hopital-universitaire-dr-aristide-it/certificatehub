import { useState } from 'react'
import { Power } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, apiErrorMessage } from '../../lib/api'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { IconButton } from '../../components/ui/IconButton'
import { Badge } from '../../components/ui/Badge'
import { Input, Label, Select, FieldError } from '../../components/ui/Field'
import type { Role, User } from '../../types'

const ROLES: Role[] = ['reception', 'doctor', 'it', 'admin', 'superadmin']

export function UsersPage() {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await api.get<{ data: User[] }>('/users')
      return data.data
    },
  })

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['users'] })
  }

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
        <CardHeader title="Utilisateurs" />
        <FieldError message={error ?? undefined} />
        <div className="space-y-2">
          {users?.map((user) => (
            <div key={user.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
              <div className="min-w-48">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-neutral-500">{user.email}</p>
              </div>
              <Badge tone={user.is_active ? 'green' : 'red'}>{user.is_active ? 'Actif' : 'Desactive'}</Badge>
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
                label={user.is_active ? 'Desactiver' : 'Reactiver'}
                tone={user.is_active ? 'danger' : 'primary'}
                onClick={() => toggleActiveMutation.mutate({ userId: user.id, isActive: !user.is_active })}
              />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Nouvel utilisateur" />
        <NewUserForm onSubmit={(payload) => createMutation.mutate(payload)} />
      </Card>
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
        <Label htmlFor="new-user-role">Role</Label>
        <Select id="new-user-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>
      </div>
      <Button disabled={!name || !email || !password} onClick={() => onSubmit({ name, email, password, role })}>
        Creer
      </Button>
    </div>
  )
}
