import { useEffect, useState } from 'react';
import { dashboardApi, WhatsAppStatus } from '../lib/types';
import { Card, Toast } from '../components/ui';
import { Copy, RefreshCw, Smartphone, Wifi } from 'lucide-react';

export default function WhatsAppConnect() {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(''), 4000);
  };

  const load = () => {
    dashboardApi.getWhatsAppStatus().then(setStatus).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  const requestCode = async () => {
    setRequesting(true);
    try {
      const result = await dashboardApi.requestWhatsAppPairingCode(phone);
      setStatus((current) => current ? { ...current, pairingCode: result.code } : { connected: false, qr: null, pairingCode: result.code, updatedAt: new Date().toISOString() });
      showToast('Pairing code generated');
    } finally {
      setRequesting(false);
    }
  };

  const copy = (value: string) => {
    navigator.clipboard.writeText(value);
    showToast('Copied to clipboard');
  };

  if (loading || !status) return <div className="text-slate-400 animate-pulse">Loading WhatsApp connection...</div>;

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">WhatsApp Connect</h1>
        <button onClick={load} className="btn-secondary flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Refresh</button>
      </div>

      <Card>
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${status.connected ? 'bg-success-500/10 text-success-500' : 'bg-warning-500/10 text-warning-500'}`}>
            <Wifi className="w-6 h-6" />
          </div>
          <div>
            <div className="text-white font-semibold">WhatsApp Status</div>
            <div className={`text-sm ${status.connected ? 'text-success-500' : 'text-warning-500'}`}>{status.connected ? 'Connected' : 'Waiting for pairing'}</div>
            {status.updatedAt && <div className="text-xs text-slate-500">Last update: {new Date(status.updatedAt).toLocaleString()}</div>}
          </div>
        </div>
      </Card>

      {!status.connected && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card>
            <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2"><Smartphone className="w-5 h-5 text-primary-400" /> Connect with Pairing Code</h2>
            <p className="text-sm text-slate-400 mb-4">Enter the WhatsApp support phone number in international format, then use the code in WhatsApp Linked Devices.</p>
            <div className="flex gap-2 flex-wrap">
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input flex-1 min-w-[220px]" placeholder="923001234567" />
              <button disabled={requesting || phone.trim().length < 7} onClick={requestCode} className="btn-primary disabled:opacity-60">{requesting ? 'Generating...' : 'Get Pairing Code'}</button>
            </div>
            {status.pairingCode && (
              <div className="mt-4 p-4 rounded-lg bg-surface-900 border border-slate-800">
                <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Pairing Code</div>
                <div className="flex items-center gap-3 flex-wrap">
                  <code className="text-3xl font-mono text-success-500 tracking-widest">{status.pairingCode}</code>
                  <button onClick={() => copy(status.pairingCode!)} className="btn-secondary text-xs"><Copy className="w-4 h-4 inline" /> Copy</button>
                </div>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-white mb-2">QR / Manual Fallback</h2>
            <p className="text-sm text-slate-400 mb-4">If pairing code is unavailable, open PM2 logs on the server and scan the QR shown there.</p>
            <code className="block p-3 rounded-lg bg-surface-900 text-primary-400 text-sm whitespace-pre-wrap">sudo -H -u aamd pm2 logs aamd-support --lines 50</code>
            {status.qr && (
              <div className="mt-4">
                <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Latest raw QR payload</div>
                <textarea readOnly value={status.qr} className="input min-h-[120px] font-mono text-xs" />
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
