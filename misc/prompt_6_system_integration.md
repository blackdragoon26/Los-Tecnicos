📋 PROMPT 6: System Integration & DevOps (Multi-Component Orchestration)
You are the systems architect responsible for integrating all components of the decentralized energy trading platform and ensuring seamless deployment.

SYSTEM COMPONENTS:
1. Backend API (Golang)
2. Smart Contracts (Rust/Soroban on Stellar)
3. Frontend (Next.js)
4. ESP32 Devices (C++ firmware)
5. Raspberry Pi Mesh Network (Python)
6. Databases (PostgreSQL, Redis, MongoDB)
7. MQTT Broker (Mosquitto/EMQX)

INTEGRATION ARCHITECTURE:
┌─────────────────────────────────────────────────────────────────────┐
│                          CLOUD INFRASTRUCTURE                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────┐         ┌────────────────────┐              │
│  │   LOAD BALANCER    │         │   CDN (Cloudflare) │              │
│  │   (Nginx/HAProxy)  │         │   (Static Assets)  │              │
│  └──────────┬─────────┘         └──────────┬─────────┘              │
│             │                              │                         │
│             ▼                              ▼                         │
│  ┌─────────────────────────────────────────────────┐                │
│  │           KUBERNETES CLUSTER (k8s)              │                │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐      │                │
│  │  │ Frontend │  │ Backend  │  │  MQTT    │      │                │
│  │  │ (Next.js)│  │ (Golang) │  │  Broker  │      │                │
│  │  │ Pods x3  │  │ Pods x5  │  │ Pods x2  │      │                │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘      │                │
│  │       │             │             │             │                │
│  └───────┼─────────────┼─────────────┼─────────────┘                │
│          │             │             │                              │
│          │             ▼             ▼                              │
│          │  ┌──────────────────────────────┐                        │
│          │  │   PERSISTENT STORAGE         │                        │
│          │  │  ┌──────────┐  ┌──────────┐  │                        │
│          │  │  │PostgreSQL│  │  Redis   │  │                        │
│          │  │  │ (Primary)│  │  Cache   │  │                        │
│          │  │  └──────────┘  └──────────┘  │                        │
│          │  └──────────────────────────────┘                        │
│          │                                                           │
│          ▼                                                           │
│  ┌──────────────────────┐                                            │
│  │   MONITORING STACK   │                                            │
│  │  - Prometheus        │                                            │
│  │  - Grafana           │                                            │
│  │  - Loki (Logs)       │                                            │
│  └──────────────────────┘                                            │
│                                                                      │
└──────────────────┬───────────────────────────────────────────────────┘
│
▼
┌────────────────────────────┐
│  STELLAR BLOCKCHAIN        │
│  - Horizon API             │
│  - Soroban RPC             │
│  - Smart Contracts         │
└────────────┬───────────────┘
│
┌──────────┴──────────┐
│                     │
▼                     ▼
┌───────────────┐     ┌───────────────┐
│ RASPBERRY PI  │     │   ESP32       │
│ MESH NETWORK  │◄────┤   DEVICES     │
│  (Community)  │     │  (Batteries)  │
└───────────────┘     └───────────────┘

DEPLOYMENT WORKFLOW:

PHASE 1: INFRASTRUCTURE SETUP
1. Provision Kubernetes cluster (AWS EKS / GCP GKE / DigitalOcean)
2. Setup managed PostgreSQL (AWS RDS / Google Cloud SQL)
3. Deploy Redis cluster
4. Configure MQTT broker with TLS
5. Setup monitoring stack (Prometheus + Grafana)
6. Configure DNS and SSL certificates

PHASE 2: SMART CONTRACT DEPLOYMENT
1. Deploy contracts to Stellar Testnet:
   - Energy Token Contract
   - Marketplace Contract
   - Locking Contract
   - Incentive Contract
   - Governance Contract
2. Verify all contract interactions
3. Run comprehensive test suite
4. Audit contracts (recommend third-party)
5. Deploy to Mainnet with multi-sig admin

PHASE 3: BACKEND DEPLOYMENT
1. Build Docker image for Golang backend
2. Push to container registry
3. Create Kubernetes deployment manifests:
   - Deployment (5 replicas)
   - Service (ClusterIP)
   - HorizontalPodAutoscaler (scale 3-10 pods)
   - ConfigMaps (environment variables)
   - Secrets (API keys, DB credentials)
4. Deploy to cluster
5. Configure Ingress for external access
6. Setup auto-scaling based on CPU/memory

PHASE 4: MQTT BROKER SETUP
1. Deploy EMQX cluster (3 nodes for HA)
2. Configure TLS certificates
3. Setup authentication plugin (integrate with backend)
4. Configure ACL rules:
   - ESP32 devices: publish/subscribe to specific topics
   - Backend: subscribe to all device topics
   - Raspberry Pi nodes: relay all traffic
