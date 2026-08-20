import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { customerApi, Customer } from '../lib/types';
import { Card, Badge, SearchBar, Pagination } from '../components/ui';

export default function Customers() {
  const [data, setData] = useState<{ items: Customer[]; total: number }>({ items: [], total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    customerApi.list({ page, search, status }).then(setData).finally(() => setLoading(false));
  }, [page, search, status]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">Customers</h1>
        <div className="flex gap-3 flex-wrap">
          <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search phone, name, country..." />
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="input max-w-[150px]">
            <option value="">All Status</option>
            <option value="NONE">None</option>
            <option value="PENDING">Pending</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="REVOKED">Revoked</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-900 text-slate-400">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Customer ID</th>
                <th className="text-left px-4 py-3 font-medium">Phone</th>
                <th className="text-left px-4 py-3 font-medium">Country</th>
                <th className="text-left px-4 py-3 font-medium">Key Status</th>
                <th className="text-left px-4 py-3 font-medium">Payment</th>
                <th className="text-left px-4 py-3 font-medium">Support</th>
                <th className="text-left px-4 py-3 font-medium">Last Contact</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-500">Loading...</td></tr>
              ) : data.items.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-500">No customers found</td></tr>
              ) : data.items.map((c) => (
                <tr key={c._id} className="border-t border-slate-800 hover:bg-surface-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/customers/${c._id}`} className="text-primary-400 hover:underline">{c.customerId}</Link>
                  </td>
                  <td className="px-4 py-3 text-slate-300">+{c.phoneNumber}</td>
                  <td className="px-4 py-3 text-slate-300">{c.country}</td>
                  <td className="px-4 py-3"><Badge status={c.accessKeyStatus} /></td>
                  <td className="px-4 py-3"><Badge status={c.paymentStatus} /></td>
                  <td className="px-4 py-3"><Badge status={c.supportStatus} /></td>
                  <td className="px-4 py-3 text-slate-400">{new Date(c.lastContact).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4">
          <Pagination page={page} limit={20} total={data.total} onPage={setPage} />
        </div>
      </Card>
    </div>
  );
}
