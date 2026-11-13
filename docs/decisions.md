# Architecture & Decisions Log

## Decision 1: Monorepo Structure
* **Decision**: We maintain three distinct subdirectories in one Git repository:
  * `backend/`: Node.js, Express, MongoDB REST API.
  * `admin-web/`: Vite + React administrative and storekeeper dashboard.
  * `mobile-app/`: React Native / Expo application for faculty indent creation.
  * `docs/`: Shared API contract and architecture records.
* **Reason**: Single repository allows unified versioning, easy shared type/schema validation, and prevents coordination drift between teams.

## Decision 2: Biometric Handling & Privacy (Phase 12 / India DPDP Act)
* **Decision**: Biometric scanning is strictly device-local using `expo-local-authentication`. The backend server never receives or stores fingerprint images or templates.
* **Payload**: The client transmits only `{ method: "biometric" | "pin", deviceId: "...", at: Date }`.
* **Reason**: Full compliance with privacy standards and avoids legal liability of holding raw biometric templates while still ensuring strong non-repudiation.

## Decision 3: Atomic Stock Updates
* **Decision**: Decrement inventory using atomic MongoDB operations (`$inc: { stock: -qty }` combined with `{ stock: { $gte: qty } }`).
* **Reason**: Prevents race conditions and phantom stock when multiple requisitions are processed concurrently at the counter.

## Decision 4: Fallback Data Store for Local Prototype / Development
* **Decision**: Support a built-in memory store or direct connection to MongoDB Atlas depending on `MONGO_URI` configuration, allowing instant turn-key testing without needing prior cloud provisioning.
