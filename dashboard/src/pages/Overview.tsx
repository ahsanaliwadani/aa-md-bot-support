import { useEffect, useState } from 'react';
import { dashboardApi, DashboardStats } from '../lib/types';
import { StatCard, Card } from '../components/ui';
import { Users, Key, CreditCard, Ticket, CheckCircle, XCircle, Wifi, Database } from 'lucide-react';

export default function Overview() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const refresh = () => dashboardApi.getStats().then(setStats).finally(() => setLoading(false));
    refresh();
    const interval = setInterval(refresh, 30000);
    const stream = new EventSource('/api/dashboard/realtime', { withCredentials: true });
    ['whatsapp:status', 'message:new', 'access-key:new', 'access-key:updated', 'access-key:revoked', 'ticket:new'].forEach((event) => {
      stream.addEventListener(event, refresh);
    });
    return () => {
      clearInterval(interval);
      stream.close();
    };
  }, []);

  if (loading || !stats) return <div className="text-slate-400 animate-pulse">Loading dashboard...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Dashboard Overview</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Total Customers" value={stats.totalCustomers} icon={Users} color="primary" />
        <StatCard label="Active Keys" value={stats.activeKeys} icon={Key} color="success" />
        <StatCard label="Pending Payments" value={stats.pendingPayments} icon={CreditCard} color="warning" />
        <StatCard label="Open Tickets" value={stats.openTickets} icon={Ticket} color="warning" />
        <StatCard label="Resolved Tickets" value={stats.resolvedTickets} icon={CheckCircle} color="success" />
        <StatCard label="Revoked Keys" value={stats.revokedKeys} icon={XCircle} color="error" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center gap-3 mb-2">
            <Wifi className={`w-6 h-6 ${stats.botConnected ? 'text-success-500' : 'text-error-500'}`} />
            <div>
              <div className="text-white font-semibold">WhatsApp Bot</div>
              <div className={`text-sm ${stats.botConnected ? 'text-success-500' : 'text-error-500'}`}>
                {stats.botConnected ? 'Connected' : 'Disconnected'}
              </div>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3 mb-2">
            <Database className={`w-6 h-6 ${stats.dbConnected ? 'text-success-500' : 'text-error-500'}`} />
            <div>
              <div className="text-white font-semibold">MongoDB</div>
              <div className={`text-sm ${stats.dbConnected ? 'text-success-500' : 'text-error-500'}`}>
                {stats.dbConnected ? 'Connected' : 'Disconnected'}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
