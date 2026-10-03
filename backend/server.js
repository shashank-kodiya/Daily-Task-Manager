const express = require("express");
const cors = require("cors");
require("dotenv").config();

require("./scheduler");

const { createClient } = require("@supabase/supabase-js");

const app = express();

app.use(cors());
app.use(express.json());

// Supabase connection
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

// Test route
app.get("/", (req, res) => {
  res.send("Daily Task Manager Backend is running!");
});

// Test Supabase connection
app.get("/api/test-push/:userId", async (req, res) => {
  const { sendPushNotification } = require("./pushSender");

  await sendPushNotification(
    req.params.userId,
    "🔔 Test Notification",
    "Your Daily Task Manager push notification is working!"
  );

  res.json({
    success: true,
    message: "Test push notification sent."
  });
});

const PORT = 5000;

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});