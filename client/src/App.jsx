import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

// Public Pages
import LandingPage from "./pages/public/LandingPage";
import AboutPage from "./pages/public/AboutPage";
import LoginPage from "./pages/public/LoginPage";
import SignUpPage from "./pages/public/SignUpPage";

// Pet Owner Pages
import Dashboard from "./pages/pet-owner/Dashboard";
import ApplyProvider from "./pages/pet-owner/ApplyProvider";
import ServiceSetup from "./pages/pet-owner/ServiceSetup";
import ServiceListing from "./pages/pet-owner/ServiceListing";
import ListingInfo from "./pages/pet-owner/ListingInfo";
import PetDetails from "./pages/pet-owner/PetDetails"; 
import Appointments from "./pages/pet-owner/Appointments"; // ⭐ NEW IMPORT

// Service Provider Pages
import SPDashboard from "./pages/service-provider/SPDashboard";
import SPManageListing from "./pages/service-provider/SPManageListing";
import SPEditListing from "./pages/service-provider/SPEditListing";
import SPEditProfile from "./pages/service-provider/SPEditProfile";
import SPBookingDetails from "./pages/service-provider/SPBookingDetails";

// Admin Pages
import AdminChangePassword from "./pages/admin/AdminChangePassword";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminViewProvider from "./pages/admin/AdminViewProvider";

// Route Guards
import ProtectedRoute from "./components/ProtectedRoute";
import RequireNewApplicant from "./components/RequireNewApplicant";
import RequireProviderApplication from "./components/RequireProviderApplication";


function App() {
  return (
    <Router>
      <Routes>

        {/* ==========================
            PUBLIC ROUTES
            ========================== */}

        <Route path="/" element={<LandingPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />

        {/* ==========================
            PROTECTED ROUTES (Logged In)
            ========================== */}

        <Route element={<ProtectedRoute />}>

          {/* --- 1. PET OWNER SIDE --- */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/listing/:id" element={<ListingInfo />} />
          
          {/* Pet Owner Routes */}
          <Route path="/pet-details" element={<PetDetails />} />
          
          {/* ⭐ NEW ROUTE for Appointments */}
          <Route path="/appointments" element={<Appointments />} />
          
          
          {/* --- 2. SERVICE PROVIDER SIDE --- */}

          {/* ZONE A: Application Start (Only if NO application exists) */}
          <Route element={<RequireNewApplicant />}>
             <Route path="/apply-provider" element={<ApplyProvider />} />
          </Route>

          {/* ZONE B: Application Continued & Management (Requires application record) */}
          <Route element={<RequireProviderApplication />}>

            {/* Setup Flow (Initial Setup) */}
            <Route path="/service-setup" element={<ServiceSetup />} />
            <Route path="/service-listing" element={<ServiceListing />} />

            {/* Operational Dashboard (Main Business Hub) */}
            <Route path="/service/dashboard" element={<SPDashboard />} />
            <Route path="/service/dashboard/:id" element={<SPDashboard />} />
            <Route path="/service/booking-details/:id" element={<SPBookingDetails />} />

          
            {/* Listing Management */}
            <Route path="/service/manage-listing" element={<SPManageListing />} />
            <Route path="/service/edit-listing" element={<SPEditListing />} />
            <Route path="/service/edit-profile" element={<SPEditProfile />} />

          </Route>


          {/* --- 3. ADMIN SIDE --- */}
          <Route path="/admin-change-password" element={<AdminChangePassword />} />
          <Route path="/admin-dashboard" element={<AdminDashboard />} />
          <Route path="/admin/provider/:id" element={<AdminViewProvider />} />  


        </Route>
      </Routes>
    </Router>
  );
}

export default App;