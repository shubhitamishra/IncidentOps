import { useState, useEffect } from 'react';
import { api } from '../api';

export default function ServicesTab() {
  const [services, setServices] = useState([]);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => api.getServices().then(data => { setServices(data); setLoading(false); });

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000); // refresh to reflect live poller results
    return () => clearInterval(interval);
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name || !url) return;
    await api.addService({ name, url });
    setName(''); setUrl('');
    load();
  };

  const handleDelete = async (id) => {
    await api.deleteService(id);
    load();
  };

  return (
    <div>
      <div className="section-label">Monitored Services</div>

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
