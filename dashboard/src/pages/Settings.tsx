import { useEffect, useState } from 'react';
import { settingsApi, AppSettings } from '../lib/types';
import { Card, Toast } from '../components/ui';

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { settingsApi.get().then((res) => setSettings(res.settings)); }, []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await settingsApi.update(settings);
      showToast('Settings saved');
    } catch (err) {
      showToast((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return <div className="text-slate-400 animate-pulse">Loading settings...</div>;

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Changes'}</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="text-white font-semibold mb-4">Bot Configuration</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Bot Name</label>
              <input value={settings.botName} onChange={(e) => setSettings({ ...settings, botName: e.target.value })} className="input" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Support Number</label>
              <input value={settings.supportNumber} onChange={(e) => setSettings({ ...settings, supportNumber: e.target.value })} className="input" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Welcome Message</label>
              <textarea value={settings.welcomeMessage} onChange={(e) => setSettings({ ...settings, welcomeMessage: e.target.value })} rows={3} className="input" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Away Message</label>
              <textarea value={settings.awayMessage} onChange={(e) => setSettings({ ...settings, awayMessage: e.target.value })} rows={3} className="input" />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={settings.maintenanceMode} onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })} className="w-4 h-4" />
              Maintenance Mode
            </label>
          </div>
        </Card>

        <Card>
          <h3 className="text-white font-semibold mb-2">Pricing</h3>
          <p className="text-sm text-slate-400 mb-4">Change AA MD Bot prices, currencies, labels, and payment instructions without code changes.</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Pakistan Price (PKR)</label>
              <div className="flex gap-2">
                <input type="number" value={settings.pricing.pakistan.amount} onChange={(e) => setSettings({ ...settings, pricing: { ...settings.pricing, pakistan: { ...settings.pricing.pakistan, amount: Number(e.target.value) } } })} className="input" />
                <input value={settings.pricing.pakistan.currency} onChange={(e) => setSettings({ ...settings, pricing: { ...settings.pricing, pakistan: { ...settings.pricing.pakistan, currency: e.target.value } } })} className="input max-w-[110px]" placeholder="PKR" />
                <input value={settings.pricing.pakistan.label} onChange={(e) => setSettings({ ...settings, pricing: { ...settings.pricing, pakistan: { ...settings.pricing.pakistan, label: e.target.value } } })} className="input" placeholder="Rs. 1,000" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">International Price (USD)</label>
              <div className="flex gap-2">
                <input type="number" value={settings.pricing.international.amount} onChange={(e) => setSettings({ ...settings, pricing: { ...settings.pricing, international: { ...settings.pricing.international, amount: Number(e.target.value) } } })} className="input" />
                <input value={settings.pricing.international.currency} onChange={(e) => setSettings({ ...settings, pricing: { ...settings.pricing, international: { ...settings.pricing.international, currency: e.target.value } } })} className="input max-w-[110px]" placeholder="USD" />
                <input value={settings.pricing.international.label} onChange={(e) => setSettings({ ...settings, pricing: { ...settings.pricing, international: { ...settings.pricing.international, label: e.target.value } } })} className="input" placeholder="$5 USD" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Payment Instructions</label>
              <textarea value={settings.paymentInstructions} onChange={(e) => setSettings({ ...settings, paymentInstructions: e.target.value })} rows={3} className="input" />
            </div>
            <div className="rounded-lg border border-slate-700 p-3 space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-200"><input type="checkbox" checked={settings.jazzCash.enabled} onChange={(e) => setSettings({ ...settings, jazzCash: { ...settings.jazzCash, enabled: e.target.checked } })} className="w-4 h-4" /> Enable JazzCash for Pakistan</label>
              <input value={settings.jazzCash.accountTitle} onChange={(e) => setSettings({ ...settings, jazzCash: { ...settings.jazzCash, accountTitle: e.target.value } })} className="input" placeholder="JazzCash account title" />
              <input value={settings.jazzCash.accountNumber} onChange={(e) => setSettings({ ...settings, jazzCash: { ...settings.jazzCash, accountNumber: e.target.value } })} className="input" placeholder="JazzCash account number" />
              <textarea value={settings.jazzCash.instructions} onChange={(e) => setSettings({ ...settings, jazzCash: { ...settings.jazzCash, instructions: e.target.value } })} rows={2} className="input" placeholder="Payment proof instructions" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Session Timeout (minutes)</label>
              <input type="number" value={settings.sessionTimeoutMin} onChange={(e) => setSettings({ ...settings, sessionTimeoutMin: Number(e.target.value) })} className="input" />
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="text-white font-semibold mb-4">Support Hours</h3>
          <label className="flex items-center gap-2 text-sm text-slate-300 mb-3">
            <input type="checkbox" checked={settings.supportHours.enabled} onChange={(e) => setSettings({ ...settings, supportHours: { ...settings.supportHours, enabled: e.target.checked } })} className="w-4 h-4" />
            Enable Support Hours
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Start</label>
              <input value={settings.supportHours.start} onChange={(e) => setSettings({ ...settings, supportHours: { ...settings.supportHours, start: e.target.value } })} className="input" placeholder="09:00" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">End</label>
              <input value={settings.supportHours.end} onChange={(e) => setSettings({ ...settings, supportHours: { ...settings.supportHours, end: e.target.value } })} className="input" placeholder="18:00" />
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-sm text-slate-400 mb-1">Timezone</label>
            <input value={settings.supportHours.timezone} onChange={(e) => setSettings({ ...settings, supportHours: { ...settings.supportHours, timezone: e.target.value } })} className="input" placeholder="Asia/Karachi" />
          </div>
        </Card>
      </div>
    </div>
  );
}
