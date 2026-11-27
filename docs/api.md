# Stationery Indent App - API Contract

This document is the official API specification agreed upon for the Stationery Indent App. All endpoints are prefixed with `/api`.

Authentication is handled via Bearer JWT in the `Authorization` header:
`Authorization: Bearer <token>`

---

## 1. Authentication & Profile

### POST /api/auth/login
* **Access**: Public
* **Purpose**: Authenticates a user with Staff ID and password.
* **Request Body**:
```json
{
  "staffId": "FAC101",
  "password": "Password@123"
}
```
* **Success Response (200 OK)**:
```json
{
  "data": {
    "token": "eyJhbGciOi...",
    "user": {
      "id": "6735...",
      "staffId": "FAC101",
      "name": "Dr. Sarah Jenkins",
      "department": "Computer Science",
      "role": "faculty",
      "mustChangePassword": false
    }
  }
}
```
* **Error Response (401 Unauthorized)**:
```json
{
  "message": "Invalid staff ID or password"
}
```

### POST /api/auth/change-password
* **Access**: Authenticated (Any role)
* **Request Body**:
```json
{
  "oldPassword": "Password@123",
  "newPassword": "NewPassword@456"
}
```
* **Success Response (200 OK)**:
```json
{
  "data": {
    "message": "Password updated successfully"
  }
}
```

### GET /api/me
* **Access**: Authenticated (Any role)
* **Success Response (200 OK)**:
```json
{
  "data": {
    "id": "6735...",
    "staffId": "FAC101",
    "name": "Dr. Sarah Jenkins",
    "department": "Computer Science",
    "role": "faculty",
    "email": "sarah.j@college.edu",
    "phone": "+91 9876543210",
    "devices": [
      {
        "deviceId": "dev-phone-9912",
        "label": "Pixel 7",
        "approved": true,
        "registeredAt": "2026-11-10T10:00:00.000Z"
      }
    ]
  }
}
```

### POST /api/me/devices
* **Access**: Authenticated (Any role)
* **Request Body**:
```json
{
  "deviceId": "dev-phone-9912",
  "label": "Pixel 7"
}
```
* **Success Response (200 OK)**:
```json
{
  "data": {
    "message": "Device registered and pending administrator approval",
    "deviceId": "dev-phone-9912",
    "approved": false
  }
}
```

---

## 2. Items & Inventory

### GET /api/items
* **Access**: Authenticated (Any role)
* **Query Params**:
  * `search` (optional string): Case-insensitive match on name or code
  * `category` (optional string)
  * `active` (optional boolean, default true)
* **Success Response (200 OK)**:
```json
{
  "data": [
    {
      "_id": "6735a1...",
      "name": "A4 Copier Paper 75GSM",
      "code": "PAP-A4-75",
      "category": "Paper",
      "unit": "ream",
      "stock": 42,
      "reorderLevel": 10,
      "maxPerIndent": 5,
      "active": true
    }
  ]
}
```

### POST /api/items
* **Access**: `storekeeper`, `admin`
* **Request Body**:
```json
{
  "name": "Whiteboard Marker Blue",
  "code": "MRK-WB-BLU",
  "category": "Writing",
  "unit": "piece",
  "stock": 50,
  "reorderLevel": 15,
  "maxPerIndent": 10
}
```
* **Success Response (201 Created)**: Returns the newly created item document.

### PATCH /api/items/:id
* **Access**: `storekeeper`, `admin`
* **Request Body**: Fields to update (e.g., `reorderLevel`, `maxPerIndent`, `active`).

---

## 3. Stock Management

### POST /api/stock/in
* **Access**: `storekeeper`, `admin`
* **Request Body**:
```json
{
  "itemId": "6735a1...",
  "quantity": 50,
  "reference": "PO-2026-881 / Bill 9021",
  "supplier": "Stationery Mart",
  "notes": "Annual replenishment batch"
}
```
* **Success Response (200 OK)**:
```json
{
  "data": {
    "message": "Stock added successfully",
    "newStock": 92
  }
}
```

### POST /api/stock/adjust
* **Access**: `admin`, `storekeeper`
* **Request Body**:
```json
{
  "itemId": "6735a1...",
  "actualStock": 40,
  "reason": "Physical store count audit"
}
```

### GET /api/stock/ledger?item=:itemId
* **Access**: `storekeeper`, `admin`
* **Success Response (200 OK)**: Returns chronological transaction history for the item.

---

## 4. Indents (Requests & Issue Lifecycle)

