# IncidentOps

[![CI — Build & Smoke Test](https://github.com/shubhitamishra/IncidentOps/actions/workflows/ci.yml/badge.svg)](https://github.com/shubhitamishra/IncidentOps/actions/workflows/ci.yml)
[![Vercel Live Demo](https://img.shields.io/badge/Vercel-Live%20Demo-000000?logo=vercel&logoColor=white)](https://incident-ops-one.vercel.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)](docker-compose.yml)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-HPA%20%2B%20self--healing-326CE5?logo=kubernetes&logoColor=white)](k8s/)
[![Node](https://img.shields.io/badge/Node.js-20-339933?logo=node.js&logoColor=white)](backend/package.json)

A cloud-native Incident Management and On-Call Alerting Platform designed for high-availability production environments. IncidentOps automates service health monitoring, multi-channel alerting (AWS SNS), automated incident escalation, and immutable audit logging (IBM Cloudant), while demonstrating enterprise-grade Kubernetes orchestration (self-healing, HPA, and liveness probes).

> 🌐 **Live Demo:** Explore the operational dashboard in frontend demo mode at [incident-ops-one.vercel.app](https://incident-ops-one.vercel.app).

---

## 📌 Overview & Problem Statement

When production services fail, engineering teams need immediate notification, clear accountability via on-call rotations, and a complete historical record for postmortems. 

**IncidentOps** provides an end-to-end operational platform that:
- Continuously polls monitored service endpoints.
- Triggers automated incidents upon health check failures.
- Dispatches multi-channel alerts to on-call engineers.
- Escalates unacknowledged incidents deterministically.
- Maintains an immutable event timeline for auditing and postmortem analysis.

---

## ⚙️ Core Architecture & Flow

```
                    ┌─────────────────────┐
                    │   React Dashboard   │  (Services / Incidents / On-Call)
                    └──────────┬──────────┘
                               │ REST
                    ┌──────────▼──────────┐
                    │   Node/Express API  │
                    └──┬────────┬───────┬─┘
                       │        │       │
          ┌────────────▼─┐  ┌───▼────┐  ┌─▼──────────────┐
          │ Health Poller │  │MongoDB │  │ Escalation     │
          │ (node-cron)   │  │(data)  │  │ Engine         │
          └───────┬───────┘  └────────┘  └───────┬────────┘
                  │                              │
       pings monitored services         ┌────────▼────────┐
                                        │ Alert Dispatcher│
                                        └──┬────────────┬─┘
                                           │            │
                                  ┌────────▼───┐   ┌────▼──────────────┐
                                  │ AWS Lambda │   │ IBM Cloudant      │
                                  │ + SNS      │   │ (audit log mirror)│
                                  └────────────┘   └───────────────────┘

  Deployment Architecture (Kubernetes / Minikube):
  - Multi-replica Node.js backend behind ClusterIP Service
  - HorizontalPodAutoscaler (HPA) scaling 2 → 5 replicas under traffic spikes
  - Liveness & Readiness probes driving automated self-healing
```

### Event Lifecycle

1. **Automated Health Polling:** Background worker checks service endpoints on a configurable cron schedule.
2. **Incident Creation & Alerting:** Upon crossing failure thresholds, an incident is opened and dispatched via AWS Lambda + SNS (Email/SMS fanout).
3. **Escalation Engine:** Unacknowledged incidents automatically escalate to the next engineer in rotation after a designated SLA window.
4. **Immutable Audit Trail:** All state transitions (`created` → `acknowledged` → `resolved`) are mirrored asynchronously to IBM Cloudant.

---

## 🛠 Tech Stack & Engineering Rationale

| Technology | Role | Engineering Rationale |
|---|---|---|
| **Docker** | Containerization | Decouples runtime dependencies; builds isolated artifacts for React/Nginx frontend and Express backend. |
| **Kubernetes** | Orchestration | Ensures high availability for critical infrastructure via liveness/readiness probes, automated pod recreation (self-healing), and HPA. |
| **Node.js / Express** | API & Workers | Non-blocking I/O handles concurrent health-checks and REST traffic efficiently. |
| **React / Vite** | Operational Dashboard | Lightweight, real-time UI for viewing service health, acknowledging incidents, and managing rotations. |
| **AWS Lambda + SNS** | Multi-channel Alerting | Decouples notification logic from core application; SNS fanout enables simultaneous SMS/Email dispatch. |
| **IBM Cloudant** | Audit Event Mirroring | Provides document-based append-only persistence to guarantee audit history survives primary DB failures. |
| **MongoDB** | Operational Store | Fast read/write performance for dynamic state management (incidents, service statuses, rotations). |

---

## 📁 Repository Structure

```
incidentops/
├── backend/           # Express API, health poller, escalation logic & integrations
│   ├── src/
│   │   ├── models/         # MongoDB Schemas (MonitoredService, Incident, OnCallMember)
│   │   ├── routes/         # REST API endpoints
│   │   ├── services/       # On-call, alert dispatcher, and incident management services
│   │   ├── jobs/           # Health polling cron job
│   │   └── integrations/   # IBM Cloudant audit trail synchronization
│   └── Dockerfile
├── frontend/           # React (Vite) operational dashboard
│   ├── src/
│   │   ├── components/     # UI Views (Services, Incidents, On-Call)
│   │   └── api.js          # REST client integration
│   ├── nginx.conf          # Nginx reverse proxy configuration
│   └── Dockerfile
├── aws/                # AWS Lambda function (SNS Alert Dispatcher) & IaC setup
├── k8s/                # Kubernetes manifests (Deployments, Services, HPA, ConfigMaps)
├── docs/               # Architecture notes & Kubernetes demonstration scripts
└── docker-compose.yml  # Local multi-container development environment
```

---

## 🚀 Quickstart — Running Locally with Docker Compose

### Prerequisites
- Docker & Docker Compose installed

### 1. Clone & Configure
```bash
git clone https://github.com/shubhitamishra/IncidentOps.git
cd IncidentOps
cp backend/.env.example backend/.env
```

### 2. Launch the Stack
```bash
docker compose up --build -d
```

### 3. Seed Initial Demo Data
```bash
docker exec -it incidentops-backend node src/seed.js
```

### Access Points:
- **Operational Dashboard:** `http://localhost:8080`
- **Backend API:** `http://localhost:5000`
- **Health Check Endpoint:** `http://localhost:5000/health`

*Note: The seeded "Broken Service" will simulate health check failures and trigger an incident within ~90 seconds.*

---

## ☸️ Kubernetes Deployment & Resilience Features

### Deployment Manifests
Apply the cluster configuration in `k8s/`:
```bash
minikube start
eval $(minikube docker-env)

docker build -t incidentops-backend:latest ./backend
docker build -t incidentops-frontend:latest ./frontend

kubectl apply -f k8s/config.yaml
kubectl apply -f k8s/mongo-deployment.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/hpa.yaml
```

### Self-Healing Demonstration
Test Kubernetes controller recovery by terminating an active pod:
```bash
# Delete a backend replica
kubectl delete pod -l app=incidentops-backend

# Watch the ReplicaSet controller spawn a replacement pod in < 5 seconds
kubectl get pods -w
```

### Horizontal Pod Autoscaling (HPA)
```bash
# Monitor HPA status
kubectl get hpa

# Generate synthetic CPU load to trigger autoscaling (2 → 5 replicas)
hey -z 60s -c 50 $(minikube service incidentops-backend --url)/health
```

---

## 📡 REST API Documentation

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Server health check endpoint (used by K8s probes) |
| `GET` | `/api/services` | Retrieve list of monitored services and status |
| `POST` | `/api/services` | Register a new endpoint for health monitoring |
| `DELETE` | `/api/services/:id` | Remove a monitored service |
| `GET` | `/api/incidents` | List incidents (filter by `status=open\|acknowledged\|resolved`) |
| `GET` | `/api/incidents/:id` | Get detailed incident report with complete audit timeline |
| `POST` | `/api/incidents/:id/acknowledge` | Acknowledge incident ownership `{ actor: "Name" }` |
| `POST` | `/api/incidents/:id/resolve` | Resolve incident `{ actor: "Name", note: "Resolution details" }` |
| `GET` | `/api/oncall/current` | Get current active on-call engineer |
| `POST` | `/api/oncall` | Add an engineer to the rotation list |

---

## 🌩️ Cloud Integrations

### AWS Lambda + SNS Alert Fanout
1. Provisions AWS SNS topic (`incidentops-alerts`) with Email/SMS subscribers.
2. Lambda function [`aws/snsAlertLambda.js`](aws/snsAlertLambda.js) formats payload and triggers SNS publish.
3. Configured via `AWS_LAMBDA_ALERT_URL` in `backend/.env`.

### IBM Cloudant Audit Trail
- Asynchronously mirrors incident creation, acknowledgment, and resolution timeline events to IBM Cloudant (`incident_audit_log` database).
- Fails safe if credentials are not configured, maintaining operational capability in standalone mode.

---

## 💡 Architecture Decisions & Design Trade-offs

- **SNS Alert Fanout vs Direct SMTP:** SNS decouples notification channels from backend business logic. Adding future channels (e.g. Slack/PagerDuty webhooks) requires adding SNS subscribers without altering core application code.
- **Dual Persistence (MongoDB + Cloudant):** MongoDB serves as the operational transactional database for rapid state updates. Cloudant acts as an append-only log store to ensure audit history integrity even during operational database maintenance or downtime.
- **Deterministic On-Call Rotation:** Computes active engineer based on epoch week indices (`epochWeek % activeMemberCount`), eliminating the need for complex stateful scheduling algorithms or external dependencies.
- **In-Memory Escalation Timers:** Uses NodeJS timers for lightweight escalation handling. *(In large-scale enterprise deployments, this would be backed by a distributed delay queue like AWS SQS or Redis Celery to handle node crashes during escalation windows).*

---

## 🗺️ Roadmap & Future Enhancements

- [ ] Slack & Microsoft Teams Webhook Integrations via SNS.
- [ ] Incident Deduplication Engine (collapsing repetitive health check failures into single incident streams).
- [ ] Distributed Queue (AWS SQS) backing for escalation SLA timers.
- [ ] Automated SLA & Uptime percentage reporting metrics per service.

---

## 📜 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
