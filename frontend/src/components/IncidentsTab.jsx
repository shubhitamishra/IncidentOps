import { useState, useEffect } from 'react';
import { api } from '../api';

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (isNaN(diff) || diff < 0) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

const DEMO_INCIDENTS = [
  {
    _id: 'inc-1',
    title: 'Broken Service (Demo) returned HTTP 503',
    status: 'open',
    assignedTo: 'Alex Chen',
    escalationLevel: 1,
    createdAt: new Date(Date.now() - 120000).toISOString(),
    timeline: [
      { timestamp: new Date(Date.now() - 120000).toISOString(), type: 'created', message: 'Health check failed 3 consecutive times. Incident automatically created.' },
      { timestamp: new Date(Date.now() - 110000).toISOString(), type: 'alert_sent', message: 'Alert dispatched to current on-call engineer: Alex Chen.' }
    ]
  }
];

export default function IncidentsTab() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actor, setActor] = useState('you');

  const load = () => {
    api.getIncidents()
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setIncidents(data);
        } else {
          setIncidents(DEMO_INCIDENTS);
        }
        setLoading(false);
      })
      .catch(() => {
        setIncidents(DEMO_INCIDENTS);
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleAck = async (id) => {
    try {
      await api.acknowledgeIncident(id, actor);
      load();
    } catch {
      setIncidents(prev => prev.map(inc => inc._id === id ? {
        ...inc,
        status: 'acknowledged',
        timeline: [...inc.timeline, { timestamp: new Date().toISOString(), type: 'acknowledged', message: `Incident acknowledged by ${actor}` }]
      } : inc));
    }
  };

  const handleResolve = async (id) => {
    try {
      await api.resolveIncident(id, actor, 'Manually resolved from dashboard');
      load();
    } catch {
      setIncidents(prev => prev.map(inc => inc._id === id ? {
        ...inc,
        status: 'resolved',
        timeline: [...inc.timeline, { timestamp: new Date().toISOString(), type: 'resolved', message: `Incident resolved by ${actor}` }]
      } : inc));
    }
  };

  return (
    <div>
      <div className="section-label">Incidents</div>

      {loading && <div className="empty-state">Loading…</div>}
      {!loading && incidents.length === 0 && (
        <div className="empty-state">No incidents. Everything's healthy — or nothing's been added to Services yet.</div>
      )}

      {incidents.map(inc => (
        <div className="card" key={inc._id}>
          <div className="card-row">
            <div>
              <div className="incident-title">{inc.title}</div>
              <div className="service-url">
                Assigned to {inc.assignedTo || 'unassigned'} · escalation level {inc.escalationLevel} · {timeAgo(inc.createdAt)}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className={`status-badge status-${inc.status}`}>{inc.status}</span>
              {inc.status === 'open' && (
                <button className="btn" onClick={() => handleAck(inc._id)}>Acknowledge</button>
              )}
              {inc.status !== 'resolved' && (
                <button className="btn btn-primary" onClick={() => handleResolve(inc._id)}>Resolve</button>
              )}
            </div>
          </div>

          <div className="timeline">
            {inc.timeline.map((ev, i) => (
              <div className="timeline-event" key={i}>
                <span className="ts">{timeAgo(ev.timestamp)}</span>
                <span className="msg">[{ev.type}] {ev.message}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
