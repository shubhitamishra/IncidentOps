import { useState, useEffect, useCallback } from 'react';
import { api } from './api';
import ServicesTab from './components/ServicesTab';
import IncidentsTab from './components/IncidentsTab';
import OnCallTab from './components/OnCallTab';

const TABS = ['Services', 'Incidents', 'On-Call'];

export default function App() {
  const [activeTab, setActiveTab] = useState('Services');
  const [currentOnCall, setCurrentOnCall] = useState({ name: 'Alex Chen' });

  const refreshOnCall = useCallback(() => {
    api.getCurrentOnCall()
      .then(data => {
        if (data && data.name) setCurrentOnCall(data);
        else setCurrentOnCall({ name: 'Alex Chen' });
      })
      .catch(() => setCurrentOnCall({ name: 'Alex Chen' }));
  }, []);

  useEffect(() => {
    refreshOnCall();
    const interval = setInterval(refreshOnCall, 30000);
    return () => clearInterval(interval);
  }, [refreshOnCall]);

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <h1>◆ IncidentOps</h1>
          <span className="tagline">mini incident management &amp; on-call alerting</span>
        </div>
        <div className="oncall-pill">
          <span className="dot" />
          {currentOnCall ? `On-call: ${currentOnCall.name}` : 'No on-call configured'}
        </div>
      </div>

      <div className="tabs">
        {TABS.map(tab => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Services' && <ServicesTab />}
      {activeTab === 'Incidents' && <IncidentsTab />}
      {activeTab === 'On-Call' && <OnCallTab onChange={refreshOnCall} />}
    </div>
  );
}
