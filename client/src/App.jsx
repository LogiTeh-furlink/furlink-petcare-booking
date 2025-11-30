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
import RequireNewApplicant from "./components/RequireNewApplicant"; 
import RequireProviderApplication from "./components/RequireProviderApplication"; // <--- Import the new guard

function App() {
  return (
    <Router>
      <Routes>

        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />

        {/* --- LOGGED IN USER AREA --- */}
        <Route element={<ProtectedRoute />}>
          
          <Route path="/dashboard" element={<Dashboard />} />
          
          {/* ZONE A: Only accessible if you HAVE NOT applied yet */}
          {/* If they have applied, this kicks them to /service-setup */}
          <Route element={<RequireNewApplicant />}>
             <Route path="/apply-provider" element={<ApplyProvider />} />
          </Route>

          {/* ZONE B: Only accessible if you HAVE applied */}
          {/* If they try to skip here without applying, this kicks them back to /apply-provider */}
          <Route element={<RequireProviderApplication />}>
            <Route path="/service-setup" element={<ServiceSetup />} />
            <Route path="/service-listing" element={<ServiceListing />} />
          </Route>
          
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