# TrustDeals — Escrow-Style Marketplace and Delivery Platform

TrustDeals is a full-stack marketplace prototype designed to help buyers and sellers coordinate a transaction through a shared deal room, mobile-money payment flow, delivery tracking, and delivery confirmation. It includes role-specific experiences for buyers, sellers, riders, and administrators, with verification, dispute, notification, and payout-management features.

> **Project status:** This is an active development project, not a production-ready financial service. The source includes a working set of frontend screens and workflow logic, a Fapshi payment integration module with mock mode, and a separate Express payment server. Important integration, security, and startup issues still need to be resolved before using the system with real transactions. See [Known Limitations and Security Considerations](#known-limitations-and-security-considerations).

## Table of Contents

- [Project Overview](#project-overview)
- [User Roles and Workflows](#user-roles-and-workflows)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Backend Endpoints](#backend-endpoints)
- [Security Considerations](#security-considerations)
- [Known Limitations and Security Considerations](#known-limitations-and-security-considerations)
- [Recommended Roadmap](#recommended-roadmap)
- [Engineering Experience](#engineering-experience)

## Project Overview

TrustDeals is designed around the idea of a structured transaction between two parties. A buyer and seller join a deal, agree on product details, and use a mobile-money payment flow. After payment status is confirmed, the deal can progress through rider assignment, delivery, and buyer confirmation.

The application supports multiple roles and includes administrative screens for reviewing users, verification submissions, disputes, notifications, and payout-related issues. The frontend uses Firebase Authentication and Firestore for user and deal data. A separate Node.js server contains payment and payout code backed by MongoDB/Mongoose and integrates with Fapshi-related services.

**Important distinction:** The project implements an escrow-style user experience and transaction workflow. It should not be represented as a fully secured or regulated escrow service until the payment lifecycle, server-side authorization, database consistency, and payout processing have been completed and independently tested.

## User Roles and Workflows

### Buyer

- Create or join a deal with a seller.
- Review product details and pricing.
- Initiate a mobile-money payment using the payment interface.
- View deal progress and communicate in the deal room.
- Receive a delivery OTP and use it to confirm receipt.
- Raise a dispute when a transaction goes wrong.

### Seller

- Join a deal invitation and review the proposed transaction.
- Confirm product information and prepare goods for collection.
- Follow delivery progress and communicate with the buyer.
- View payout-related status and account debt information.
- Complete account and identity verification steps.

### Rider

- Use a dedicated rider portal.
- View available or assigned deliveries.
- Update collection, transit, and arrival status.
- Use pickup-code and delivery-confirmation workflows where available.
- View relevant deal details and rider payout information.

### Administrator

- Use the administrative dashboard to monitor deal activity.
- Review verification submissions and user status.
- Inspect and manage disputes.
- View operational notifications and payout-related problems.
- Review deal status, delivery progress, and platform activity.

The exact permissions that are safe for production must also be enforced in trusted backend code and Firestore Security Rules—not only by hiding or showing frontend controls.

## Features

### 1. Authentication and Role-Based Experiences

- Firebase Authentication integration.
- User profiles stored in Firestore.
- Role-aware interfaces for buyers, sellers, riders, and administrators.
- Login, registration, verification, and onboarding screens.
- An invitation route pattern (`/join/:dealId`) that preserves a deal invitation while a user signs in or registers.

### 2. Deal Room and Transaction Workflow

- Deal room for viewing transaction information and status.
- Buyer/seller messaging stored under each deal in Firestore.
- Support for image messages and product-related details.
- Deal timeline and status indicators.
- A dedicated deal-state helper that describes valid status transitions and status presentation.
- Pickup and delivery confirmation flows using codes/OTPs.

The frontend models statuses such as `WAITING`, `ACTIVE`, `PRODUCT_CONFIRMED`, `PAYMENT_LOCKED`, `RIDER_ASSIGNED`, `IN_TRANSIT`, `AT_BUYER_LOCATION`, `COMPLETED`, and `DISPUTED`, alongside cancellation, return, and payout-failure states.

### 3. Mobile-Money Payment Flow

- Fapshi payment module supporting MTN Mobile Money and Orange Money labels.
- Payment initiation and status polling in the deal room.
- A mock payment mode for development and interface testing.
- A visible mock-mode banner to make simulated payment behavior clear.
- Separate server-side payout service code for seller, rider, and refund transactions.

**Mock mode is not a real payment.** The browser mock stores simulated transaction state in memory. It does not transfer funds, and a successful mock response must never be treated as proof of a real payment.

### 4. Delivery Fees and Platform Fees

- Route-based delivery-fee configuration stored in Firestore, with default values in code.
- Fee calculation helpers for product price, platform fee, delivery fee, total charged, and seller proceeds.
- Current default platform fee rate of 5% in the fee helper.
- City and route configuration covering Buea, Douala, Yaoundé, Bamenda, and Bafoussam, although the default fee table contains only some routes.
- Rider payout calculations based on delivery route.

All amounts, fees, and payout eligibility must ultimately be re-calculated and validated on the server before money is moved.

### 5. Verification and Account Review

- Verification wizard and review queue.
- Phone OTP interfaces.
- Upload fields for identity documents, selfies, and role-specific evidence such as business or vehicle documents.
- Verification status and rejection-reason displays.
- Admin-facing verification review tools.

### 6. Disputes and Notifications

- Dispute submission and evidence-oriented interfaces.
- Separate administrative dispute dashboard.
- User notification center and admin notifications.
- Deal-related events for funding, rider assignment, collection, arrival, completion, and disputes.
- Seller debt and payout failure indicators.

### 7. Wallet and Payout Utilities

- Wallet data structures and helpers for credit, escrow locking, and release operations.
- Payout helper functions that call the backend release/refund endpoints.
- Intended payout sequence covering rider compensation, seller payment, debt deduction, and buyer refunds.
- Mock payout service for development testing.

These utilities are present in the codebase, but the payment and payout lifecycle is not yet fully integrated or secure enough for production use.

### 8. Real-Time Presence

- A Socket.IO presence server.
- Deal-room presence events for users joining, leaving, and disconnecting.
- An in-memory online-user and session-room store.
- Optional last-seen persistence through Firebase Admin.

The presence store is in memory, so it resets on restart and is not shared across multiple server instances without additional infrastructure.

## Technology Stack

| Area | Technology |
|---|---|
| Frontend | React, TypeScript, Vite-style environment configuration |
| Styling | Tailwind CSS utility classes and custom CSS |
| Authentication | Firebase Authentication |
| Application data | Cloud Firestore |
| File storage | Firebase Storage integration |
| Notifications and UI feedback | Sonner and custom notification helpers |
| Icons | Lucide icon components |
| Backend API | Node.js and Express |
| Backend database | MongoDB with Mongoose |
| Backend Firebase access | Firebase Admin SDK configuration module |
| API authentication middleware | JSON Web Tokens |
| Cross-origin requests | CORS |
| Payments | Fapshi-related collection/payout modules; a NotchPay module is also present in the frontend source |
| Real-time presence | Socket.IO |

The uploaded source archive does not include the frontend root `package.json`, lockfile, Vite configuration, or HTML entry file. Therefore, exact frontend dependency versions and root npm scripts could not be verified from this snapshot. The backend package manifest specifies Node.js `>=18` and provides `start`, `dev`, and `test` scripts.

## Architecture

The current codebase has three main parts.

### Frontend application

The React application is started from `main.tsx` and rendered through `App.tsx`. It handles authentication state, profile loading, role-specific navigation, deal invitations, deal rooms, dashboards, payment UI, and user interactions. Most deal and wallet operations use Firestore directly from the browser.

### Payment API server

The Express server in `bankend/app.js` configures CORS and request parsing, connects to MongoDB, registers webhook/payment/payout routes, and exposes a health endpoint. The payment server contains Mongoose `Payment` and `DealSession` models, payment/payout service modules, and webhook-processing code.

### Presence server

`server/presenceServer.js` runs an Express and Socket.IO server for live presence. It keeps current connections and deal-room membership in memory and can attempt to update user last-seen data through Firebase Admin.

### Data consistency note

The frontend's main `deals` and `users` records are Firestore documents, while the payment backend also defines MongoDB collections for `DealSession` and `Payment`. The source snapshot does not provide a complete synchronization layer between these two data models. This needs to be resolved before payment webhooks and deal status can be considered a single reliable source of truth.

## Project Structure

```text
src/
├── App.tsx
├── main.tsx
├── index.css
├── types.ts
├── assets/
├── components/
│   ├── AdminDashboard.tsx
│   ├── AdminDisputeDashboard.tsx
│   ├── AdminNotificationsBell.tsx
│   ├── AdminVerificationQueue.tsx
│   ├── Dashboard.tsx
│   ├── DealRoom.tsx
│   ├── DisputeForm.tsx
│   ├── LandingPage.tsx
│   ├── LoginPage.tsx
│   ├── PaymentModal.tsx
│   ├── RiderPortal.tsx
│   ├── SignUpPage.tsx
│   ├── VerificationWizard.tsx
│   └── ...
├── contexts/
│   └── PresenceContext.tsx
├── hooks/
│   └── usePresence.ts
├── lib/
│   ├── dealStateMachine.ts
│   ├── fapshi.ts
│   ├── fees.ts
│   ├── firebase.ts
│   ├── firestore-utils.ts
│   ├── notifications.ts
│   ├── payouts.ts
│   ├── verification.ts
│   └── wallet.ts
├── server/
│   └── presenceServer.js
└── bankend/
    ├── app.js
    ├── package.json
    ├── config/
    ├── controllers/
    ├── middleware/
    ├── models/
    ├── routes/
    └── services/
```

> The backend directory is named `bankend` in this source snapshot. Commands below preserve that name. Consider renaming it to `backend` in a cleanup pass, updating all references at the same time.

## Getting Started

### Prerequisites

- Node.js 18 or newer.
- npm.
- A Firebase project with Authentication, Firestore, and Storage configured for the frontend.
- A MongoDB database for the separate payment server.
- Fapshi sandbox credentials only if testing non-mock payment requests.
- Appropriate Firebase Admin credentials if server-side Firestore access is required.

### 1. Restore the Complete Repository

The supplied archive contains the source directory but not the frontend root `package.json`, lockfile, Vite configuration, or `index.html`. Restore these files from the full repository before attempting to build the frontend.

### 2. Configure the Frontend

Create a frontend environment file based on `.env.example` and provide the Firebase project settings. For local UI development, use mock payments where possible:

```dotenv
VITE_FAPSHI_MOCK=true
```

The Firebase values prefixed with `VITE_FIREBASE_` are client configuration values; protect application data with correctly configured Firebase Security Rules and Firebase App Check where appropriate.

**Do not place payment-provider secret credentials in `VITE_` variables.** Variables with that prefix are compiled into frontend assets and can be read by users in the browser. The current Fapshi client module references `VITE_FAPSHI_API_USER` and `VITE_FAPSHI_API_KEY`; real payment credentials should be moved behind a trusted server API before production use.

Use the npm scripts defined by the complete frontend `package.json` to install and run the UI. Those scripts cannot be verified from this archive alone.

### 3. Configure the Backend

The backend package lives in `src/bankend`:

```bash
cd src/bankend
npm install
cp .env.example .env
```

Configure the environment variables for the database, application port, CORS origins, JWT, and payment provider. See [Environment Variables](#environment-variables).

The backend imports in this snapshot currently contain missing/mismatched modules, so the service is not expected to start successfully until the integration issues listed below are fixed.

Once corrected, the available package scripts are:

```bash
npm run dev
npm start
```

The backend's default port is `4000`.

### 4. Run the Presence Server

The optional presence server is implemented in `src/server/presenceServer.js` and uses Express, Socket.IO, and Firebase Admin. Its dependencies and run command should be added to the complete root project scripts or managed using a dedicated server package. Configure its allowed origins and Firebase Admin credentials before enabling it.

### 5. Verify Server Health

The payment server defines:

```http
GET http://localhost:4000/health
```

A response from this route only confirms that the Express server is running; it does not verify payment-provider access, Firestore rules, webhook signatures, or payout correctness.

## Environment Variables

Environment variables used or referenced by the source include the following. The exact required set should be consolidated after the frontend and backend configuration are unified.

### Frontend

| Variable | Purpose | Notes |
|---|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase web app configuration | Public client config; protect data with Security Rules |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Authentication domain | From Firebase project settings |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID | From Firebase project settings |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Storage bucket | From Firebase project settings |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID | If applicable to the project configuration |
| `VITE_FIREBASE_APP_ID` | Firebase web app ID | From Firebase project settings |
| `VITE_FIREBASE_MEASUREMENT_ID` | Firebase measurement ID | Optional, when analytics is configured |
| `VITE_FIREBASE_FIRESTORE_DATABASE_ID` | Optional Firestore database ID | Leave empty for the default database |
| `VITE_FAPSHI_MOCK` | Enables/disables frontend payment simulation | Use `true` for local UI testing |
| `VITE_FAPSHI_BASE_URL` | Fapshi endpoint base URL | Prefer server-side integration for real payments |
| `VITE_FAPSHI_API_USER` | Currently referenced by the frontend payment module | **Do not place real credentials here** |
| `VITE_FAPSHI_API_KEY` | Currently referenced by the frontend payment module | **Do not place real credentials here** |
| `VITE_BACKEND_URL` | Base URL used by payout helpers | Configure for the payment API server |
| `VITE_PRESENCE_URL` | Socket.IO presence server URL | Configure when presence service is enabled |
| `VITE_NOTCHPAY_PUBLIC_KEY` / `VITE_NOTCH_PAY_PUBLIC_KEY` | NotchPay module configuration | An additional/legacy integration path is present |

### Backend

| Variable | Purpose |
|---|---|
| `PORT` | Express server port; defaults to `4000` |
| `NODE_ENV` | Runtime environment |
| `MONGODB_URI` | MongoDB connection string |
| `DB_NAME` | Optional MongoDB database name; defaults to `trustdeals` |
| `JWT_SECRET` | Secret for validating JWTs used by the payment API |
| `FAPSHI_BASE_URL` | Fapshi API base URL |
| `FAPSHI_PAYOUT_API_USER` | Server-side payout API user credential |
| `FAPSHI_PAYOUT_API_KEY` | Server-side payout API key |
| `FAPSHI_MOCK` | Selects the backend mock payout service when configured |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed origins |
| `FIREBASE_SERVICE_ACCOUNT_TYPE` and other `FIREBASE_*` service-account fields | Firebase Admin initialization, if used by the backend |

The provided backend `.env.example` does not currently list every variable referenced by the payment service. Update the sample environment file to reflect the implementation before onboarding another developer.

Never commit `.env` files or credentials. Use `.env.example` with placeholder values and make sure `.env` is excluded by `.gitignore`.

## Backend Endpoints

The Express application declares the following routes in code. **These are intended routes, not a guarantee that the current backend snapshot can serve them successfully**; see the import and integration issues in the next section.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/webhooks/fapshi` | Payment-provider webhook handler; raw body is required for signature verification |
| `POST` | `/payouts/release` | Intended rider/seller payout workflow |
| `POST` | `/payouts/refund` | Intended buyer refund workflow |
| `POST` | `/payouts/return-rider` | Intended return-rider payout workflow |

The `paymentRoutes.js` file currently duplicates payout-style routes and imports a controller path that is not present in the snapshot. A reliable payment-initiation endpoint is not exposed by the backend route modules as currently supplied; the frontend initiates Fapshi requests directly, which is not appropriate for storing private payment credentials in production.

## Security Considerations

The codebase has useful structural building blocks, including explicit user roles, a deal state-machine helper, an OTP workflow, backend payout routes, payment-provider status polling, and a webhook handler designed to verify signatures. They still require end-to-end verification.

Before production use:

- Keep payment-provider secret keys on the server, never in browser-exposed `VITE_` variables.
- Enforce deal participation, role checks, payment state transitions, OTP validation, amount verification, and payout eligibility on a trusted server.
- Configure and test Firestore Security Rules for every collection and subcollection, especially `deals`, `users`, `wallets`, `otps`, `verifications`, and `notifications`.
- Validate webhook signatures using the provider's official verification process and make processing idempotent.
- Verify the payment amount, currency, reference, and associated deal on the server before marking a deal funded.
- Do not trust client-provided user IDs or roles in Socket.IO handshake data; verify a signed token server-side.
- Use a secure random JWT secret, protect service-account credentials, and use a least-privilege database account.
- Add server-side rate limits and audit logs for OTP checks, disputes, refunds, and payouts.
- Keep mock-mode transactions clearly isolated from live transactions.

## Known Limitations and Security Considerations

The following issues were identified during review of the supplied source archive.

### 1. Missing or Mismatched Backend Imports

The backend route files import `controllers/payoutController.js` and `services/payoutService.js`, but those files are not present in the supplied archive. The present controller and service files use different names. The webhook controller also imports `verifyKangWebhookSignature` and `normalizeKangStatus` from `paymentService.js`, but those named exports are not defined there in this snapshot.

**Impact:** The payment server is likely to fail during module loading before it can serve requests.

**Next step:** Consolidate controller/service filenames, align all imports and exports, add a startup integration test, and remove stale Kang naming if Fapshi is the intended provider.

### 2. Firebase and MongoDB Are Separate Sources of Data

The main interface reads and updates Firestore `deals` and `users` records. The payment webhook models operate on MongoDB `DealSession` and `Payment` records. The source does not show a complete, reliable synchronization bridge between those models. The server also needs to initialize Firebase Admin before any controller calls `admin.firestore()`.

**Impact:** A payment event recorded in MongoDB may not update the Firestore deal shown to buyers, sellers, riders, and administrators.

**Next step:** Choose a clear source of truth and implement a server-controlled, idempotent integration between payments and deal status.

### 3. Payment Credentials Are Referenced in Frontend Variables

The browser payment module reads `VITE_FAPSHI_API_USER` and `VITE_FAPSHI_API_KEY`. Frontend environment variables prefixed with `VITE_` are exposed in built client code.

**Impact:** Real credentials could be extracted from the browser bundle. A browser-controlled payment-status flow is also not a secure basis for deciding whether money has been received.

**Next step:** Move initiation and status verification to the backend, store secrets in server-only environment variables, and transition deal state only after a verified server-side provider response or webhook.

### 4. Client-Side Transaction State Changes

The deal room polls payment status in the browser and updates deal status and the delivery OTP in Firestore. Some transaction completion and wallet operations are initiated from frontend code.

**Impact:** If Firestore rules permit these changes without strict server-side controls, a modified client could attempt to alter high-value state such as payment locked or completed.

**Next step:** Move payment-related state transitions, OTP verification, wallet ledger operations, and payout authorization to trusted backend functions. Store sensitive OTP material safely, expire it, and limit failed attempts on the server.

### 5. Presence Authentication Is Not Fully Verified

The Socket.IO server accepts `userId`, `role`, and related identity information from the client handshake; the supplied code does not verify a signed authentication token for the socket connection.

**Impact:** A client may be able to impersonate another user's presence identity if the service is publicly reachable.

**Next step:** Verify Firebase ID tokens or another signed credential in Socket.IO middleware, derive user roles from trusted claims/database data, and authorize deal-room membership before joining rooms.

### 6. Mixed Payment Integration Paths and Outdated Documentation

The source includes Fapshi and NotchPay-related frontend code, a mock frontend integration, a backend payout implementation, and older comments/model names that refer to Kang. The backend `.env.example` also does not cover all environment variables referenced by the code.

**Impact:** It is difficult to determine which payment flow is authoritative, and environment configuration may not match the actual runtime requirements.

**Next step:** Select and document the provider(s) to support, remove abandoned integration code, standardize names, and keep the setup guide synchronized with environment-variable validation in code.

### 7. Credentials File in the Source Archive

The supplied archive includes a backend `.env` file. Secret values are intentionally not reproduced in this documentation.

**Next step:** Do not commit that file to a public repository. If it has already been uploaded to GitHub or shared outside a trusted environment, revoke or rotate any real payment-provider credentials, database credentials, or other secrets it contains. Remove the file from the repository and Git history, and use a secrets manager or deployment environment variables instead.

### 8. Tests and Full Frontend Build Configuration Are Not Included

The backend package declares a test script, but no project test suite or frontend root build configuration was available in the supplied archive.

**Next step:** Add unit and integration tests for fee calculations, state transitions, authentication, webhook idempotency, OTP restrictions, payment failure recovery, and payouts. Restore the frontend root manifest and build setup so that a clean clone can be installed and built reproducibly.

## Recommended Roadmap

1. **Make the project reproducible:** restore frontend root configuration, update `.env.example`, add setup scripts, and confirm a clean install.
2. **Repair the backend startup:** resolve missing controller/service imports and initialize Firebase Admin consistently where required.
3. **Choose one payment source of truth:** align Firestore deal state with server-verified payment and payout events.
4. **Move financial decisions server-side:** payment initiation, verification, wallet ledger entries, OTP checks, refunds, and releases should not rely on browser permission alone.
5. **Harden identity and data rules:** verify Socket.IO identity and thoroughly test Firebase Security Rules.
6. **Add automated coverage:** test normal flows, duplicated webhooks, network failures, repeated payout requests, OTP abuse, and dispute resolution.
7. **Improve operations:** add structured logs, audit history, monitoring, rate limits, deployment documentation, and a CI pipeline.

## Engineering Experience

This project provides practical experience with:

- Developing a multi-role React and TypeScript application.
- Modeling a transaction workflow with explicit states and transitions.
- Integrating Firebase Authentication, Firestore, and Storage.
- Designing deal-room messaging and real-time presence with Socket.IO.
- Building fee calculations for city-based delivery routes.
- Implementing mobile-money payment UI and mock transaction flows.
- Structuring an Express backend with routes, controllers, services, models, and middleware.
- Working with MongoDB/Mongoose and server-side Firebase access.
- Identifying integration risks involving credentials, webhook validation, authorization, and consistency across databases.

## Conclusion

TrustDeals is a substantial full-stack prototype exploring a marketplace workflow that combines transactions, mobile-money payments, delivery coordination, OTP confirmation, user verification, dispute handling, and administrative operations.

Its strongest engineering opportunities are in the role-based application structure, deal-state modeling, and breadth of the product workflow. The most important next step is to consolidate payment processing and deal state into a secure, server-authoritative implementation, then cover the critical paths with automated tests before considering real-money deployment.
