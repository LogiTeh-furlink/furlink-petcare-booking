/**
 * Authentication Routes (login, signup, logout, verify)
 * Supabase client is passed in from server.js to avoid early import issues.
 */
import express from "express";

const router = express.Router();

// this function will be called from server.js and injected with the supabase instance
export default function initAuthRoutes(supabase) {
  // Signup
  router.post("/signup", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password)
        return res.status(400).json({ error: "Email and password required" });

      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;

      res.status(201).json({ message: "Signup successful", data });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Login
  router.post("/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password)
        return res.status(400).json({ error: "Email and password required" });

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      res.status(200).json({
        message: "Login successful",
        token: data.session.access_token,
        user: data.user,
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Verify
  router.get("/verify", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader)
        return res.status(401).json({ error: "Missing Authorization header" });

      const token = authHeader.split(" ")[1];
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data?.user)
        return res.status(401).json({ valid: false, error: "Invalid token" });

      res.status(200).json({ valid: true, user: data.user });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
}
