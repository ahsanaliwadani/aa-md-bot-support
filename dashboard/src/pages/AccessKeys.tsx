import { useEffect, useState } from 'react';
import { keyApi, AccessKey } from '../lib/types';
import { Card, Badge, SearchBar, Pagination, Toast, ConfirmDialog } from '../components/ui';
import { KeyRound, Copy } from 'lucide-react';

export default function AccessKeys() {
  const [data, setData] = useState<{ items: AccessKey[]; total: number }>({ items: [], total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [newKey, setNewKey] = useState<{ keyId: string; plainKey: string } | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<AccessKey | null>(null);
  const [revokeReason, setRevokeReason] = useState('');

  const load = () => {
    setLoading(true);
    keyApi.list({ page, search, status }).then(setData).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page, search, status]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 4000); };

  const handleGenerate = async () => {
    const result = await keyApi.generate();
    setNewKey(result);
    showToast('Key generated — copy it now, it won\'t be shown again');
    load();
  };

  const handleAction = async (key: AccessKey, action: 'activate' | 'suspend' | 'reactivate' | 'revoke') => {
    if (action === 'revoke') { setConfirmRevoke(key); return; }
    if (action === 'suspend') {
      const reason = prompt('Reason for suspension?') || 'Suspended by admin';
      await keyApi.suspend(key.keyId, reason);
    } else if (action === 'activate') {
      await keyApi.activate(key.keyId);
    } else if (action === 'reactivate') {
      await keyApi.reactivate(key.keyId);
    }
    showToast(`Key ${action}d`);
    load();
  };

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">Access Keys</h1>
        <button onClick={handleGenerate} className="btn-primary flex items-center gap-2">
          <KeyRound className="w-4 h-4" /> Generate Key
        </button>
      </div>

      {newKey && (
        <Card className="border-success-500/30 bg-success-500/5">
          <h3 className="text-white font-semibold mb-2">New Access Key Generated</h3>
          <div className="flex items-center gap-3">
            <code className="text-lg font-mono text-success-500">{newKey.plainKey}</code>
            <button onClick={() => { navigator.clipboard.writeText(newKey.plainKey); showToast('Copied to clipboard'); }} className="btn-secondary text-xs">
              <Copy className="w-4 h-4 inline" /> Copy
            </button>
          </div>
          <p className="text-warning-500 text-sm mt-2">Save this key now — it will not be shown again.</p>
          <button onClick={() => setNewKey(null)} className="btn-secondary text-xs mt-3">Dismiss</button>
        </Card>
      )}

      <div className="flex gap-3 flex-wrap">
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search keys..." />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="input max-w-[150px]">
          <option value="">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="REVOKED">Revoked</option>
          <option value="EXPIRED">Expired</option>
        </select>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-900 text-slate-400">
              <tr>
                <th className="text-left px-4 py-3">Key ID</th>
                <th className="text-left px-4 py-3">Display</th>
                <th className="text-left px-4 py-3">Number</th>
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Created</th>
                <th className="text-left px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-500">Loading...</td></tr>
              ) : data.items.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-500">No keys found</td></tr>
              ) : data.items.map((k) => (
                <tr key={k._id} className="border-t border-slate-800">
                  <td className="px-4 py-3 text-primary-400">{k.keyId}</td>
                  <td className="px-4 py-3 font-mono text-slate-300">{k.displayId}</td>
                  <td className="px-4 py-3 text-slate-300">{k.assignedNumber ? `+${k.assignedNumber}` : '-'}</td>
                  <td className="px-4 py-3 text-slate-300">{k.customerId ? (k.customerId as { phoneNumber: string }).phoneNumber : '-'}</td>
                  <td className="px-4 py-3"><Badge status={k.status} /></td>
                  <td className="px-4 py-3 text-slate-400">{new Date(k.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {k.status === 'PENDING' && <button onClick={() => handleAction(k, 'activate')} className="btn-success text-xs px-2 py-1">Activate</button>}
                      {k.status === 'ACTIVE' && <button onClick={() => handleAction(k, 'suspend')} className="btn-secondary text-xs px-2 py-1">Suspend</button>}
                      {k.status === 'SUSPENDED' && <button onClick={() => handleAction(k, 'reactivate')} className="btn-success text-xs px-2 py-1">Reactivate</button>}
                      {k.status !== 'REVOKED' && <button onClick={() => handleAction(k, 'revoke')} className="btn-danger text-xs px-2 py-1">Revoke</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4"><Pagination page={page} limit={20} total={data.total} onPage={setPage} /></div>
      </Card>

      <ConfirmDialog
        open={!!confirmRevoke}
        title="Revoke Access Key"
        message={`Are you sure you want to revoke key ${confirmRevoke?.keyId}? This action cannot be undone.`}
        onConfirm={async () => { if (confirmRevoke) { await keyApi.revoke(confirmRevoke.keyId, revokeReason || 'Revoked by admin'); setConfirmRevoke(null); setRevokeReason(''); showToast('Key revoked'); load(); } }}
        onCancel={() => { setConfirmRevoke(null); setRevokeReason(''); }}
      />
    </div>
  );
}
