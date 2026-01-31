# Backend Architecture Document

This document outlines the architecture of the Golang backend service for the decentralized energy trading platform.

## 1. API Specification (OpenAPI 3.0)

```yaml
openapi: 3.0.0
info:
  title: Decentralized Energy Trading API
  version: 1.0.0
paths:
  /api/v1/auth/signup:
    post:
      summary: Register a new user via wallet signature
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                wallet_address:
                  type: string
                signature:
                  type: string
      responses:
        '201':
          description: User created successfully
  /api/v1/auth/login:
    post:
      summary: Log in a user and receive tokens
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                wallet_address:
                  type: string
                signature:
                  type: string
      responses:
        '200':
          description: Login successful
          content:
            application/json:
              schema:
                type: object
                properties:
                  access_token:
                    type: string
                  refresh_token:
                    type: string
  /api/v1/auth/refresh:
    post:
      summary: Refresh an access token
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                refresh_token:
                  type: string
      responses:
        '200':
          description: Token refreshed
          content:
            application/json:
              schema:
                type: object
                properties:
                  access_token:
                    type: string
  /api/v1/market/orders:
    get:
      summary: Get all open market orders
      security:
        - BearerAuth: []
      responses:
        '200':
          description: A list of open orders
  /api/v1/market/order/create:
    post:
      summary: Create a new energy order
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                type:
                  type: string
                  enum: [buy, sell]
                kwh_amount:
                  type: number
                token_price:
                  type: number
      responses:
        '201':
          description: Order created
  /api/v1/market/order/cancel:
    post:
      summary: Cancel an existing order
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                order_id:
                  type: string
      responses:
        '200':
          description: Order cancelled
  # ... Other endpoints follow a similar structure ...

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
```

## 2. Database Schema

The database uses PostgreSQL and is managed by GORM. The schema is automatically migrated from the Go domain models.

-   **User**: `(id, wallet_address, role, location, created_at, kyc_status, refresh_token, refresh_token_expires_at)`
-   **EnergyOrder**: `(id, user_id, type, kwh_amount, token_price, status, created_at)`
-   **IoTDevice**: `(id, owner_id, device_type, location, last_ping, status)`
-   **Transaction**: `(id, donor_id, recipient_id, kwh_amount, token_amount, blockchain_hash, status, timestamp)`
-   **NetworkNode**: `(id, operator_id, location, uptime, packets_routed, earnings)`

**Relationships:**
-   `User` to `EnergyOrder`: One-to-Many (`User.id` -> `EnergyOrder.user_id`)
-   `User` to `IoTDevice`: One-to-Many (`User.id` -> `IoTDevice.owner_id`)
-   `User` to `NetworkNode`: One-to-Many (`User.id` -> `NetworkNode.operator_id`)
-   `User` to `Transaction`: One-to-Many (`User.id` -> `Transaction.donor_id` or `Transaction.recipient_id`)


## 3. IoT Communication Protocol (MQTT)

The backend communicates with IoT devices via an MQTT broker.

-   **Broker Address**: Configured via `MQTT_BROKER_ADDR` environment variable.
-   **Backend Client ID**: `los-tecnicos-backend`

**Subscribed Topics (Backend listens on):**
-   `energy/donor/+/status`: Receives status updates from donor devices (e.g., battery level).
-   `energy/donor/+/lock/response`: Receives confirmation/rejection of energy lock commands.
-   `energy/recipient/+/status`: Receives consumption monitoring data.
-   `energy/device/+/alert`: Receives emergency alerts from any device.
-   `energy/transfer/+/status`: Receives real-time updates during an energy transfer.

**Published Topics (Backend publishes to):**
-   `energy/donor/{device_id}/lock`: Sent to a donor's device to request an energy lock for a matched trade.

## 4. Energy Locking Algorithm

The energy locking mechanism is initiated by the backend but executed and verified by the ESP32 device. The backend's role is orchestrational.

