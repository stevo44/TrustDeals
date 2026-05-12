# Kang Open Banking – Escrow Payment Integration

Complete escrow payment system for the TrustDeals logistics platform.  
Integrates Kang Open Banking (MTN MoMo / Orange Money) into the Deal Session state machine.

---

## File Structure

```
kang-payment/
├── app.js                          ← Express entry point
├── .env.example                    ← Required environment variables
├── package.json
│
├── config/
│   └── database.js                 ← MongoDB/Mongoose connection
│
├── models/
│   ├── Payment.js                  ← Payment record (linked to DealSession)
│   └── DealSession.js              ← Deal Session with full state machine
│
├── services/
│   └── paymentService.js           ← ALL Kang API calls live here
│
├── controllers/
│   ├── paymentController.js        ← Business logic for payment endpoints
│   └── webhookController.js        ← Inbound Kang webhook handler
│
├── middleware/
│   └── auth.js                     ← JWT auth + role-based access control
│
└── routes/
    ├── paymentRoutes.js            ← /payments/**
    └── webhookRoutes.js            ← /webhooks/kang
```

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
# Edit .env with your actual values
```

Required variables:

| Variable              | Description                                         |
|-----------------------|-----------------------------------------------------|
| `MONGODB_URI`         | MongoDB connection string                           |
| `JWT_SECRET`          | Secret for verifying JWT tokens                     |
| `KANG_API_BASE_URL`   | Kang API base URL (e.g. `https://api.kangpay.cm/v1`)|
| `KANG_API_KEY`        | Your Kang merchant API key                          |
| `KANG_SECRET_KEY`     | Used to verify webhook signatures                   |
| `APP_BASE_URL`        | Your server's public URL (for webhook callback)     |

### 3. Start the server

```bash
npm run dev    # development (nodemon)
npm start      # production
```

### 4. Register webhook URL in Kang dashboard

Set your Kang webhook URL to:
```
POST https://yourapp.com/webhooks/kang
```

---

## API Endpoints

### Payment Endpoints (`/payments`)

All require `Authorization: Bearer <jwt_token>` header.

#### `POST /payments/initiate`
Buyer initiates escrow payment.

**Access:** Buyer only (JWT + ownership check)  
**Prerequisite:** Session must be in `PRODUCT_CONFIRMED` status

```json
// Request body
{
  "session_id": "64abc...",
  "phone": "671234567",
  "network": "mtn",
  "amount": 15000
}

// Response 201
{
  "success": true,
  "payment": {
    "id": "...",
    "status": "pending",
    "transaction_reference": "kang-64abc-lxyz-a1b2",
    "amount": 15000,
    "network": "mtn"
  },
  "session": {
    "id": "64abc...",
    "status": "PAYMENT_PENDING"
  }
}
```

#### `GET /payments/session/:session_id`
Get payment for a session.  
**Access:** Buyer, Seller, or Admin

#### `GET /payments/verify/:reference`
Manually poll Kang to check payment status (webhook fallback).  
**Access:** Authenticated users

#### `POST /payments/release`
Release escrowed funds to seller.  
**Access:** Admin / System only  
**Prerequisites:** Session = `DELIVERED` + OTP verified

```json
{ "session_id": "64abc..." }
```

#### `POST /payments/refund`
Refund buyer when delivery fails.  
**Access:** Admin only

```json
{ "session_id": "64abc...", "reason": "Product rejected by buyer" }
```

---

### Webhook Endpoint

#### `POST /webhooks/kang`

Receives payment status updates from Kang.  
- Verifies HMAC-SHA256 signature
- Idempotent (safe to receive duplicate events)
- Responds `200` immediately; processes async

**Kang must send:**
- Header: `X-Kang-Signature: <hmac_hex>`
- Body: JSON event with `reference` and `status`

---

## Session State Machine

```
CREATED
  └─▶ JOINED
        └─▶ BUYER_REQUESTED_PRODUCT
              └─▶ PRODUCT_SUBMITTED
                    └─▶ PRODUCT_CONFIRMED
                          └─▶ PAYMENT_PENDING  ◀── POST /payments/initiate
                                ├─▶ PAYMENT_LOCKED   ◀── webhook (success)
                                │     └─▶ RIDER_ASSIGNED
                                │           └─▶ IN_TRANSIT
                                │                 └─▶ DELIVERED
                                │                       ├─▶ COMPLETED  ◀── POST /payments/release (OTP verified)
                                │                       └─▶ RETURNED   ◀── POST /payments/refund
                                └─▶ PRODUCT_CONFIRMED  (reverted on payment failure)
```

## Payment Status Machine

```
pending ──▶ paid ──▶ released   (normal escrow flow)
              └────▶ refunded   (failed delivery)
pending ──▶ failed              (Kang rejected)
```

---

## Escrow Logic

| Event                         | Payment Status | Session Status    |
|-------------------------------|----------------|-------------------|
| Buyer calls `/initiate`       | `pending`      | `PAYMENT_PENDING` |
| Kang webhook: SUCCESS         | `paid`         | `PAYMENT_LOCKED`  |
| Kang webhook: FAILED          | `failed`       | `PRODUCT_CONFIRMED` (reverted) |
| Admin calls `/release` + OTP  | `released`     | `COMPLETED`       |
| Admin calls `/refund`         | `refunded`     | `RETURNED`        |

**Funds never auto-release.** Release requires:
1. Session status = `DELIVERED`
2. `otp_verified = true` on the session
3. Explicit `POST /payments/release` call by admin/system

---

## Security Notes

- `KANG_API_KEY` and `KANG_SECRET_KEY` are server-side only — never sent to frontend
- Webhook signature verified via HMAC-SHA256 before any DB mutation
- JWT tokens verified on every protected route
- Role checks: buyer can only initiate; only admin can release/refund
- Idempotency: duplicate webhooks are detected via `webhook_events[]` array
- Atomic MongoDB updates prevent race conditions on webhook delivery
- Phone numbers normalized to `237XXXXXXXXX` format before sending to Kang

---

## Adapting Kang API Calls

The `paymentService.js` wraps all Kang HTTP calls. If Kang's actual field names differ from what's documented, only this file needs updating. Key mappings to verify:

| Our code                        | Kang endpoint / field    |
|---------------------------------|--------------------------|
| `POST /payments/collect`        | Payment collection (MoMo push) |
| `GET /payments/:reference`      | Status check             |
| `POST /transfers/disburse`      | Seller payout / Buyer refund |
| `x-kang-signature` header       | Webhook HMAC header name |
| `data.payment.id`               | Kang's internal payment ID |
| `data.payment.status`           | Payment status string    |

Update `normalizeKangStatus()` in `paymentService.js` to match Kang's exact status vocabulary.
