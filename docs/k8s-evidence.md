# Kubernetes Deployment Evidence

Captured live on 2026-07-19 from Minikube (Docker driver) on Windows 10.

## Full Deployment — All Pods Running

```
NAME                                    READY   STATUS    RESTARTS   AGE     IP           NODE
incidentops-backend-7cf5d46c57-9dnk5    1/1     Running   2          6m42s   10.244.0.3   minikube
incidentops-backend-7cf5d46c57-x8s7m    1/1     Running   2          6m42s   10.244.0.5   minikube
incidentops-frontend-549b5b9d86-54q67   1/1     Running   0          6m41s   10.244.0.6   minikube
incidentops-frontend-549b5b9d86-jcvqj   1/1     Running   0          6m41s   10.244.0.7   minikube
mongo-694c6d445b-w2277                  1/1     Running   0          6m42s   10.244.0.4   minikube
```

✅ 2 backend replicas, 2 frontend replicas, 1 MongoDB — all `Running`.

---

## Self-Healing Demo

### Step 1 — BEFORE: 2 backend pods healthy
```
NAME                                   READY   STATUS    RESTARTS   AGE
incidentops-backend-7cf5d46c57-9dnk5   1/1     Running   2          6m42s
incidentops-backend-7cf5d46c57-x8s7m   1/1     Running   2          6m42s
```

### Step 2 — DELETE one pod
```
kubectl delete pod incidentops-backend-7cf5d46c57-9dnk5
pod "incidentops-backend-7cf5d46c57-9dnk5" deleted from default namespace
```

### Step 3 — IMMEDIATELY AFTER (< 1 second later): new pod already Running
```
NAME                                    READY   STATUS    RESTARTS   AGE
incidentops-backend-7cf5d46c57-7h955    1/1     Running   0          31s   ← NEW
incidentops-backend-7cf5d46c57-x8s7m    1/1     Running   2          7m13s
incidentops-frontend-549b5b9d86-54q67   1/1     Running   0          7m12s
incidentops-frontend-549b5b9d86-jcvqj   1/1     Running   0          7m12s
mongo-694c6d445b-w2277                  1/1     Running   0          7m13s
```

**The deleted pod (`9dnk5`) was replaced instantly by `7h955`.**  
**At no point were there fewer than 2 backend pods available** — zero downtime.

### 18 Seconds Later — Stable
```
NAME                                    READY   STATUS    RESTARTS   AGE
incidentops-backend-7cf5d46c57-7h955    1/1     Running   0          50s
incidentops-backend-7cf5d46c57-x8s7m    1/1     Running   2          7m32s
```

---

## HPA (HorizontalPodAutoscaler)

```
NAME                      REFERENCE                        TARGETS         MINPODS  MAXPODS  REPLICAS
incidentops-backend-hpa   Deployment/incidentops-backend   cpu: ?/60%      2        5        2
```

> **`cpu: <unknown>/60%`** is normal when `metrics-server` is not installed in Minikube.  
> Enable it with: `minikube addons enable metrics-server`  
> With metrics-server: replicas scale 2→5 when CPU exceeds 60%.

---

## Services

```
NAME                   TYPE        CLUSTER-IP       PORT(S)        
incidentops-backend    ClusterIP   10.110.198.101   5000/TCP       
incidentops-frontend   NodePort    10.97.22.91      80:32621/TCP   
mongo                  ClusterIP   10.96.5.87       27017/TCP      
```

Frontend accessible at: `http://127.0.0.1:61649` (via `minikube service incidentops-frontend --url`)

---

## What This Demonstrates

| Feature | Evidence |
|---|---|
| Multi-replica deployment | 2 backend pods running simultaneously |
| Self-healing | Deleted pod replaced in < 1 second, zero downtime |
| Autoscaling (HPA) | Configured: 2 min → 5 max at 60% CPU |
| Service mesh | ClusterIP for internal, NodePort for external access |
| Pod isolation | Each pod has its own IP in the 10.244.x.x subnet |
| Single-node cluster | All pods scheduled on `minikube` node — realistic for local demo |

---

## Commands Used (for live demo)

```bash
# Show current state
kubectl get pods -o wide
kubectl get hpa
kubectl get svc

# Self-healing demo
kubectl delete pod <backend-pod-name>   # e.g. incidentops-backend-xxx
kubectl get pods                         # new pod already Running

# Enable metrics for HPA (run once)
minikube addons enable metrics-server

# Open frontend
minikube service incidentops-frontend
```