1.  **Match Found**: The matching engine finds a suitable buy and sell order.
2.  **Lock Command Published**: The backend is intended to publish a message to the MQTT topic `energy/donor/{device_id}/lock` with a payload like `{"order_id": "...", "kwh_requested": ...}`. (Note: This publishing logic is not yet implemented in the handlers).
3.  **Device Verification**: The ESP32 device receives this message, checks its available capacity, and reserves the energy.
4.  **Device Response**: The ESP32 publishes a response to `energy/donor/{device_id}/lock/response` with a status (`locked` or `rejected`).
5.  **Backend Confirmation**: The backend's MQTT client receives this response. Upon receiving a `locked` status, it proceeds to the blockchain transaction step. (Note: The handler for this response is currently a simple logger).

## 5. Matching Engine Logic

The matching engine runs as a background goroutine, periodically attempting to match orders.

-   **Frequency**: Every 5 seconds.
-   **Algorithm**: Price-Time Priority (simplified).
    1.  Fetch all `Created` sell orders, sorted by `price ASC`.
    2.  Fetch all `Created` buy orders, sorted by `price DESC`.
    3.  Iterate through the sell orders. For each sell order, find the first buy order where `buy_order.price >= sell_order.price`.
    4.  **For this version, only orders with an exact `kwh_amount` match are paired.**
-   **On Match**:
    1.  The status of both orders is updated to `Matched` in a single database transaction.
    2.  A new `Transaction` record is created with `Status: Pending`.
    3.  The `blockchain.HandleTradeExecution` placeholder function is called to simulate triggering the smart contract.

-   **Edge Cases & Limitations**:
    -   **Partial Fills**: Not currently supported. The engine only matches orders of the exact same size.
    -   **Race Conditions**: The current implementation fetches orders and then processes them. It's possible for an order to be cancelled after being fetched but before being matched. The transaction that updates the orders to `Matched` provides some protection, but a more robust implementation would use row-level locking (e.g., `SELECT ... FOR UPDATE`).
    -   **Scalability**: For a high-volume market, fetching all open orders from the database every few seconds is inefficient. A production system would use a more sophisticated in-memory order book.

## 6. Error Handling and Retry Mechanisms

-   **API Errors**: Handlers perform input validation and return appropriate HTTP status codes (`400`, `401`, `403`, `404`, `500`).
-   **Database/Cache Errors**: The application will fail to start if it cannot connect to the PostgreSQL database or Redis cache.
-   **MQTT Connection**: The Paho MQTT client is configured with an automatic reconnect mechanism (`SetConnectRetry(true)`).
-   **Transaction Retries**: The blockchain interaction layer is currently a placeholder and does not include retry logic for failed transactions. A production implementation would need a robust retry mechanism with exponential backoff for network errors or gas fee issues.

## 7. Deployment Architecture (Docker)

A `docker-compose.yml` file is provided for easy local development setup.

-   **Services**:
    -   `backend`: Built from the provided `Dockerfile`.
    -   `db`: Official `postgres:15-alpine` image.
    -   `redis`: Official `redis:7-alpine` image.
    -   `mosquitto`: Official `eclipse-mosquitto:2` image for MQTT.
-   **Networking**: All services are connected on a custom bridge network `los-tecnicos-net`.
-   **Volumes**: The PostgreSQL service uses a named volume `postgres_data` to persist data.
-   **Dockerfile**: A multi-stage `Dockerfile` is used to create a small, optimized, and secure production image for the backend service based on a `scratch` image.

## 8. Monitoring and Logging Strategy

-   **Audit Logging**: A custom middleware (`AuditMiddleware`) logs every request in a structured JSON format to standard output. Logged fields include: `method`, `path`, `ip`, `user_id` (if authenticated), `status`, and `latency`.
-   **Rate Limiting**: A middleware (`RateLimiter`) uses Redis to enforce a limit of 100 requests per minute per IP address, preventing basic abuse.
-   **Standard Logging**: The Gin framework's default logger is also used. Critical errors (e.g., failed service connections) and background process status (e.g., engine startup) are logged using the standard `log` package. In a production environment, this structured logging should be ingested by a centralized logging platform like Loki or an ELK stack.
