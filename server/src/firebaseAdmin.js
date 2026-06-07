const admin = require("firebase-admin");

let initialized = false;

function initFirebaseAdmin() {
  if (initialized) {
    return;
  }

  const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;

  if (serviceAccountRaw) {
    const serviceAccount = JSON.parse(serviceAccountRaw);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id || projectId
    });
    initialized = true;
    return;
  }

  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId
  });
  initialized = true;
}

function getAuth() {
  initFirebaseAdmin();
  return admin.auth();
}

module.exports = {
  getAuth
};
