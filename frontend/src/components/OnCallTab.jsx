import { useState, useEffect } from 'react';
import { api } from '../api';

export default function OnCallTab({ onChange }) {
  const [members, setMembers] = useState([]);
  const [current, setCurrent] = useState(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const load = () => {
    api.getOnCall().then(setMembers);
    api.getCurrentOnCall().then(setCurrent);
  };

  useEffect(load, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name || !email) return;
    const rotationOrder = members.length;
    await api.addOnCallMember({ name, email, rotationOrder });
    setName(''); setEmail('');
    load();
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
              {current && current._id === m._id && (
                <span className="status-badge status-healthy">currently on-call</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
