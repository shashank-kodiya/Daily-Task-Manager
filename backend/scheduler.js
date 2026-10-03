const cron = require("node-cron");

const { createClient } = require("@supabase/supabase-js");

const { sendPushNotification } = require("./pushSender");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

async function checkTaskNotifications() {
  console.log("Checking task notifications...");

  const { data: tasks, error } = await supabase
    .from("tasks")
    .select(
      "id, user_id, title, task_date, task_time, status, morning_notified, reminder_notified"
    )
    .eq("status", "pending");

  if (error) {
    console.error("Scheduler Supabase error:", error.message);
    return;
  }

  if (!tasks || tasks.length === 0) {
    console.log("No pending tasks.");
    return;
  }

  const now = new Date();

  const indiaTime = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const values = {};

  indiaTime.forEach((part) => {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  });

  const currentDate =
    `${values.year}-${values.month}-${values.day}`;

  const currentHour = Number(values.hour);
  const currentMinute = Number(values.minute);

  const currentMinutes =
    currentHour * 60 + currentMinute;

  for (const task of tasks) {

    // -----------------------------
    // Morning notification - 8:00 AM
    // -----------------------------

    if (
      task.task_date === currentDate &&
      currentHour === 8 &&
      currentMinute === 0 &&
      !task.morning_notified
    ) {
      console.log(
        `🌅 MORNING REMINDER: ${task.title}`
      );

      await sendPushNotification(
        task.user_id,
        "🌅 Morning Task Reminder",
        `You have a task today: ${task.title}`
      );

      console.log(
        `User: ${task.user_id}`
      );

      await supabase
        .from("tasks")
        .update({
          morning_notified: true,
        })
        .eq("id", task.id);

      continue;
    }

    // -----------------------------
    // 10-minute reminder
    // -----------------------------

    if (!task.task_date || !task.task_time) {
      continue;
    }

    const [taskHour, taskMinute] =
      task.task_time.substring(0, 5).split(":").map(Number);

    const taskMinutes =
      taskHour * 60 + taskMinute;

    const reminderMinutes =
      taskMinutes - 10;

    if (
      task.task_date === currentDate &&
      currentMinutes === reminderMinutes &&
      !task.reminder_notified
    ) {
      console.log(
        `⏰ 10-MINUTE REMINDER: ${task.title}`
      );

      console.log(
        `Task time: ${task.task_time}`
      );

      console.log(
        `User: ${task.user_id}`
      );

      await sendPushNotification(
        task.user_id,
        "⏰ Task Reminder",
        `${task.title} starts in 10 minutes.`
      );

      await supabase
        .from("tasks")
        .update({
          reminder_notified: true,
        })
        .eq("id", task.id);
    }
  }
}

// Run every minute
cron.schedule("* * * * *", () => {
  checkTaskNotifications();
}, {
  timezone: "Asia/Kolkata",
});

console.log("🔔 Notification scheduler started.");