import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ticketApi, Ticket } from '../lib/types';
import { Card, Badge, SearchBar, Pagination, Toast } from '../components/ui';

export default function Tickets() {
  const [data, setData] = useState<{ items: Ticket[]; total: number }>({ items: [], total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  const load = () => {
    setLoading(true);
    ticketApi.list({ page, search, status, priority }).then(setData).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [page, search, status, priority]);

  useEffect(() => {
    const stream = new EventSource('/api/dashboard/realtime', { withCredentials: true });
    stream.addEventListener('ticket:new', load);
    stream.addEventListener('ticket:updated', load);
    return () => stream.close();
  }, [page, search, status, priority]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const resolveTicket = async (ticketId: string) => {
    await ticketApi.updateStatus(ticketId, 'RESOLVED');
    showToast('Ticket resolved');
    load();
  };

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      <h1 className="text-2xl font-bold text-white">Support Tickets</h1>

      <div className="flex gap-3 flex-wrap">
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search tickets..." />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="input max-w-[150px]">
          <option value="">All Status</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="WAITING_FOR_USER">Waiting For User</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </select>
        <select value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }} className="input max-w-[150px]">
          <option value="">All Priority</option>
          <option value="LOW">Low</option>
          <option value="NORMAL">Normal</option>
          <option value="HIGH">High</option>
          <option value="URGENT">Urgent</option>
        </select>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-900 text-slate-400">
              <tr>
                <th className="text-left px-4 py-3">Ticket</th>
                <th className="text-left px-4 py-3">Subject</th>
                <th className="text-left px-4 py-3">Category</th>
                <th className="text-left px-4 py-3">Phone</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Priority</th>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-8 text-slate-500">Loading...</td></tr>
              ) : data.items.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-slate-500">No tickets found</td></tr>
              ) : data.items.map((t) => (
                <tr key={t._id} className="border-t border-slate-800 hover:bg-surface-800/50">
                  <td className="px-4 py-3"><Link to={`/tickets/${t.ticketId}`} className="text-primary-400 hover:underline">{t.ticketId}</Link></td>
                  <td className="px-4 py-3 text-slate-300">{t.subject}</td>
                  <td className="px-4 py-3 text-slate-400">{t.category}</td>
                  <td className="px-4 py-3 text-slate-300">+{t.phoneNumber}</td>
                  <td className="px-4 py-3"><Badge status={t.status} /></td>
                  <td className="px-4 py-3"><Badge status={t.priority} /></td>
                  <td className="px-4 py-3 text-slate-400">{new Date(t.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    {t.status !== 'RESOLVED' && t.status !== 'CLOSED' && (
                      <button onClick={() => resolveTicket(t.ticketId)} className="btn-success text-xs px-2 py-1">Resolve</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4"><Pagination page={page} limit={20} total={data.total} onPage={setPage} /></div>
      </Card>
    </div>
  );
}
