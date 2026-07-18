# IncidentOps

[![CI — Build & Smoke Test](https://github.com/shubhitamishra/IncidentOps/actions/workflows/ci.yml/badge.svg)](https://github.com/shubhitamishra/IncidentOps/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)](docker-compose.yml)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-HPA%20%2B%20self--healing-326CE5?logo=kubernetes&logoColor=white)](k8s/)
[![Node](https://img.shields.io/badge/Node.js-20-339933?logo=node.js&logoColor=white)](backend/package.json)

A mini incident management and on-call alerting system — the kind of tool
that sits behind every production engineering team (a scoped-down
PagerDuty). Built to demonstrate cloud-native deployment practices:
containerization, orchestration, self-healing, autoscaling, and
multi-cloud service integration (AWS + IBM Cloud).

## The problem

When a service goes down, someone needs to know immediately, someone
needs to be accountable for responding, and there needs to be a record of
what happened and when. Most student projects skip this — IncidentOps
*is* this.

## How it works

1. A background poller checks each monitored service's health endpoint
   on a schedule.
2. If a service fails enough consecutive checks, an incident is
   auto-created and the current on-call engineer is alerted.
3. If the incident isn't acknowledged within a timeout, it escalates to
   the next person in the on-call rotation.
4. Every state change (created → acknowledged → resolved) is logged to a
   timeline, giving a full postmortem record.

## Architecture

```
                    ┌─────────────────────┐
                    │   React Dashboard    │  (services / incidents / on-call)
                    └──────────┬───────────┘
                               │ REST
                    ┌──────────▼───────────┐
                    │   Node/Express API    │
                    └──┬────────┬───────┬──┘
                       │        │       │
          ┌────────────▼─┐  ┌───▼────┐  ┌─▼──────────────┐
          │ Health Poller │  │MongoDB │  │ Escalation      │
          │ (node-cron)   │  │(data)  │  │ Engine          │
          └───────┬───────┘  └────────┘  └───────┬─────────┘
                  │                                │
       pings monitored services          ┌─────────▼─────────┐
                                          │  Alert Dispatcher  │
                                          └──┬──────────────┬─┘
                                             │              │
                                   ┌─────────▼───┐   ┌──────▼────────────┐
                                   │ AWS Lambda  │   │ IBM Cloudant       │
                                   │ + SNS       │   │ (audit log mirror) │
                                   │ (alert      │   │                    │
                                   │  fanout)    │   └────────────────────┘
                                   └─────────────┘

  Deployment: Docker containers → Kubernetes (Minikube)
  - 2 backend replicas behind a ClusterIP Service
  - HorizontalPodAutoscaler scales 2→5 replicas under load
  - Liveness/readiness probes drive self-healing
```

## Why each technology is used (not just checkbox compliance)

| Technology | Why it's actually needed here |
|---|---|
| **Docker** | Backend and frontend have different runtimes (Node vs. Nginx-served static build); containerizing each lets them scale and deploy independently. |
| **Kubernetes** | The whole point of an incident tool is *it can't be the thing that's down*. K8s liveness probes + multiple replicas mean the tool self-heals — directly relevant to its own purpose, not a forced requirement. |
| **AWS Lambda + SNS** | SNS is built for multi-channel fanout (email + SMS from one publish call) — exactly what alerting needs, instead of hardcoding one notification channel. |
| **IBM Cloudant** | Append-only incident timeline events are naturally document-shaped. Mirroring them to a separate managed store means the audit trail survives even if the primary DB has an issue — genuine resilience reasoning. |
| **node-cron** | Deterministic, explainable polling — no external scheduler needed for this scale. |

## Project structure

```
incidentops/
├── backend/           # Node/Express API + health poller + escalation engine
│   ├── src/
│   │   ├── models/         # MonitoredService, Incident, OnCallMember
│   │   ├── routes/         # REST endpoints (/api/services, /api/incidents, /api/oncall)
│   │   ├── services/       # onCallService, alertService (email + AWS Lambda/SNS), incidentService
│   │   ├── jobs/           # healthPoller (node-cron, runs every 30s)
│   │   └── integrations/   # cloudantAudit.js (IBM Cloudant mirror)
│   ├── .env.example        # Copy to .env and fill in credentials
│   └── Dockerfile
├── frontend/           # React (Vite) dashboard → served by Nginx
│   ├── src/
│   │   ├── components/     # ServicesTab, IncidentsTab, OnCallTab
│   │   └── api.js          # Axios client for all backend calls
│   ├── nginx.conf          # Proxies /api/ to backend; SPA routing
│   └── Dockerfile
├── aws/                # Lambda function (snsAlertLambda.js) + deployment README
├── k8s/                # Kubernetes manifests (Deployment, Service, HPA, ConfigMap)
├── docs/               # Presentation notes + K8s demo helper script
└── docker-compose.yml  # Local dev — spins up mongo + backend + frontend
```

## Screenshots

### Dashboard — Services Tab
> The Services tab shows all monitored endpoints with live status, response times, and consecutive failure counts.
> Add the seeded "Broken Service (demo)" to watch it go from `healthy` → `degraded` → `down` as the poller detects failures.

### Dashboard — Incidents Tab
> Auto-created incidents appear here when a service crosses its failure threshold.
> Each incident shows: severity badge, assigned on-call member, escalation level, and full timeline.

### Dashboard — On-Call Tab
> Shows the full rotation order. The currently on-call member is highlighted.
> Rotation is deterministic: `epochWeek % activeMembers` — no manual schedule needed.

*(Screenshots: run the stack, navigate to http://localhost:8080, and capture each tab for your presentation slides.)*

## Running locally

```bash
# 1. Copy env template and fill in what you have (safe to leave blank for demo mode)
cp backend/.env.example backend/.env

# 2. Start everything (MongoDB healthcheck ensures Mongo is ready before backend starts)
docker compose up --build

# 3. Seed demo data (on-call rotation + 3 monitored services including a failing one)
docker exec -it incidentops-backend node src/seed.js
```

**Dashboard:** http://localhost:8080  
**API:** http://localhost:5000  
**API health:** http://localhost:5000/health

The seeded "Broken Service (demo — always 503)" will auto-create an incident after
approximately 90 seconds (3 consecutive 30-second check failures).

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Server health check (used by K8s liveness probe) |
| `GET` | `/api/services` | List all monitored services |
| `POST` | `/api/services` | Add a monitored service |
| `DELETE` | `/api/services/:id` | Remove a monitored service |
| `GET` | `/api/incidents` | List incidents (optional `?status=open\|acknowledged\|resolved`) |
| `GET` | `/api/incidents/:id` | Get a single incident with full timeline |
| `POST` | `/api/incidents/:id/acknowledge` | Acknowledge an incident `{ actor: "name" }` |
| `POST` | `/api/incidents/:id/resolve` | Resolve an incident `{ actor: "name", note: "..." }` |
| `GET` | `/api/oncall` | List all on-call members |
| `GET` | `/api/oncall/current` | Get the current on-call member |
| `POST` | `/api/oncall` | Add a member to the rotation |

## Deploying to Kubernetes (Minikube)

```bash
# 1. Start Minikube
minikube start

# 2. Point Docker at Minikube's internal registry
eval $(minikube docker-env)

# 3. Build images directly into Minikube's registry
docker build -t incidentops-backend:latest ./backend
docker build -t incidentops-frontend:latest ./frontend

# 4. Apply all manifests
kubectl apply -f k8s/config.yaml
kubectl apply -f k8s/mongo-deployment.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/hpa.yaml

# 5. Open the frontend
minikube service incidentops-frontend
```

### Self-healing demo (delete a pod, watch K8s recreate it)

```bash
kubectl get pods                          # note a backend pod name
kubectl delete pod <backend-pod-name>     # delete one replica
kubectl get pods -w                       # watch it recreate within ~5 seconds
```

The dashboard stays reachable throughout because the second replica handles traffic.

### HPA demo

```bash
kubectl get hpa                           # shows current CPU utilization and replica count

# Generate load (replicas will scale 2→5 when CPU exceeds 60%)
hey -z 60s -c 50 $(minikube service incidentops-backend --url)/health

kubectl get pods -w                       # watch new replicas appear
```

Or use the included helper script:

```bash
bash docs/k8s-demo.sh status     # show current state
bash docs/k8s-demo.sh selfheal   # automated self-healing demo
bash docs/k8s-demo.sh hpa        # HPA instructions + load commands
```

## AWS Lambda + SNS Integration

See [`aws/README.md`](aws/README.md) for full setup. Summary:

1. Create an SNS topic: `aws sns create-topic --name incidentops-alerts`
2. Subscribe your email: `aws sns subscribe --topic-arn <arn> --protocol email --notification-endpoint you@example.com`
3. Deploy `aws/snsAlertLambda.js` as a Lambda function (Node 20.x)
4. Attach an API Gateway HTTP trigger to the Lambda
5. Set `AWS_LAMBDA_ALERT_URL=<api-gateway-url>` in `backend/.env`

When an incident fires, the backend now dispatches alerts through two parallel channels:
- **Email** (via SMTP/nodemailer, if configured)
- **AWS SNS fanout** (via Lambda, if `AWS_LAMBDA_ALERT_URL` is set)

Backend logs will show:
```
[ALERT] -> oncall@example.com | 🚨 Incident: Service is down
[ALERT] email: delivered ✓
[ALERT] awsSns: delivered ✓
```

## IBM Cloudant Integration

Set in `backend/.env`:
```
IBM_CLOUDANT_URL=https://<instance>.cloudantnosqldb.appdomain.cloud
IBM_CLOUDANT_APIKEY=<your-api-key>
```

The backend automatically creates the `incident_audit_log` database and mirrors
every timeline event (created / acknowledged / resolved) to it. If credentials
are not set, the integration no-ops safely — the app works fine in demo mode.

## Live demo script (for your presentation)

See [`docs/presentation-notes.md`](docs/presentation-notes.md) for the full rehearsal-ready script.

Quick sequence:
1. Show the working dashboard at http://localhost:8080
2. Point to "Broken Service" — watch the incident auto-create (~90s)
3. Acknowledge the incident; show timeline updates
4. Run the K8s self-healing demo (`kubectl delete pod`)
5. Show `kubectl get hpa`; explain autoscaling
6. Close with the audit trail timeline

## Anticipated Q&A — answers you should know cold

- **"Why not just use email/SMS directly instead of SNS?"** — SNS
  decouples the backend from delivery channels. Adding Slack or a new
  channel later means adding an SNS subscription, not changing backend
  code.
- **"Why Cloudant and not just MongoDB for everything?"** — Separation of
  concerns: MongoDB is the operational store (things change: status,
  assignment), Cloudant holds an immutable audit trail. If MongoDB has
  an issue, the incident *history* is still safe elsewhere.
- **"How does escalation actually work?"** — `setTimeout`-based check
  after `ESCALATION_TIMEOUT_MINUTES`; if the incident is still `open`
  (not acknowledged), it reassigns to the next person in
  `rotationOrder` and re-alerts. In production this would be a durable
  job queue (e.g. AWS SQS + delay queues) instead of an in-memory timer,
  since a server restart would lose pending timers — worth mentioning
  proactively as a known limitation.
- **"How does the on-call rotation get computed?"** — deterministic
  weekly rotation: `epochWeek % activeMemberCount`. No manual schedule
  entry needed, no single point of failure in "who's on call."
- **"What happens if two incidents fire for the same service at once?"**
  — Currently each failed health-check-threshold event creates a new
  incident; a real system would dedupe by open incidents per service.
  Good to flag as a "next iteration" if asked — shows awareness.

## Future scope (mention in presentation to show industry thinking)

- Slack/Teams webhook integration via the same SNS topic
- Incident severity auto-classification based on service tags
- Uptime SLA reporting per service
- Replace in-memory escalation timers with a durable queue (SQS)
- Deduplication: prevent multiple open incidents for the same service

## License

MIT
