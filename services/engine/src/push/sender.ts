import { cert, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import type { Env } from "../env.js";

export interface PushMessage {
  fcmToken: string;
  title: string;
  body: string;
  /** I valori devono essere stringhe: è un vincolo del payload `data` di FCM. */
  data: Record<string, string>;
}

export interface PushSender {
  /** Ritorna l'id messaggio FCM. Lancia in caso di errore (token invalido, rete, ecc). */
  send(message: PushMessage): Promise<string>;
}

export interface FirebaseServiceAccountCredentials {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

export function createFirebasePushSender(
  credentials: FirebaseServiceAccountCredentials,
): PushSender {
  const app = initializeApp({
    credential: cert({
      projectId: credentials.projectId,
      clientEmail: credentials.clientEmail,
      // Le chiavi private nei .env hanno spesso "\n" letterali al posto di newline reali.
      privateKey: credentials.privateKey.replace(/\\n/g, "\n"),
    }),
  });
  const messaging = getMessaging(app);

  return {
    send({ fcmToken, title, body, data }) {
      return messaging.send({
        token: fcmToken,
        notification: { title, body },
        data,
        android: { priority: "high" },
      });
    },
  };
}

/** Nessuna credenziale Firebase configurata: le notifiche restano "pending", mai inviate. */
export const NULL_PUSH_SENDER: PushSender = {
  async send() {
    throw new Error(
      "Push non configurato: FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY mancanti",
    );
  },
};

export function createPushSender(env: Env): PushSender {
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = env;
  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    return NULL_PUSH_SENDER;
  }
  return createFirebasePushSender({
    projectId: FIREBASE_PROJECT_ID,
    clientEmail: FIREBASE_CLIENT_EMAIL,
    privateKey: FIREBASE_PRIVATE_KEY,
  });
}
