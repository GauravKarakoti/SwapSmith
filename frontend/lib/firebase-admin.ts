import * as admin from 'firebase-admin';

let _auth: admin.auth.Auth | null = null;
let _initError: string | null = null;

function initFirebaseAdmin(): void {
  if (admin.apps.length > 0) {
    _auth = admin.auth();
    return;
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    _initError = 'FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set';
    console.error('[Firebase Admin]', _initError);
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serviceAccount: any = JSON.parse(raw);

    // Fix common env-var issue: private_key may have literal \\n instead of real newlines
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    _auth = admin.auth();
    console.log('[Firebase Admin] Initialized. Project:', serviceAccount.project_id ?? 'unknown');
  } catch (err) {
    _initError = err instanceof Error ? err.message : String(err);
    console.error('[Firebase Admin] Initialization error:', _initError);
  }
}

initFirebaseAdmin();

/**
 * Thin wrapper so callers keep the same `adminAuth.verifyIdToken(token)` interface.
 * Throws with a clear message if the Admin SDK failed to initialise.
 */
export const adminAuth = {
  async verifyIdToken(idToken: string) {
    if (!_auth) {
      throw new Error(`Firebase Admin SDK not initialised: ${_initError ?? 'unknown error'}`);
    }
    return _auth.verifyIdToken(idToken);
  },
  async getUser(uid: string) {
    if (!_auth) {
      throw new Error(`Firebase Admin SDK not initialised: ${_initError ?? 'unknown error'}`);
    }
    return _auth.getUser(uid);
  },
  isInitialized: () => _auth !== null,
};
