/**
 * authService.js
 * -------------------------------------------------
 * Handles login, signup, verification, and logout
 * via the Express backend and Supabase Auth.
 */

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export const authService = {
  // --- Sign up ---
  async signup(email, password) {
    const res = await fetch(`${API_URL}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Signup failed");
    return data;
  },

  // --- Log in ---
  async login(email, password) {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");

    // Save token
    localStorage.setItem("access_token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    return data.user;
  },

  // --- Verify token ---
  async verify() {
    const token = localStorage.getItem("access_token");
    if (!token) return null;

    const res = await fetch(`${API_URL}/auth/verify`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!data.valid) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user");
      return null;
    }
    return data.user;
  },

  // --- Logout ---
  async logout() {
    const token = localStorage.getItem("access_token");
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
  },
};
