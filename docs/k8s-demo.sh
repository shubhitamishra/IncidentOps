#!/usr/bin/env bash
# IncidentOps — Kubernetes Demo Helper Script
# Run this during your presentation for the self-healing and HPA demos.
# Usage: bash docs/k8s-demo.sh [selfheal|hpa|status|all]

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log()  { echo -e "${CYAN}[demo]${NC} $1"; }
note() { echo -e "${YELLOW}[NOTE]${NC} $1"; }
ok()   { echo -e "${GREEN}[OK]${NC}   $1"; }

# ─── Prerequisite checks ────────────────────────────────────────────────────
check_prereqs() {
  command -v kubectl >/dev/null 2>&1 || { echo "kubectl not found. Is Minikube running?"; exit 1; }
  command -v minikube >/dev/null 2>&1 || { echo "minikube not found."; exit 1; }
  minikube status | grep -q "Running" || { echo "Minikube is not running. Run: minikube start"; exit 1; }
}

# ─── Show current pod status ────────────────────────────────────────────────
show_status() {
  log "Current pod status:"
  kubectl get pods -o wide
  echo ""
  log "Services:"
  kubectl get svc
  echo ""
  log "HPA:"
  kubectl get hpa
}

# ─── Self-healing demo ──────────────────────────────────────────────────────
demo_selfheal() {
  log "=== SELF-HEALING DEMO ==="
  echo ""

  log "Step 1 — Current pods (2 backend replicas):"
  kubectl get pods
  echo ""

  BACKEND_POD=$(kubectl get pods -l app=incidentops-backend -o jsonpath='{.items[0].metadata.name}')
  log "Step 2 — Deleting pod: $BACKEND_POD"
  note "The dashboard stays reachable throughout because the second replica handles traffic."
  kubectl delete pod "$BACKEND_POD"
  echo ""

  log "Step 3 — Watching pod recreation (Ctrl+C to stop):"
  note "Watch for the Terminating pod disappear and a new one appear with status ContainerCreating → Running"
  kubectl get pods -w &
  WATCH_PID=$!
  sleep 15
  kill $WATCH_PID 2>/dev/null || true
  echo ""

  log "Step 4 — Final state (should be back to 2 running backend pods):"
  kubectl get pods
  ok "Self-healing demo complete. Kubernetes recreated the pod automatically."
}

# ─── HPA demo ───────────────────────────────────────────────────────────────
demo_hpa() {
  log "=== HPA SCALING DEMO ==="
  echo ""

  log "Current HPA state:"
  kubectl get hpa
  echo ""

  note "HPA scales 2 → 5 replicas when CPU utilization exceeds 60%."
  note "To trigger scaling, run load against the backend:"
  echo ""
  echo "  # Using hey (install: go install github.com/rakyll/hey@latest)"
  BACKEND_URL=$(minikube service incidentops-backend --url 2>/dev/null || echo "http://<backend-service-url>")
  echo "  hey -z 60s -c 50 ${BACKEND_URL}/health"
  echo ""
  echo "  # Or using Apache Bench:"
  echo "  ab -n 10000 -c 50 ${BACKEND_URL}/health"
  echo ""

  note "While load is running, watch replicas in another terminal:"
  echo "  kubectl get pods -w"
  echo "  kubectl get hpa -w"
}

# ─── Deploy (full fresh deploy to Minikube) ─────────────────────────────────
deploy() {
  log "=== DEPLOYING TO MINIKUBE ==="
  echo ""

  log "Step 1 — Pointing Docker at Minikube's registry:"
  eval $(minikube docker-env)
  echo ""

  log "Step 2 — Building images inside Minikube:"
  docker build -t incidentops-backend:latest ./backend
  docker build -t incidentops-frontend:latest ./frontend
  echo ""

  log "Step 3 — Applying Kubernetes manifests:"
  kubectl apply -f k8s/config.yaml
  kubectl apply -f k8s/mongo-deployment.yaml
  kubectl apply -f k8s/backend-deployment.yaml
  kubectl apply -f k8s/frontend-deployment.yaml
  kubectl apply -f k8s/hpa.yaml
  echo ""

  log "Step 4 — Waiting for pods to be ready..."
  kubectl rollout status deployment/incidentops-backend --timeout=90s
  kubectl rollout status deployment/incidentops-frontend --timeout=60s
  echo ""

  ok "Deployment complete."
  log "Opening frontend in browser:"
  minikube service incidentops-frontend
}

# ─── Main ───────────────────────────────────────────────────────────────────
check_prereqs

case "${1:-status}" in
  selfheal) demo_selfheal ;;
  hpa)      demo_hpa ;;
  deploy)   deploy ;;
  status)   show_status ;;
  all)
    show_status
    echo "---"
    demo_selfheal
    echo "---"
    demo_hpa
    ;;
  *)
    echo "Usage: bash docs/k8s-demo.sh [status|selfheal|hpa|deploy|all]"
    exit 1
    ;;
esac
