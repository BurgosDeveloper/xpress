import admin from "firebase-admin";
import fs from "fs";
import { env } from "../utils/env";

let app: admin.app.App | null = null;

function loadServiceAccount(): object | null {
  if (env.FCM_SERVICE_ACCOUNT_JSON_B64) {
    const raw = Buffer.from(env.FCM_SERVICE_ACCOUNT_JSON_B64, "base64").toString("utf-8");
    return JSON.parse(raw);
  }

  if (env.FCM_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(env.FCM_SERVICE_ACCOUNT_JSON);
  }

  if (env.FCM_SERVICE_ACCOUNT_PATH) {
    const raw = fs.readFileSync(env.FCM_SERVICE_ACCOUNT_PATH, "utf-8");
    return JSON.parse(raw);
  }

  return null;
}

export function getFCMOrNull() {
  const serviceAccount = loadServiceAccount();
  if (!serviceAccount) return null;

  if (!app) {
    app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    });
  }

  return admin.messaging(app);
}
