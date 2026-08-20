export function Badge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ACTIVE: 'bg-success-500/20 text-success-500',
    PENDING: 'bg-warning-500/20 text-warning-500',
    SUSPENDED: 'bg-warning-500/20 text-warning-500',
    REVOKED: 'bg-error-500/20 text-error-500',
    EXPIRED: 'bg-error-500/20 text-error-500',
    APPROVED: 'bg-success-500/20 text-success-500',
    REJECTED: 'bg-error-500/20 text-error-500',
    REFUNDED: 'bg-warning-500/20 text-warning-500',
    UNDER_REVIEW: 'bg-primary-500/20 text-primary-400',
    OPEN: 'bg-primary-500/20 text-primary-400',
    IN_PROGRESS: 'bg-warning-500/20 text-warning-500',
    WAITING_FOR_USER: 'bg-accent-500/20 text-accent-400',
    RESOLVED: 'bg-success-500/20 text-success-500',
    CLOSED: 'bg-slate-600/20 text-slate-400',
    NONE: 'bg-slate-600/20 text-slate-400',
    LOW: 'bg-slate-600/20 text-slate-400',
    NORMAL: 'bg-primary-500/20 text-primary-400',
    HIGH: 'bg-warning-500/20 text-warning-500',
    URGENT: 'bg-error-500/20 text-error-500',
  };
  return (
    <span className={`badge ${colors[status] || 'bg-slate-600/20 text-slate-400'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function StatCard({ label, value, icon: Icon, color = 'primary' }: { label: string; value: string | number; icon: React.ElementType; color?: string }) {
  const colors: Record<string, string> = {
    primary: 'text-primary-400 bg-primary-500/10',
    success: 'text-success-500 bg-success-500/10',
    warning: 'text-warning-500 bg-warning-500/10',
    error: 'text-error-500 bg-error-500/10',
    accent: 'text-accent-400 bg-accent-500/10',
  };
  return (
    <div className="card flex items-center gap-4">
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colors[color]}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <div className="text-2xl font-bold text-white">{value}</div>
        <div className="text-sm text-slate-500">{label}</div>
      </div>
    </div>
  );
}

export function Pagination({ page, limit, total, onPage }: { page: number; limit: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.ceil(total / limit);
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-4">
      <div className="text-sm text-slate-500">
        {total} results, page {page} of {pages}
      </div>
      <div className="flex gap-2">
        <button onClick={() => onPage(page - 1)} disabled={page <= 1} className="btn-secondary text-xs">Prev</button>
        <button onClick={() => onPage(page + 1)} disabled={page >= pages} className="btn-secondary text-xs">Next</button>
      </div>
    </div>
  );
}

export function Toast({ message, type = 'success', onClose }: { message: string; type?: string; onClose: () => void }) {
  const colors: Record<string, string> = {
    success: 'bg-success-600',
    error: 'bg-error-600',
    info: 'bg-primary-600',
  };
  return (
    <div className="fixed top-4 right-4 z-[100] animate-fade-in">
      <div className={`${colors[type]} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3`}>
        <span>{message}</span>
        <button onClick={onClose} className="text-white/80 hover:text-white">&times;</button>
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, onConfirm, onCancel }: { open: boolean; title: string; message: string; onConfirm: () => void; onCancel: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
      <div className="card max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        <p className="text-slate-400 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="btn-secondary">Cancel</button>
          <button onClick={onConfirm} className="btn-danger">Confirm</button>
        </div>
      </div>
    </div>
  );
}

export function SearchBar({ value, onChange, placeholder = 'Search...' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="input max-w-xs"
    />
  );
}
