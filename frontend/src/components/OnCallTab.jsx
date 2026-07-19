import { useState, useEffect } from 'react';
import { api } from '../api';

const DEMO_MEMBERS = [
  { _id: 'm-1', name: 'Alex Chen', email: 'alex.chen@example.com', rotationOrder: 0 },
  { _id: 'm-2', name: 'Sam Taylor', email: 'sam.taylor@example.com', rotationOrder: 1 }
];

export default function OnCallTab({ onChange }) {
  const [members, setMembers] = useState([]);
  const [current, setCurrent] = useState(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const load = () => {
    api.getOnCall()
      .then(data => {
        if (Array.isArray(data) && data.length > 0) setMembers(data);
        else setMembers(DEMO_MEMBERS);
      })
      .catch(() => setMembers(DEMO_MEMBERS));

    api.getCurrentOnCall()
      .then(data => {
        if (data && data.name) setCurrent(data);
        else setCurrent(DEMO_MEMBERS[0]);
      })
      .catch(() => setCurrent(DEMO_MEMBERS[0]));
  };

  useEffect(load, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name || !email) return;
    const rotationOrder = members.length;
    try {
      await api.addOnCallMember({ name, email, rotationOrder });
      load();
    } catch {
      setMembers(prev => [...prev, { _id: Date.now().toString(), name, email, rotationOrder }]);
    }
    setName(''); setEmail('');
    onChange?.();
  };

  return (
    <div>
      <div className="section-label">On-Call Rotation</div>

      <form className="form-row" onSubmit={handleAdd}>
        <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
        <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <button className="btn btn-primary" type="submit">+ Add to rotation</button>
      </form>

      {members.length === 0 && (
        <div className="empty-state">No team members yet. Add people to define the rotation order.</div>
      )}

      <div className="oncall-list">
        {members.map(m => (
          <div className="card" key={m._id}>
            <div className="card-row">
              <div>
                <div className="service-name">{m.name}</div>
                <div className="service-url">{m.email}</div>
              </div>
              {current && current.email === m.email && (
                <span className="status-badge status-healthy">currently on-call</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
