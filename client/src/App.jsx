// src/App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import LandingPage from "./pages/public/LandingPage";
import AboutPage from "./pages/public/AboutPage";
import LoginPage from "./pages/public/LoginPage";
import SignUpPage from "./pages/public/SignUpPage";


import Dashboard from "./pages/pet-owner/Dashboard";

import AdminChangePassword from "./pages/admin/AdminChangePassword";

import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />


        {/* Pet Owner Protected route */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* Admin — first-login password change */}
        <Route
          path="/admin-change-password"
          element={
            <ProtectedRoute>
              <AdminChangePassword />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
