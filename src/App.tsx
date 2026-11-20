import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Gate, RequireAuth } from './components/AdminShell.tsx'
import { PublicShell } from './components/PublicShell.tsx'
import { AgentPage } from './pages/admin/Agent.tsx'
import { AutomationsPage } from './pages/admin/Automations.tsx'
import { CrmPage } from './pages/admin/Crm.tsx'
import { FinancePage } from './pages/admin/Finance.tsx'
import { InventoryPage } from './pages/admin/Inventory.tsx'
import { InvoicesPage } from './pages/admin/Invoices.tsx'
import { OverviewPage } from './pages/admin/Overview.tsx'
import { PeoplePage } from './pages/admin/People.tsx'
import { DocumentsPage, MarketingPage, PartnersPage, ProcurementPage } from './pages/admin/Records.tsx'
import { ReportsPage } from './pages/admin/Reports.tsx'
import { SalesPage } from './pages/admin/Sales.tsx'
import { SettingsPage } from './pages/admin/Settings.tsx'
import { TasksPage } from './pages/admin/Tasks.tsx'
import { CataloguePage } from './pages/Catalogue.tsx'
import { ComparePage } from './pages/ComparePage.tsx'
import { InquirePage } from './pages/InquirePage.tsx'
import { LandingPage } from './pages/Landing.tsx'
import { LoginPage } from './pages/LoginPage.tsx'
import { NotFoundPage } from './pages/NotFound.tsx'
import { VehiclePage } from './pages/VehiclePage.tsx'
import { AppProvider } from './store.tsx'

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <ScrollTop />
        <Routes>
          <Route element={<PublicShell />}>
            <Route index element={<LandingPage />} />
            <Route path="catalogue" element={<CataloguePage />} />
            <Route path="catalogue/:id" element={<VehiclePage />} />
            <Route path="compare" element={<ComparePage />} />
            <Route path="inquire" element={<Navigate to="/inquire/contact" replace />} />
            <Route path="inquire/:kind" element={<InquirePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          <Route path="login" element={<LoginPage />} />
          <Route path="app" element={<RequireAuth />}>
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<Gate page="overview"><OverviewPage /></Gate>} />
            <Route path="inventory" element={<Gate page="inventory"><InventoryPage /></Gate>} />
            <Route path="procurement" element={<Gate page="procurement"><ProcurementPage /></Gate>} />
            <Route path="crm" element={<Gate page="crm"><CrmPage /></Gate>} />
            <Route path="sales" element={<Gate page="sales"><SalesPage /></Gate>} />
            <Route path="invoices" element={<Gate page="invoices"><InvoicesPage /></Gate>} />
            <Route path="finance" element={<Gate page="finance"><FinancePage /></Gate>} />
            <Route path="people" element={<Gate page="people"><PeoplePage /></Gate>} />
            <Route path="tasks" element={<Gate page="tasks"><TasksPage /></Gate>} />
            <Route path="automations" element={<Gate page="automations"><AutomationsPage /></Gate>} />
            <Route path="documents" element={<Gate page="documents"><DocumentsPage /></Gate>} />
            <Route path="partners" element={<Gate page="partners"><PartnersPage /></Gate>} />
            <Route path="marketing" element={<Gate page="marketing"><MarketingPage /></Gate>} />
            <Route path="reports" element={<Gate page="reports"><ReportsPage /></Gate>} />
            <Route path="agent" element={<Gate page="agent"><AgentPage /></Gate>} />
            <Route path="settings" element={<Gate page="settings"><SettingsPage /></Gate>} />
            <Route path="*" element={<section className="card"><h1>That workspace page is not here</h1><p className="muted">Use the sidebar to get back to a page your role can open.</p></section>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  )
}

function ScrollTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}
