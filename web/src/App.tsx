import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import { LoginPage } from './pages/LoginPage'
import { HomeRedirect } from './pages/HomeRedirect'
import { ReceptionPage } from './pages/reception/ReceptionPage'
import { ReceptionCertificatesPage } from './pages/reception/ReceptionCertificatesPage'
import { ReceptionPrintedCertificatesPage } from './pages/reception/ReceptionPrintedCertificatesPage'
import { DoctorQueuePage } from './pages/doctor/DoctorQueuePage'
import { MyCertificatesPage } from './pages/doctor/MyCertificatesPage'
import { CertificateEditPage } from './pages/doctor/CertificateEditPage'
import { FormHubPage } from './pages/admin/FormHubPage'
import { CertificateTypesPage } from './pages/admin/CertificateTypesPage'
import { UsersPage } from './pages/admin/UsersPage'
import { PatientsPage } from './pages/admin/PatientsPage'
import { CertificatesPage } from './pages/admin/CertificatesPage'
import { SettingsPage } from './pages/admin/SettingsPage'
import { SystemHealthPage } from './pages/it/SystemHealthPage'
import { DashboardPage } from './pages/dashboard/DashboardPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<HomeRedirect />} />

            <Route element={<ProtectedRoute permission="report.view" />}>
              <Route path="dashboard" element={<DashboardPage />} />
            </Route>

            <Route element={<ProtectedRoute permission="certificate.create" />}>
              <Route path="reception" element={<ReceptionPage />} />
              <Route path="reception/certificates" element={<ReceptionCertificatesPage />} />
            </Route>

            <Route element={<ProtectedRoute permission="certificate.print" />}>
              <Route path="reception/printed" element={<ReceptionPrintedCertificatesPage />} />
            </Route>

            <Route element={<ProtectedRoute permission="certificate.finalize" />}>
              <Route path="doctor" element={<DoctorQueuePage />} />
              <Route path="doctor/certificates/:id" element={<CertificateEditPage />} />
            </Route>

            <Route element={<ProtectedRoute permission="certificate.view_own" />}>
              <Route path="doctor/mine" element={<MyCertificatesPage />} />
            </Route>

            <Route element={<ProtectedRoute permission="form_field.manage" />}>
              <Route path="admin/form-hub" element={<FormHubPage />} />
            </Route>

            <Route element={<ProtectedRoute permission="certificate_type.manage" />}>
              <Route path="admin/certificate-types" element={<CertificateTypesPage />} />
            </Route>

            <Route element={<ProtectedRoute permission="user.view" />}>
              <Route path="admin/users" element={<UsersPage />} />
            </Route>

            <Route element={<ProtectedRoute permission="patient.delete" />}>
              <Route path="admin/patients" element={<PatientsPage />} />
            </Route>

            <Route element={<ProtectedRoute permission="certificate.delete" />}>
              <Route path="admin/certificates" element={<CertificatesPage />} />
            </Route>

            <Route element={<ProtectedRoute permission="settings.manage" />}>
              <Route path="admin/settings" element={<SettingsPage />} />
            </Route>

            <Route element={<ProtectedRoute role="it" />}>
              <Route path="it/system" element={<SystemHealthPage />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
