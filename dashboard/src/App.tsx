import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getToken } from './lib/api';
import { getMe, AdminInfo } from './lib/auth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Overview from './pages/Overview';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import AccessKeys from './pages/AccessKeys';
import Payments from './pages/Payments';
import Tickets from './pages/Tickets';
import TicketDetail from './pages/TicketDetail';
import FAQPage from './pages/FAQ';
import AuditLogs from './pages/AuditLogs';
import Settings from './pages/Settings';
import SystemHealth from './pages/SystemHealth';
import Admins from './pages/Admins';
import Messages from './pages/Messages';

export default function App() {
  const [admin, setAdmin] = useState<AdminInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    getMe()
      .then((res) => setAdmin(res.admin))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-surface-950">
        <div className="text-slate-400 animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!admin) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login onLogin={setAdmin} />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Navigate to="/" />} />
        <Route element={<Layout admin={admin} onLogout={() => setAdmin(null)} />}>
          <Route path="/" element={<Overview />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/customers/:id" element={<CustomerDetail />} />
          <Route path="/access-keys" element={<AccessKeys />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/tickets" element={<Tickets />} />
          <Route path="/tickets/:ticketId" element={<TicketDetail />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/faq" element={<FAQPage />} />
          <Route path="/admins" element={<Admins />} />
          <Route path="/audit-logs" element={<AuditLogs />} />
          <Route path="/system-health" element={<SystemHealth />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
