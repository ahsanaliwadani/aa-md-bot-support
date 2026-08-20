import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ticketApi, Ticket } from '../lib/types';
import { Card, Badge, SearchBar, Pagination } from '../components/ui';

export default function Tickets() {
  const [data, setData] = useState<{ items: Ticket[]; total: number }>({ items: [], total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    ticketApi.list({ page, search, status, priority }).then(setData).finally(() => setLoading(false));
  }, [page, search, status, priority]);

  return (
    <div className="space-y-6">
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
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-500">Loading...</td></tr>
              ) : data.items.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-500">No tickets found</td></tr>
              ) : data.items.map((t) => (
                <tr key={t._id} className="border-t border-slate-800 hover:bg-surface-800/50">
                  <td className="px-4 py-3"><Link to={`/tickets/${t.ticketId}`} className="text-primary-400 hover:underline">{t.ticketId}</Link></td>
                  <td className="px-4 py-3 text-slate-300">{t.subject}</td>
                  <td className="px-4 py-3 text-slate-400">{t.category}</td>
                  <td className="px-4 py-3 text-slate-300">+{t.phoneNumber}</td>
                  <td className="px-4 py-3"><Badge status={t.status} /></td>
                  <td className="px-4 py-3"><Badge status={t.priority} /></td>
                  <td className="px-4 py-3 text-slate-400">{new Date(t.createdAt).toLocaleDateString()}</td>
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
