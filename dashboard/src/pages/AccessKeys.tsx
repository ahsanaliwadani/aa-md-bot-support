import { useEffect, useState } from 'react';
import { keyApi, AccessKey, AccessKeyServer } from '../lib/types';
import { Card, Badge, SearchBar, Pagination, Toast, ConfirmDialog } from '../components/ui';
import { Eye, KeyRound, Copy, Server, Trash2 } from 'lucide-react';

const FALLBACK_SERVERS: AccessKeyServer[] = [
  { id: 1, name: 'Server 1', url: 'https://193.122.82.38.nip.io' },
  { id: 2, name: 'Server 2', url: 'https://141-147-132-189.nip.io' },
  { id: 3, name: 'Server 3', url: 'https://130-110-123-57.nip.io' },
  { id: 4, name: 'Server 4', url: 'https://144-24-220-107.nip.io' },
];

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Something went wrong';
}

export default function AccessKeys() {
  const [data, setData] = useState<{ items: AccessKey[]; total: number }>({ items: [], total: 0 });
  const [servers, setServers] = useState<AccessKeyServer[]>(FALLBACK_SERVERS);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState('');
  const [selectedServerId, setSelectedServerId] = useState(1);
  const [phone, setPhone] = useState('');
  const [connectionId, setConnectionId] = useState('default');
  const [newKey, setNewKey] = useState<{ keyId: string; plainKey: string; server: AccessKeyServer; phone?: string; expiresAt?: string; connectionId: string } | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<AccessKey | null>(null);
  const [selectedKey, setSelectedKey] = useState<AccessKey | null>(null);
  const [revokeReason, setRevokeReason] = useState('');

  const load = () => {
    setLoading(true);
    keyApi.list({ page, search, status })
      .then(setData)
      .catch((err) => showToast(getErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page, search, status]);
  useEffect(() => {
    const stream = new EventSource('/api/dashboard/realtime', { withCredentials: true });
    const refresh = () => load();
    stream.addEventListener('access-key:new', refresh);
    stream.addEventListener('access-key:updated', refresh);
    stream.addEventListener('access-key:revoked', refresh);
    stream.addEventListener('access-key:deleted', refresh);
    return () => stream.close();
  }, [page, search, status]);
  useEffect(() => { keyApi.servers().then((res) => setServers(res.items)).catch(() => setServers(FALLBACK_SERVERS)); }, []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 4000); };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await keyApi.generate({
        serverId: selectedServerId,
        phone: phone.trim() || undefined,
        connectionId: connectionId.trim() || 'default',
      });
      setNewKey(result);
      showToast('Key generated — copy it now, it won\'t be shown again');
      load();
    } catch (err) {
      // Ye line ab asal backend error dikhayegi — e.g. "Insufficient permissions",
      // "Authentication required", ya validation error
      showToast(`Generate failed: ${getErrorMessage(err)}`);
      console.error('Generate key failed:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleAction = async (key: AccessKey, action: 'activate' | 'suspend' | 'reactivate' | 'revoke') => {
    if (action === 'revoke') { setConfirmRevoke(key); return; }
    try {
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
    } catch (err) {
      showToast(getErrorMessage(err));
    }
  };

  const handleAssignPhone = async (key: AccessKey) => {
    const number = prompt('Assign this pending key to phone number (e.g. 923001234567)');
    if (!number) return;
    try {
      await keyApi.assignPhone(key.keyId, number);
      showToast('Key assigned to phone number');
      load();
    } catch (err) {
      showToast(getErrorMessage(err));
    }
  };

  const handleDelete = async (key: AccessKey) => {
    if (!window.confirm(`Delete access key ${key.keyId} permanently?`)) return;
    try {
      await keyApi.delete(key.keyId);
      showToast('Access key deleted');
      setSelectedKey(null);
      load();
    } catch (err) {
      showToast(getErrorMessage(err));
    }
  };

  const selectedServer = servers.find((server) => server.id === selectedServerId) || servers[0];

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">Access Keys</h1>
      </div>

      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Server className="w-5 h-5 text-primary-400" />
          <h2 className="text-lg font-semibold text-white">Generate Access Key by Server</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <select value={selectedServerId} onChange={(e) => setSelectedServerId(Number(e.target.value))} className="input">
            {servers.map((server) => <option key={server.id} value={server.id}>{server.name}</option>)}
          </select>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" placeholder="Phone e.g. 923001234567" />
          <input value={connectionId} onChange={(e) => setConnectionId(e.target.value)} className="input" placeholder="Connection ID" />
        </div>
        <div className="mt-3 flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm text-slate-400">Selected endpoint: <span className="text-primary-400 font-mono">{selectedServer?.url}</span></p>
          <button disabled={generating} onClick={handleGenerate} className="btn-primary flex items-center gap-2 disabled:opacity-60">
            <KeyRound className="w-4 h-4" /> {generating ? 'Generating...' : 'Generate Key'}
          </button>
        </div>
      </Card>

      {newKey && (
        <Card className="border-success-500/30 bg-success-500/5">
          <h3 className="text-white font-semibold mb-2">New Access Key Generated</h3>
          <div className="flex items-center gap-3 flex-wrap">
            <code className="text-lg font-mono text-success-500">{newKey.plainKey}</code>
            <button onClick={() => { navigator.clipboard.writeText(newKey.plainKey); showToast('Copied to clipboard'); }} className="btn-secondary text-xs">
              <Copy className="w-4 h-4 inline" /> Copy
            </button>
          </div>
          <p className="text-slate-300 text-sm mt-2">Server: {newKey.server.name} ({newKey.server.url}) · Connection: {newKey.connectionId}{newKey.phone ? ` · Phone: +${newKey.phone}` : ''}</p>
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
          <option value="EXPIRED">Expired</option>
        </select>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-900 text-slate-400">
              <tr><th className="text-left px-4 py-3">Key ID</th><th className="text-left px-4 py-3">Server</th><th className="text-left px-4 py-3">Display</th><th className="text-left px-4 py-3">Number</th><th className="text-left px-4 py-3">Connection</th><th className="text-left px-4 py-3">Status</th><th className="text-left px-4 py-3">Created</th><th className="text-left px-4 py-3">Actions</th></tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={8} className="text-center py-8 text-slate-500">Loading...</td></tr> : data.items.length === 0 ? <tr><td colSpan={8} className="text-center py-8 text-slate-500">No keys found</td></tr> : data.items.map((k) => (
                <tr key={k._id} className="border-t border-slate-800">
                  <td className="px-4 py-3 text-primary-400">{k.keyId}</td><td className="px-4 py-3 text-slate-300">{k.serverName || `Server ${k.serverId || 1}`}</td><td className="px-4 py-3 font-mono text-slate-300">{k.displayId}</td><td className="px-4 py-3 text-slate-300">{k.assignedNumber ? `+${k.assignedNumber}` : '-'}</td><td className="px-4 py-3 text-slate-300">{k.connectionId || 'default'}</td><td className="px-4 py-3"><Badge status={k.status} /></td><td className="px-4 py-3 text-slate-400">{new Date(k.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3"><div className="flex gap-1 flex-wrap">
                    <button onClick={() => setSelectedKey(k)} className="btn-secondary text-xs px-2 py-1"><Eye className="w-3 h-3 inline" /> View</button>
                    {k.status === 'PENDING' && <button onClick={() => handleAssignPhone(k)} className="btn-secondary text-xs px-2 py-1">Assign</button>}
                    {k.status === 'PENDING' && <button onClick={() => handleAction(k, 'activate')} className="btn-success text-xs px-2 py-1">Activate</button>}
                    {k.status === 'ACTIVE' && <button onClick={() => handleAction(k, 'suspend')} className="btn-secondary text-xs px-2 py-1">Suspend</button>}
                    {k.status === 'SUSPENDED' && <button onClick={() => handleAction(k, 'reactivate')} className="btn-success text-xs px-2 py-1">Reactivate</button>}
                    {k.status !== 'REVOKED' && <button onClick={() => handleAction(k, 'revoke')} className="btn-danger text-xs px-2 py-1">Revoke</button>}
                    <button onClick={() => handleDelete(k)} className="btn-secondary text-error-500 text-xs px-2 py-1"><Trash2 className="w-3 h-3 inline" /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4"><Pagination page={page} limit={20} total={data.total} onPage={setPage} /></div>
      </Card>

      {selectedKey && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setSelectedKey(null)}>
          <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <Card className="max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="text-xl font-semibold text-white">Access Key Details</h3>
                <button onClick={() => setSelectedKey(null)} className="btn-secondary text-xs">Close</button>
              </div>
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <div><span className="text-slate-500">Key ID:</span><div className="text-primary-400 font-mono break-all">{selectedKey.keyId}</div></div>
                <div><span className="text-slate-500">Display:</span><div className="text-slate-300 font-mono">{selectedKey.displayId}</div></div>
                <div><span className="text-slate-500">Status:</span><div><Badge status={selectedKey.status} /></div></div>
                <div><span className="text-slate-500">Number:</span><div className="text-slate-300">{selectedKey.assignedNumber ? `+${selectedKey.assignedNumber}` : 'Not assigned'}</div></div>
                <div><span className="text-slate-500">Server:</span><div className="text-slate-300">{selectedKey.serverName}</div></div>
                <div><span className="text-slate-500">Connection:</span><div className="text-slate-300">{selectedKey.connectionId || 'default'}</div></div>
                <div><span className="text-slate-500">Created:</span><div className="text-slate-300">{new Date(selectedKey.createdAt).toLocaleString()}</div></div>
                <div><span className="text-slate-500">Activated:</span><div className="text-slate-300">{selectedKey.activatedAt ? new Date(selectedKey.activatedAt).toLocaleString() : '-'}</div></div>
              </div>
              <h4 className="text-white font-semibold mt-5 mb-2">Realtime History</h4>
              <div className="h-56 overflow-y-auto space-y-2 rounded-lg border border-slate-800 p-3">
                {selectedKey.history?.length ? selectedKey.history.map((h, i) => (
                  <div key={i} className="text-sm border-b border-slate-800/70 pb-2 last:border-0">
                    <div className="text-slate-200">{h.action}</div>
                    <div className="text-xs text-slate-500">{new Date(h.at).toLocaleString()}{h.detail ? ` · ${h.detail}` : ''}</div>
                  </div>
                )) : <div className="text-slate-500 text-sm">No history</div>}
              </div>
            </Card>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmRevoke}
        title="Revoke Access Key"
        message={`Are you sure you want to revoke key ${confirmRevoke?.keyId}? This action cannot be undone.`}
        onConfirm={async () => {
          if (!confirmRevoke) return;
          try {
            await keyApi.revoke(confirmRevoke.keyId, revokeReason || 'Revoked by admin');
            setConfirmRevoke(null);
            setRevokeReason('');
            showToast('Key revoked');
            load();
          } catch (err) {
            showToast(getErrorMessage(err));
          }
        }}
        onCancel={() => { setConfirmRevoke(null); setRevokeReason(''); }}
      />
    </div>
  );
}
