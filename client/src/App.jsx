import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import LandingPage from "./pages/public/LandingPage";
import AboutPage from "./pages/public/AboutPage";
import LoginPage from "./pages/public/LoginPage";
import SignUpPage from "./pages/public/SignUpPage";

import Dashboard from "./pages/pet-owner/Dashboard";
import ApplyProvider from "./pages/pet-owner/ApplyProvider";
import ServiceSetup from "./pages/pet-owner/ServiceSetup";
import ServiceSetupPackage from "./pages/pet-owner/ServiceSetupPackage";
import ServiceSetupIndiv from "./pages/pet-owner/ServiceSetupIndiv";

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

        {/* Protected routes (React Router v6 format) */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/apply-provider" element={<ApplyProvider />} />
          <Route path="/service-setup" element={<ServiceSetup />} />
          <Route path="/service-setup-package" element={<ServiceSetupPackage />} />
          <Route path="/service-setup-indiv" element={<ServiceSetupIndiv />} />
          <Route path="/admin-change-password" element={<AdminChangePassword />} />
        </Route>

      </Routes>
    </Router>
  );
}

export default App;