### POST /api/indents
* **Access**: `faculty`, `staff`, `hod`
* **Request Body**:
```json
{
  "items": [
    { "itemId": "6735a1...", "quantity": 2 },
    { "itemId": "6735b2...", "quantity": 1 }
  ],
  "confirmation": {
    "method": "biometric",
    "deviceId": "dev-phone-9912"
  },
  "urgency": "Urgent",
  "neededBy": "2026-11-28",
  "neededWithin": "3 days",
  "purpose": "Exam papers printing",
  "notes": "Handle with priority",
  "remarks": "Required for semester exam printing"
}
```

#### Optional Fields & Legacy Remarks Precedence:
* **`urgency`**: Optional string (`"Urgent"`, `"Normal"`, or `"Not urgent"`, case-insensitive). Any other value is rejected with `400 Bad Request`. If omitted (and not found in legacy remarks), no urgency is stored; the admin Issue Queue displays and sorts a missing urgency as `"Normal"`.
* **`neededBy`**: Optional target date string. Supports ISO date (`YYYY-MM-DD`), ISO datetime (`YYYY-MM-DDTHH:mm:ss.sssZ`), or human-readable format (`DD MMM YYYY`, e.g., `"28 Nov 2026"`). Impossible calendar dates (such as `2026-02-30`) are rejected with `400 Bad Request`.
* **`neededWithin`**: Optional string expressing timeframe (e.g., `"3 days"`).
* **`purpose`**: Optional string describing requisition purpose.
* **`notes`**: Optional string for additional comments.
* **Legacy Remarks Fallback**: When structured fields (`urgency`, `neededBy`, `neededWithin`, `purpose`, `notes`) are absent, undefined, or empty, the backend automatically parses legacy formatted `remarks` strings matching patterns like:
  `"Urgency: Urgent | Needed by: 29 Nov 2026 (3 days) | Purpose: Exam | Notes: Urgent printing"`
  Structured request fields take strict precedence over parsed remarks. Remarks are used as fallback only when the real field is absent or blank. The original `remarks` string is always preserved intact.
* **Success Response (201 Created)**:
```json
{
  "data": {
    "indentNo": "IND-2026-000101",
    "status": "REQUESTED",
    "requester": "6735...",
    "department": "Computer Science",
    "items": [...],
    "confirmation": {
      "method": "biometric",
      "at": "2026-11-13T22:30:00.000Z",
      "deviceId": "dev-phone-9912"
    },
    "createdAt": "2026-11-13T22:30:00.000Z"
  }
}
```

### GET /api/indents/mine
* **Access**: Authenticated (Any role)
* **Success Response (200 OK)**:
```json
{
  "data": [
    {
      "_id": "6735c...",
      "indentNo": "IND-2026-000101",
      "status": "REQUESTED",
      "department": "Computer Science",
      "items": [...],
      "createdAt": "2026-11-13T22:30:00.000Z"
    }
  ],
  "total": 1
}
```

### GET /api/indents
* **Access**: `storekeeper`, `admin`, `hod` (hod restricted to own department)
* **Query Params**: `status`, `department`, `from`, `to`, `page`, `limit`
* **Success Response (200 OK)**: Paginated array of indents populated with requester details.

### PATCH /api/indents/:id/issue
* **Access**: `storekeeper`
* **Purpose**: Issues items, reducing stock atomically and writing to the stock ledger.
* **Request Body** (optional adjustments):
```json
{
  "itemsIssued": [
    { "itemId": "6735a1...", "qtyIssued": 2 }
  ],
  "remarks": "Issued all requested items"
}
```
* **Success Response (200 OK)**:
```json
{
  "data": {
    "indentNo": "IND-2026-000101",
    "status": "ISSUED",
    "issuedAt": "2026-11-13T22:45:00.000Z",
    "issuedBy": "6735..."
  }
}
```

### PATCH /api/indents/:id/cancel
* **Access**: Requester (before issued) or `admin`

---

## 5. Reports & Audit

### GET /api/reports/monthly?month=2026-11
* **Access**: `storekeeper`, `admin`
* **Success Response (200 OK)**: Aggregated issue quantities and counts grouped by department and item.

### GET /api/reports/low-stock
* **Access**: `storekeeper`, `admin`
* **Success Response (200 OK)**: List of items where current `stock <= reorderLevel`.

### GET /api/reports/export.csv
* **Access**: `storekeeper`, `admin`
* **Success Response (200 OK)**: Returns CSV stream of indent records.

### GET /api/audit
* **Access**: `admin`
* **Success Response (200 OK)**: Recent system activity logs.

### GET /api/health
* **Access**: Public
* **Success Response (200 OK)**:
```json
{
  "ok": true,
  "time": "2026-11-13T23:00:00.000Z"
}
```
