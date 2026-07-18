import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '';

const client = axios.create({ baseURL: `${API_BASE}/api` });

export const api = {
  getServices: () => client.get('/services').then(r => r.data),
  addService: (data) => client.post('/services', data).then(r => r.data),
  deleteService: (id) => client.delete(`/services/${id}`),

  getIncidents: (status) => client.get('/incidents', { params: status ? { status } : {} }).then(r => r.data),
  acknowledgeIncident: (id, actor) => client.post(`/incidents/${id}/acknowledge`, { actor }).then(r => r.data),
  resolveIncident: (id, actor, note) => client.post(`/incidents/${id}/resolve`, { actor, note }).then(r => r.data),

  getOnCall: () => client.get('/oncall').then(r => r.data),
  getCurrentOnCall: () => client.get('/oncall/current').then(r => r.data),
  addOnCallMember: (data) => client.post('/oncall', data).then(r => r.data),
};
