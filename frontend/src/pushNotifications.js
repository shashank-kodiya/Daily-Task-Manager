import { supabase } from "./lib/supabase";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);

  return Uint8Array.from(
    [...rawData].map((char) => char.charCodeAt(0))
  );
}

export async function subscribeToPush(userId) {
  console.log(
    "VAPID key loaded:",
    !!import.meta.env.VITE_VAPID_PUBLIC_KEY
  );
  
  try {
    const registration = await navigator.serviceWorker.ready;

    const existingSubscription =
      await registration.pushManager.getSubscription();

    const subscription =
      existingSubscription ||
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          import.meta.env.VITE_VAPID_PUBLIC_KEY
        ),
      }));

    const subscriptionJSON = subscription.toJSON();

    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          user_id: userId,
          endpoint: subscriptionJSON.endpoint,
          p256dh: subscriptionJSON.keys.p256dh,
          auth: subscriptionJSON.keys.auth,
        },
        {
          onConflict: "endpoint",
        }
      );

    if (error) {
      console.error("Push subscription database error:", error);
      return false;
    }

    console.log("Push subscription saved successfully.");
    return true;
  } catch (error) {
    console.error("Push subscription error:", error);
    return false;
  }
}