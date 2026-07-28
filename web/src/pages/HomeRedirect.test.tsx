import { describe, expect, it } from 'vitest'
import { Route, Routes } from 'react-router-dom'
import { screen } from '@testing-library/react'
import { HomeRedirect } from './HomeRedirect'
import { renderWithProviders, seedUser, makeUser } from '../test/renderWithProviders'

function renderAt(permissions: string[], roles: ('reception' | 'doctor' | 'it' | 'admin' | 'superadmin')[] = []) {
  seedUser(makeUser({ permissions, roles }))
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/dashboard" element={<p>dashboard-page</p>} />
      <Route path="/reception" element={<p>reception-page</p>} />
      <Route path="/doctor" element={<p>doctor-page</p>} />
      <Route path="/it/system" element={<p>it-page</p>} />
      <Route path="/login" element={<p>login-page</p>} />
    </Routes>,
    { route: '/' },
  )
}

describe('HomeRedirect', () => {
  it('sends report.view users to the dashboard', () => {
    renderAt(['report.view'])
    expect(screen.getByText('dashboard-page')).toBeInTheDocument()
  })

  it('sends certificate.create users to reception', () => {
    renderAt(['certificate.create'])
    expect(screen.getByText('reception-page')).toBeInTheDocument()
  })

  it('sends certificate.finalize users to the doctor queue', () => {
    renderAt(['certificate.finalize'])
    expect(screen.getByText('doctor-page')).toBeInTheDocument()
  })

  it('sends it-role users to the system page', () => {
    renderAt([], ['it'])
    expect(screen.getByText('it-page')).toBeInTheDocument()
  })

  it('sends everyone else to login', () => {
    renderAt([])
    expect(screen.getByText('login-page')).toBeInTheDocument()
  })
})
