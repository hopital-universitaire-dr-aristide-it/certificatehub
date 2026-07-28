import { describe, expect, it } from 'vitest'
import { Route, Routes } from 'react-router-dom'
import { screen } from '@testing-library/react'
import { ProtectedRoute } from './ProtectedRoute'
import { renderWithProviders, seedUser, makeUser } from '../../test/renderWithProviders'

function renderProtected(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<p>login-page</p>} />
      <Route path="/" element={<p>home-page</p>} />
      <Route element={<ProtectedRoute permission="report.view" />}>
        <Route path="/dashboard" element={<p>dashboard-page</p>} />
      </Route>
      <Route element={<ProtectedRoute role="it" />}>
        <Route path="/it" element={<p>it-page</p>} />
      </Route>
    </Routes>,
    { route },
  )
}

describe('ProtectedRoute', () => {
  it('redirects anonymous users to /login', () => {
    renderProtected('/dashboard')
    expect(screen.getByText('login-page')).toBeInTheDocument()
  })

  it('redirects users missing the required permission to /', () => {
    seedUser(makeUser({ permissions: [] }))
    renderProtected('/dashboard')
    expect(screen.queryByText('dashboard-page')).not.toBeInTheDocument()
  })

  it('renders the route when the permission is present', () => {
    seedUser(makeUser({ permissions: ['report.view'] }))
    renderProtected('/dashboard')
    expect(screen.getByText('dashboard-page')).toBeInTheDocument()
  })

  it('renders the route when the required role is present', () => {
    seedUser(makeUser({ roles: ['it'], permissions: [] }))
    renderProtected('/it')
    expect(screen.getByText('it-page')).toBeInTheDocument()
  })

  it('redirects users missing the required role to /', () => {
    seedUser(makeUser({ roles: ['doctor'], permissions: [] }))
    renderProtected('/it')
    expect(screen.queryByText('it-page')).not.toBeInTheDocument()
  })
})
