import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, registerUnauthorizedHandler, TOKEN_STORAGE_KEY } from './api'
import type { AuthenticatedUser } from '../types'

const USER_STORAGE_KEY = 'certhub_user'

interface AuthContextValue {
  user: AuthenticatedUser | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  hasRole: (...roles: string[]) => boolean
  hasPermission: (...permissions: string[]) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readStoredUser(): AuthenticatedUser | null {
  const raw = localStorage.getItem(USER_STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthenticatedUser
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(() => readStoredUser())
  const [isLoading, setIsLoading] = useState(false)

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    localStorage.removeItem(USER_STORAGE_KEY)
    setUser(null)
  }, [])

  useEffect(() => {
    registerUnauthorizedHandler(clearSession)
  }, [clearSession])

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const { data } = await api.post('/auth/login', { email, password, device_name: 'web' })
      localStorage.setItem(TOKEN_STORAGE_KEY, data.token)
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user))
      setUser(data.user)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    api.post('/auth/logout').catch(() => undefined)
    clearSession()
  }, [clearSession])

  const hasRole = useCallback((...roles: string[]) => !!user && roles.some((r) => user.roles.includes(r as never)), [user])

  const hasPermission = useCallback(
    (...permissions: string[]) => !!user && permissions.some((p) => user.permissions.includes(p)),
    [user],
  )

  const value = useMemo(
    () => ({ user, isLoading, login, logout, hasRole, hasPermission }),
    [user, isLoading, login, logout, hasRole, hasPermission],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth doit etre utilise a l\'interieur de AuthProvider')
  }
  return ctx
}
