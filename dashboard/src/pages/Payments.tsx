import { useEffect, useState } from 'react';
import { paymentApi, Payment } from '../lib/types';
import { Card, Badge, SearchBar, Pagination, Toast, ConfirmDialog } from '../components/ui';
import { Check, X } from 'lucide-react';

export default function Payments() {
  const [data, setData] = useState<{ items: Payment[]; total: number }>({ items: [], total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [confirmReject, setConfirmReject] = useState<Payment | null>(null);
  const [generatedKey, setGeneratedKey] = useState<{ plainKey: string; keyId: string } | null>(null);

  const load = () => {
    setLoading(true);
    paymentApi.list({ page, search, status }).then(setData).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page, search, status]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 5000); };

  const handleApprove = async (p: Payment) => {
    const result = await paymentApi.approve(p.paymentRequestId) as { keyResult?: { plainKey: string; keyId: string } };
    if (result.keyResult) {
      setGeneratedKey(result.keyResult);
      showToast('Payment approved — key generated!');
    } else {
      showToast('Payment approved');
    }
    load();
  };

  const handleReject = async (p: Payment) => {
    const notes = window.prompt('Optional rejection reason (shown in the payment record):', '') || undefined;
    await paymentApi.reject(p.paymentRequestId, notes);
    setConfirmReject(null);
    showToast('Payment marked as rejected. It remains available in the Rejected filter.');
    load();
  };

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      <h1 className="text-2xl font-bold text-white">Payments</h1>

      {generatedKey && (
        <Card className="border-success-500/30 bg-success-500/5">
          <h3 className="text-white font-semibold mb-2">Access Key Generated for Approved Payment</h3>
          <code className="text-lg font-mono text-success-500">{generatedKey.plainKey}</code>
          <p className="text-warning-500 text-sm mt-2">Copy this key and send it to the customer. It won't be shown again.</p>
          <div className="flex gap-2 mt-3">
            <button onClick={() => navigator.clipboard.writeText(generatedKey.plainKey)} className="btn-secondary text-xs">Copy Key</button>
            <button onClick={() => setGeneratedKey(null)} className="btn-secondary text-xs">Dismiss</button>
          </div>
        </Card>
      )}

      <div className="flex gap-3 flex-wrap">
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search payment requests..." />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="input max-w-[150px]">
          <option value="">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="UNDER_REVIEW">Under Review</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="REFUNDED">Refunded</option>
        </select>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-900 text-slate-400">
              <tr>
                <th className="text-left px-4 py-3">Request ID</th>
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-left px-4 py-3">Amount</th>
                <th className="text-left px-4 py-3">Country</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Review note</th>
                <th className="text-left px-4 py-3">Proof</th>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-8 text-slate-500">Loading...</td></tr>
              ) : data.items.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-8 text-slate-500">No payments found</td></tr>
              ) : data.items.map((p) => (
                <tr key={p._id} className="border-t border-slate-800">
                  <td className="px-4 py-3 text-primary-400">{p.paymentRequestId}</td>
                  <td className="px-4 py-3 text-slate-300">{p.customerId ? (p.customerId as { phoneNumber: string }).phoneNumber : '-'}</td>
                  <td className="px-4 py-3 text-slate-300">{p.amount} {p.currency}</td>
                  <td className="px-4 py-3 text-slate-300">{p.country}</td>
                  <td className="px-4 py-3"><Badge status={p.status} /></td>
                  <td className="px-4 py-3 text-xs text-slate-400 max-w-[180px]">{p.notes || '—'}</td>
                  <td className="px-4 py-3">{p.proofMediaUrl ? <a href={p.proofMediaUrl} target="_blank" rel="noreferrer" className="text-xs text-primary-400 hover:underline">View proof</a> : <span className="text-xs text-slate-500">—</span>}</td>
                  <td className="px-4 py-3 text-slate-400">{new Date(p.submittedAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    {(p.status === 'PENDING' || p.status === 'UNDER_REVIEW') && (
                      <div className="flex gap-1">
                        <button onClick={() => handleApprove(p)} className="btn-success text-xs px-2 py-1 flex items-center gap-1"><Check className="w-3 h-3" /> Approve</button>
                        <button onClick={() => setConfirmReject(p)} className="btn-danger text-xs px-2 py-1 flex items-center gap-1"><X className="w-3 h-3" /> Reject</button>
                      </div>
                    )}
                    {p.accessKeyId && <span className="text-xs text-slate-500">Key: {(p.accessKeyId as { displayId: string }).displayId}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4"><Pagination page={page} limit={20} total={data.total} onPage={setPage} /></div>
      </Card>

      <ConfirmDialog
        open={!!confirmReject}
        title="Reject Payment"
        message={`Reject payment request ${confirmReject?.paymentRequestId}? The record will be kept with a REJECTED status for history.`}
        onConfirm={() => { if (confirmReject) void handleReject(confirmReject); }}
        onCancel={() => setConfirmReject(null)}
      />
    </div>
  );
}
