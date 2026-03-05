import { getToken, messaging } from "../firebase-config";

export const requestNotificationPermission = async () => {
  try {
    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      return null;
    }

    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js"
    );

    if (!registration) {
      return null;
    }

    const token = await getToken(messaging!, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      return null;
    }

    return token;
  } catch (error) {
    console.error("Error Requesting Notification Permission:", error);
    return null;
  }
};
