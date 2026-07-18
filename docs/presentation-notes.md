# IncidentOps — Presentation Speaker Notes
### 10–12 Minute Delivery Guide

---

## SLIDE 1 — Problem Statement (~90 seconds)

**What to say:**

> "Every engineering team that runs a production service has the same problem: something breaks at 2 a.m., nobody knows about it immediately, nobody knows who's supposed to fix it, and by the time someone does respond, there's no record of what happened or how long it took. Tools like PagerDuty solve this — but they cost thousands of dollars a month and are built for teams of hundreds.
>
> IncidentOps is a scoped-down version of exactly that: a system that automatically detects when a service goes down, immediately alerts whoever is on-call, escalates if they don't respond, and keeps a full timestamped audit trail of every state change.
>
> More importantly for this presentation — it's built to demonstrate every cloud-native deployment pattern the industry actually uses: containers, orchestration, self-healing, autoscaling, and multi-cloud integrations. Not as checkboxes. As things that genuinely make the system better at its own job."

**Transition:** "Let me walk you through the architecture."

---

## SLIDE 2 — Architecture (~2 minutes)

**Reference the diagram in README.md. Walk through each layer:**

> "The frontend is a React dashboard served by Nginx. It talks to a Node/Express REST API.
>
> The API has three background engines running inside it. First: a health poller — a cron job that hits each monitored service's health endpoint every 30 seconds. When a service fails enough consecutive checks, it crosses a threshold and the second engine fires: incident creation. An incident document is written to MongoDB, the current on-call engineer is identified via the rotation, and they're alerted.
>
> The third engine is the escalation timer. If the incident isn't acknowledged within a configurable timeout, it automatically reassigns to the next person in the rotation and alerts them. This keeps running until someone takes ownership.
>
> Every state change — created, alerted, escalated, acknowledged, resolved — is written to a timeline inside MongoDB AND mirrored to IBM Cloudant as an immutable audit record. When an incident fires, the alert is dispatched through two channels simultaneously: directly via SMTP, and through an AWS Lambda that publishes to an SNS topic — enabling email, SMS, and Slack from a single publish call."

---

## SLIDE 3 — Why Each Technology (~2.5 minutes)

**Key: for each one, answer "why not just use X instead?"**

**Docker:**
> "Backend and frontend have different runtimes — Node.js for the API, Nginx serving static files for the frontend. Containerizing each one means they can be built, deployed, and scaled completely independently. No shared runtime conflicts, no 'works on my machine' problems. This isn't Docker-for-the-sake-of-Docker — the project genuinely has two different processes that need to run in isolation."

**Kubernetes:**
> "An incident management tool has a specific irony built into it: it absolutely cannot be the thing that's down. Kubernetes with liveness and readiness probes means if the backend crashes, it's automatically restarted without human intervention — the tool self-heals, which is directly relevant to its own purpose. Running two replicas means one pod can die and the dashboard stays reachable the whole time. I'll show this live."

**AWS Lambda + SNS:**
> "The alternative is just sending email directly from the backend — which means hardcoding one notification channel. SNS decouples the backend from delivery entirely. One `publish()` call fans out to every subscriber: email, SMS, and — if you add a Slack webhook subscription — Slack. Adding a new channel later means adding an SNS subscription, not changing any backend code. That's the actual architectural win."

**IBM Cloudant:**
> "MongoDB is the operational store — things change in it constantly: incident status, assignment, timeline events. Cloudant holds an immutable audit trail. If the MongoDB instance has an issue, the incident history is still safe in a completely separate managed store. The reason to use Cloudant specifically rather than another Postgres table is that incident timeline events are exactly the document-shaped, append-only data pattern that CouchDB-family databases are designed for — each event is a self-contained JSON document with no joins needed."

**node-cron:**
> "The health poller is a simple cron schedule — every 30 seconds, check which services are due for a check. No external job queue, no distributed scheduler, no additional infrastructure. At this scale, a deterministic in-process scheduler is transparent and sufficient, and it's easy to explain and debug. In production at scale, you'd replace this with a durable queue so pollers can be distributed across multiple workers."

---

## SLIDE 4 — Live Demo Script (~3 minutes)

> **⚠️ Run through this ONCE before the presentation. Have docker compose already running.**

### Step 1: Show the working dashboard
```
http://localhost:8080
```
> "This is the dashboard. Three tabs: Services being monitored, active Incidents, and the On-Call rotation."

### Step 2: Show on-call rotation
Click **On-Call** tab.
> "Two people in the rotation. The system uses a deterministic weekly rotation — week number modulo number of active members. No manual schedule entry needed."

### Step 3: Trigger an incident (services already seeded)
Click **Services** tab. Point to "Broken Service (demo — always 503)".
> "This service is configured to always return a 503. The poller is checking it every 30 seconds. After 3 consecutive failures — about 90 seconds — an incident auto-creates. Let's watch."

Wait ~90 seconds (or skip if already triggered), then click **Incidents** tab.
> "There it is — auto-created, assigned to the on-call member, with a full timeline. The backend logs show the alert being dispatched through both channels."

