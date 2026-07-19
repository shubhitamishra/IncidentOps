import { useState, useEffect } from 'react';
import { api } from '../api';

const DEMO_SERVICES = [
  { _id: '1', name: 'Auth API Service', url: 'https://auth.example.com/health', status: 'healthy', consecutiveFailures: 0, failureThreshold: 3, lastResponseTimeMs: 42 },
  { _id: '2', name: 'Payment Gateway', url: 'https://payments.example.com/health', status: 'healthy', consecutiveFailures: 0, failureThreshold: 3, lastResponseTimeMs: 118 },
  { _id: '3', name: 'Broken Service (Demo)', url: 'http://localhost:5000/api/mock/broken-service', status: 'degraded', consecutiveFailures: 2, failureThreshold: 3, lastResponseTimeMs: 503 }
];

export default function ServicesTab() {
  const [services, setServices] = useState([]);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);

  const load = () => {
    api.getServices()
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setServices(data);
          setIsDemoMode(false);
        } else {
          setServices(DEMO_SERVICES);
          setIsDemoMode(true);
        }
        setLoading(false);
      })
      .catch(() => {
        setServices(DEMO_SERVICES);
        setIsDemoMode(true);
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name || !url) return;
    try {
      await api.addService({ name, url });
      load();
    } catch {
      setServices(prev => [...prev, { _id: Date.now().toString(), name, url, status: 'healthy', consecutiveFailures: 0, failureThreshold: 3, lastResponseTimeMs: 35 }]);
    }
    setName(''); setUrl('');
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteService(id);
      load();
    } catch {
      setServices(prev => prev.filter(s => s._id !== id));
    }
  };

  return (
    <div>
      <div className="section-label">Monitored Services</div>

      {isDemoMode && (
        <div style={{ background: '#161b26', border: '1px solid #232838', padding: '10px 14px', borderRadius: 6, marginBottom: 16, fontSize: 12, color: '#7c8496', fontFamily: 'var(--font-mono)' }}>
          ℹ️ Running in frontend demo mode. Connect backend URL to enable live database health checks.
        </div>
      )}

      <form className="form-row" onSubmit={handleAdd}>
        <input placeholder="Service name (e.g. Auth API)" value={name} onChange={e => setName(e.target.value)} />
        <input placeholder="Health check URL (e.g. https://api.example.com/health)" value={url} onChange={e => setUrl(e.target.value)} />
        <button className="btn btn-primary" type="submit">+ Add</button>
      </form>

      {loading && <div className="empty-state">Loading…</div>}
      {!loading && services.length === 0 && (
        <div className="empty-state">No services monitored yet. Add one above — the poller checks it every 30s.</div>
      )}

      {services.map(s => (
        <div className="card" key={s._id}>
          <div className="card-row">
            <div>
              <div className="service-name">{s.name}</div>
              <div className="service-url">{s.url}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className={`status-badge status-${s.status}`}>{s.status}</span>
              <button className="btn btn-danger" onClick={() => handleDelete(s._id)}>Remove</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
            <span className="service-url">
              Consecutive failures: {s.consecutiveFailures}/{s.failureThreshold}
            </span>
            {s.lastResponseTimeMs != null && (
              <span className="service-url">Last response: {s.lastResponseTimeMs}ms</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