5. Enable WebSocket support for browser clients
6. Setup monitoring and alerting

PHASE 5: FRONTEND DEPLOYMENT
1. Build Next.js app (`npm run build`)
2. Create Docker image
3. Deploy to Kubernetes
4. Configure CDN (Cloudflare) for static assets
5. Setup CI/CD pipeline (GitHub Actions):
   - Run on: push to main branch
   - Steps: Build → Test → Deploy
6. Configure environment variables:
   - NEXT_PUBLIC_API_URL
   - NEXT_PUBLIC_STELLAR_NETWORK
   - NEXT_PUBLIC_MQTT_BROKER_URL

PHASE 6: IoT DEVICE PROVISIONING
ESP32 Setup:
1. Flash firmware to devices
2. Run setup wizard (connect to WiFi)
3. Register devices with backend
4. Test MQTT connectivity
5. Verify energy monitoring
6. Deploy to field locations

Raspberry Pi Setup:
1. Flash custom image to SD cards
2. Run installation script
3. Join mesh network
4. Register with backend
5. Verify routing functionality
6. Deploy to community locations

CI/CD PIPELINE (GitHub Actions):
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Backend Tests
        run: cd backend && go test ./...
      - name: Run Frontend Tests
        run: cd frontend && npm test
      - name: Run Contract Tests
        run: cd contracts && cargo test

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Build Backend Image
        run: docker build -t energy-backend:${{ github.sha }} backend/
      - name: Build Frontend Image
        run: docker build -t energy-frontend:${{ github.sha }} frontend/
      - name: Push to Registry
        run: |
          docker push energy-backend:${{ github.sha }}
          docker push energy-frontend:${{ github.sha }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/backend backend=energy-backend:${{ github.sha }}
          kubectl set image deployment/frontend frontend=energy-frontend:${{ github.sha }}
          kubectl rollout status deployment/backend
          kubectl rollout status deployment/frontend
```

MONITORING & ALERTING:

Prometheus Metrics to Track:
- API request latency (p50, p95, p99)
- Order matching time
- MQTT message throughput
- ESP32 device online count
- Raspberry Pi node count
- Blockchain transaction success rate
- Database query performance
- Cache hit ratio

Grafana Dashboards:
1. System Overview (requests/sec, errors, latency)
2. Blockchain Metrics (transactions, gas usage)
3. IoT Device Health (online devices, battery levels)
4. Network Topology (Raspberry Pi connections)
5. Business Metrics (energy traded, user growth)

Alerts (PagerDuty/Slack):
- API error rate >1%
- Database connection pool exhausted
- MQTT broker disconnections
- Smart contract transaction failures
- More than 5 ESP32 devices offline
- Raspberry Pi network partition detected

SECURITY CHECKLIST:
□ TLS/SSL for all external communication
□ API rate limiting (100 requests/min per IP)
□ Database encryption at rest
□ Regular security scans (Snyk, Trivy)
□ DDoS protection (Cloudflare)
□ Web Application Firewall (WAF)
□ Secrets stored in Kubernetes Secrets
□ Container image scanning
□ Network policies (k8s NetworkPolicy)
□ Regular backups (PostgreSQL, Redis)

DISASTER RECOVERY PLAN:
- Automated daily backups of PostgreSQL
- Point-in-time recovery capability
- Multi-region deployment (future)
- Smart contract upgrade mechanism
- Graceful degradation if blockchain unavailable
- MQTT message queue persistence
- Raspberry Pi offline mode (store-and-forward)

SCALABILITY TARGETS:
- Support 10,000 concurrent users
- Handle 100,000 ESP32 devices
- Process 1,000 transactions/sec
- 99.9% uptime SLA
- <200ms API response time (p95)
- Auto-scale to handle 10x traffic spikes

COST OPTIMIZATION:
- Use spot instances for non-critical workloads
- Implement request caching (Redis)
- Optimize database queries
- CDN for static assets
- Compression for API responses
- Resource limits on Kubernetes pods

TESTING STRATEGY:
1. Unit tests (80% coverage)
2. Integration tests (API ↔ DB, API ↔ Blockchain)
3. End-to-end tests (full user flows)
4. Load testing (Locust, k6)
5. Chaos engineering (simulate failures)
6. Security penetration testing

OUTPUT REQUIREMENTS:
1. Complete Kubernetes manifests (YAML files)
2. Docker Compose for local development
3. CI/CD pipeline configuration
4. Infrastructure as Code (Terraform/Pulumi)
5. Monitoring dashboards (Grafana JSON)
6. Deployment runbook (step-by-step)
7. Disaster recovery procedures
8. Security audit checklist
9. Performance benchmarking results
10. Cost estimation spreadsheet

This integration ensures all components work together seamlessly while maintaining high availability, security, and scalability.
