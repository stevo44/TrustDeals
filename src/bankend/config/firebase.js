/**
 * config/firebase.js
 * -------------------
 * Initialises firebase-admin for backend use.
 */

import admin from 'firebase-admin';

// Check if already initialised
if (admin.apps.length === 0) {
  // Use ADC (Application Default Credentials) or service account from env
  if (process.env.FIREBASE_SERVICE_ACCOUNT_TYPE) {
    admin.initializeApp({
      credential: admin.credential.cert({
        type:                     process.env.FIREBASE_SERVICE_ACCOUNT_TYPE,
        project_id:               process.env.FIREBASE_PROJECT_ID,
        private_key_id:           process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key:              process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email:             process.env.FIREBASE_CLIENT_EMAIL,
        client_id:                process.env.FIREBASE_CLIENT_ID,
        auth_uri:                 process.env.FIREBASE_AUTH_URI,
        token_uri:                process.env.FIREBASE_TOKEN_URI,
        auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL,
        client_x509_cert_url:     process.env.FIREBASE_CLIENT_CERT_URL,
      }),
    });
    console.log('[Firebase] Initialised via Service Account');
  } else {
    // Fallback to default (useful for local emulator or GCP environment)
    admin.initializeApp();
    console.log('[Firebase] Initialised via Default Credentials');
  }
}

export default admin;
