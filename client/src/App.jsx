import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import LandingPage from "./pages/public/LandingPage";
import AboutPage from "./pages/public/AboutPage";
import LoginPage from "./pages/public/LoginPage";
import SignUpPage from "./pages/public/SignUpPage";

import Dashboard from "./pages/pet-owner/Dashboard";
import ApplyProvider from "./pages/pet-owner/ApplyProvider";
import ServiceSetup from "./pages/pet-owner/ServiceSetup";
import ServiceListing from "./pages/pet-owner/ServiceListing";

import AdminChangePassword from "./pages/admin/AdminChangePassword";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminViewProvider from "./pages/admin/AdminViewProvider";

import ProtectedRoute from "./components/ProtectedRoute";
import RequireNewApplicant from "./components/RequireNewApplicant"; // <--- IMPORT THIS

function App() {
  return (
    <Router>
      <Routes>

        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />

        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
          
          <Route path="/dashboard" element={<Dashboard />} />
          
          {/* ⭐ NESTED GUARD: Only allow if they have NO application yet */}
          <Route element={<RequireNewApplicant />}>
             <Route path="/apply-provider" element={<ApplyProvider />} />
          </Route>

          <Route path="/service-setup" element={<ServiceSetup />} />
          <Route path="/service-listing" element={<ServiceListing />} />
          
          {/* Admin Routes */}
          <Route path="/admin-change-password" element={<AdminChangePassword />} />
          <Route path="/admin-dashboard" element={<AdminDashboard />} />
          <Route path="/admin/provider/:id" element={<AdminViewProvider />} />  
        </Route>

      </Routes>
    </Router>
  );
}

export default App;