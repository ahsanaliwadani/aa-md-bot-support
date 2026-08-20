import { useEffect, useState } from 'react';
import { auditApi, AuditLog } from '../lib/types';
import { Card, SearchBar, Pagination, Badge } from '../components/ui';

export default function AuditLogs() {
  const [data, setData] = useState<{ items: AuditLog[]; total: number }>({ items: [], total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    auditApi.list({ page, search, action }).then(setData).finally(() => setLoading(false));
  }, [page, search, action]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Audit Logs</h1>

      <div className="flex gap-3 flex-wrap">
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search logs..." />
        <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className="input max-w-[200px]">
          <option value="">All Actions</option>
          <option value="KEY_CREATED">Key Created</option>
          <option value="KEY_ACTIVATED">Key Activated</option>
          <option value="KEY_REVOKED">Key Revoked</option>
          <option value="PAYMENT_APPROVED">Payment Approved</option>
          <option value="PAYMENT_REJECTED">Payment Rejected</option>
          <option value="TICKET_REPLY">Ticket Reply</option>
          <option value="ADMIN_LOGIN">Admin Login</option>
          <option value="SETTINGS_CHANGED">Settings Changed</option>
        </select>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-900 text-slate-400">
              <tr>
                <th className="text-left px-4 py-3">Action</th>
                <th className="text-left px-4 py-3">Admin</th>
                <th className="text-left px-4 py-3">Target</th>
                <th className="text-left px-4 py-3">Result</th>
                <th className="text-left px-4 py-3">IP</th>
                <th className="text-left px-4 py-3">Time</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-500">Loading...</td></tr>
              ) : data.items.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-500">No logs found</td></tr>
              ) : data.items.map((log) => (
                <tr key={log._id} className="border-t border-slate-800">
                  <td className="px-4 py-3 text-primary-400 font-mono text-xs">{log.action}</td>
                  <td className="px-4 py-3 text-slate-300">{log.adminEmail}</td>
                  <td className="px-4 py-3 text-slate-400">{log.target}{log.targetId ? ` #${log.targetId.slice(-6)}` : ''}</td>
                  <td className="px-4 py-3"><Badge status={log.result === 'SUCCESS' ? 'ACTIVE' : 'REVOKED'} /></td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{log.ip || '-'}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{new Date(log.at).toLocaleString()}</td>
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
