/**
 * FURLINK BACKEND SERVER (Express + Supabase)
 * -------------------------------------------
 * Safe version: loads .env before any Supabase usage,
 * then registers routes after everything is ready.
 */

import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// 1️⃣ Load environment variables first
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// 2️⃣ Verify env variables are present
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env");
  process.exit(1);
}

// 3️⃣ Import other modules AFTER dotenv is loaded
import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

// Optional: import routes AFTER Supabase is created
import authRoutes from "./routes/authRoutes.js";

// 4️⃣ Create Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// 5️⃣ Express setup
const app = express();
app.use(
  cors({
    origin: [
      "http://localhost:5173",          // local dev
      "https://furlink-one.vercel.app"  // production
    ],
    credentials: true,
  })
);
app.use(express.json());

// 6️⃣ Health check route
app.get("/", (req, res) => {
  res.send("🐾 Furlink API is running...");
});

// 7️⃣ Supabase test route
app.get("/test-supabase", async (req, res) => {
  try {
    const { data, error } = await supabase.from("profiles").select("id").limit(1);
    if (error) throw error;
    res.json({ success: true, message: "Supabase connection OK ✅", data });
  } catch (err) {
    console.error("Supabase test error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// 8️⃣ Attach auth routes
app.use("/auth", authRoutes);

// 9️⃣ Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
