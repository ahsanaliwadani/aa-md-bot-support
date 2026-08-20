import { useEffect, useState } from 'react';
import { dashboardApi, HealthStatus } from '../lib/types';
import { Card } from '../components/ui';
import { Wifi, Database, Cpu, HardDrive, Clock, Activity } from 'lucide-react';

export default function SystemHealth() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardApi.getHealth().then(setHealth).finally(() => setLoading(false));
    const interval = setInterval(() => dashboardApi.getHealth().then(setHealth), 15000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !health) return <div className="text-slate-400 animate-pulse">Loading health data...</div>;

  const uptimeHours = Math.floor(health.uptime / 3600);
  const uptimeMin = Math.floor((health.uptime % 3600) / 60);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">System Health</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${health.bot === 'connected' ? 'bg-success-500/10 text-success-500' : 'bg-error-500/10 text-error-500'}`}>
              <Wifi className="w-6 h-6" />
            </div>
            <div>
              <div className="text-white font-semibold">WhatsApp Bot</div>
              <div className={`text-sm capitalize ${health.bot === 'connected' ? 'text-success-500' : 'text-error-500'}`}>{health.bot}</div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${health.database === 'connected' ? 'bg-success-500/10 text-success-500' : 'bg-error-500/10 text-error-500'}`}>
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="text-white font-semibold">MongoDB</div>
              <div className={`text-sm capitalize ${health.database === 'connected' ? 'text-success-500' : 'text-error-500'}`}>{health.database}</div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-primary-500/10 text-primary-400">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <div className="text-white font-semibold">Uptime</div>
              <div className="text-sm text-slate-400">{uptimeHours}h {uptimeMin}m</div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-accent-500/10 text-accent-400">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <div className="text-white font-semibold">Status</div>
              <div className={`text-sm capitalize ${health.status === 'ok' ? 'text-success-500' : 'text-warning-500'}`}>{health.status}</div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><HardDrive className="w-5 h-5 text-primary-400" /> Memory Usage</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Used</span>
              <span className="text-slate-300">{(health.memory.used / 1024 / 1024 / 1024).toFixed(2)} GB</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Total</span>
              <span className="text-slate-300">{(health.memory.total / 1024 / 1024 / 1024).toFixed(2)} GB</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Percentage</span>
              <span className="text-slate-300">{health.memory.percentage}%</span>
            </div>
            <div className="w-full bg-surface-900 rounded-full h-2 mt-2">
              <div className={`h-2 rounded-full transition-all ${health.memory.percentage > 85 ? 'bg-error-500' : 'bg-primary-500'}`} style={{ width: `${health.memory.percentage}%` }} />
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><Cpu className="w-5 h-5 text-primary-400" /> CPU Load Average</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">1 minute</span>
              <span className="text-slate-300">{health.cpu.loadAverage[0].toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">5 minutes</span>
              <span className="text-slate-300">{health.cpu.loadAverage[1].toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">15 minutes</span>
              <span className="text-slate-300">{health.cpu.loadAverage[2].toFixed(2)}</span>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="text-xs text-slate-500">Last updated: {new Date(health.timestamp).toLocaleString()}</div>
      </Card>
    </div>
  );
}
