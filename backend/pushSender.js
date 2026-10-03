const webpush = require("web-push");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

async function sendPushNotification(userId, title, body) {
  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (error) {
    console.error("Subscription fetch error:", error.message);
    return;
  }

  if (!subscriptions || subscriptions.length === 0) {
    console.log("No push subscription found for user.");
    return;
  }

  const payload = JSON.stringify({
    title,
    body,
  });

  for (const subscription of subscriptions) {
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    };

    try {
      await webpush.sendNotification(
        pushSubscription,
        payload
      );

      console.log(
        `Push notification sent to user: ${userId}`
      );
    } catch (error) {
      console.error(
        "Push notification error:",
        error.statusCode,
        error.message
      );

      // Remove expired subscriptions
      if (error.statusCode === 404 || error.statusCode === 410) {
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("id", subscription.id);

        console.log("Expired push subscription removed.");
      }
    }
  }
}

module.exports = {
  sendPushNotification,
};