Show backend logs in a terminal:
```bash
docker logs incidentops-backend --tail 20
```
Look for lines like:
```
[POLLER] Broken Service (demo — always 503) check failed (3/3)
[POLLER] Threshold crossed — creating incident.
[ALERT] -> shubhita@example.com | 🚨 Incident: Broken Service is down
[ALERT] email: not configured — logging only (demo mode).
[ALERT] awsSns: delivered ✓    ← (if AWS Lambda is configured)
```

### Step 4: Acknowledge the incident
Click **Acknowledge** on the incident.
> "Acknowledged — the timeline updates immediately. In a real system this stops the escalation timer."

### Step 5: Self-healing demo (Kubernetes)
Switch to terminal:
```bash
kubectl get pods
# ─ should show: 2 backend pods, 1 frontend pod, 1 mongo pod

kubectl delete pod <one-backend-pod-name>
# copy a pod name from the output above

kubectl get pods -w
# Watch the Terminating → Running transition happen automatically
```
> "I just deleted one of the two backend replicas. Kubernetes detected it immediately via the liveness probe and scheduled a replacement. The dashboard stays reachable throughout because the second replica handled traffic the whole time. This took about 5 seconds."

### Step 6: HPA (autoscaler)
```bash
kubectl get hpa
```
> "The HorizontalPodAutoscaler is configured to scale from 2 to 5 replicas based on CPU utilization. If I generated load with Apache Bench or `hey`, you'd watch new pods appear automatically. This is what 'scales under load' means operationally."

### Step 7: Audit trail close
Click **Incidents** tab, open the resolved incident's timeline.
> "Created → alerted → acknowledged → resolved, all timestamped. This event log is also mirrored to IBM Cloudant, so it exists independently of this database."

---

## SLIDE 5 — Anticipated Q&A

**Q: "Why not just use email/SMS directly instead of SNS?"**
> "Because that ties the backend to exactly one notification channel. SNS decouples delivery completely — one publish call can fan out to email subscribers, SMS subscribers, and if I add a Slack webhook as an SNS HTTPS subscription, Slack too. Adding a channel later means zero code changes to the backend. That's the actual architectural argument for SNS — it's not complexity for complexity's sake."

**Q: "Why Cloudant and not just more MongoDB?"**
> "Separation of concerns. MongoDB is the operational store — things in it change constantly. Cloudant holds an immutable audit log. If MongoDB goes down or gets corrupted, the incident history is still safe in a completely separate managed service. The append-only event log pattern is also a better semantic fit for CouchDB-family databases than for a mutable document store."

**Q: "How does escalation actually work under the hood?"**
> "When an incident is created, a `setTimeout` starts. After `ESCALATION_TIMEOUT_MINUTES`, it fetches the incident from the database and checks if it's still `open` — not acknowledged. If it is, it reassigns to the next person in rotation and fires another alert. Worth noting: this is an in-memory timer, so a server restart would lose pending escalation timers. In production, you'd replace this with a durable queue like AWS SQS with delay queues so escalation survives restarts — I'm mentioning this proactively because it's a known limitation."

**Q: "How does the on-call rotation get computed?"**
> "Deterministically. `floor(currentEpochMs / weekMs) % numberOfActiveMembers`. The week number since Unix epoch modulo the number of active team members gives you an index into the sorted rotation list. No manual schedule entry, no calendar integration needed, and it's completely reproducible — you can calculate who's on call for any future week without looking anything up."

**Q: "What happens if two services fail at the same time?"**
> "Currently, each service's failure threshold crossing creates an independent incident — so yes, two simultaneous failures create two incidents. A production system would dedupe: check if there's already an open incident for a service before creating a new one. I'm aware of this and would flag it as a 'next iteration' item. It's architecturally straightforward to add but out of scope for this submission."

---

## SLIDE 6 — Future Scope (~45 seconds)

> "Four things I'd build next if this were going to production:
>
> One — Slack and Teams webhook integration via the same SNS topic. The plumbing is already there — it's just an additional subscriber.
>
> Two — replace the in-memory escalation timers with AWS SQS delay queues so escalation is durable across server restarts.
>
> Three — incident severity auto-classification based on service tags and historical failure patterns — use the existing severity field more intelligently.
>
> Four — uptime SLA reporting per service: calculate each service's availability percentage from the health check history and surface it in the dashboard."

---

## Timing Guide

| Section | Target Time |
|---|---|
| Problem Statement | 1.5 min |
| Architecture | 2 min |
| Technology Choices | 2.5 min |
| Live Demo | 3 min |
| Q&A (if asked) | 2 min |
| Future Scope | 0.5 min |
| **Total** | **~11.5 min** |

---

## Pre-Presentation Checklist

- [ ] `docker compose up --build` running, all 3 containers healthy
- [ ] `docker exec -it incidentops-backend node src/seed.js` — seed data loaded
- [ ] Waited at least 90s — "Broken Service" incident auto-created and visible
- [ ] Browser open at `http://localhost:8080`
- [ ] Terminal open ready for `kubectl` commands (if doing K8s demo)
- [ ] Backend logs tail ready: `docker logs incidentops-backend -f`
- [ ] `kubectl get pods` screenshot saved for slides
- [ ] `kubectl get hpa` screenshot saved for slides
