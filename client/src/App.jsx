import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

// Public Pages
import LandingPage from "./pages/public/LandingPage";
import AboutPage from "./pages/public/AboutPage";
import LoginPage from "./pages/public/LoginPage";
import SignUpPage from "./pages/public/SignUpPage";
import PlatformWaiver from "./pages/public/PlatformWaiver";
import PlatformTerms from "./pages/public/PlatformTerms";     // <--- ADDED IMPORT
import PlatformPrivacy from "./pages/public/PlatformPrivacy"; // <--- ADDED IMPORT

// REMOVED: import SuspendedPage from "./pages/public/SuspendedPage"; 

// Pet Owner Pages
import Dashboard from "./pages/pet-owner/Dashboard";
import ApplyProvider from "./pages/pet-owner/ApplyProvider";
import ServiceSetup from "./pages/pet-owner/ServiceSetup";
import ServiceListing from "./pages/pet-owner/ServiceListing";
import ListingInfo from "./pages/pet-owner/ListingInfo";
import PetDetails from "./pages/pet-owner/PetDetails"; 
import BookingSuccess from "./pages/pet-owner/BookingSuccess";
import Appointments from "./pages/pet-owner/Appointments"; 
import BookingHistory from "./pages/pet-owner/BookingHistory";
import MyPets from "./pages/pet-owner/MyPets";
import UserProfile from "./pages/pet-owner/UserProfile";
import Payment from "./pages/pet-owner/Payment"; 

// Service Provider Pages
import SPDashboard from "./pages/service-provider/SPDashboard";
import SPBusinessDashboard from "./pages/service-provider/SPBusinessDashboard"; 
import SPSales from "./pages/service-provider/SPSales"; 
import SPCustomerInsight from "./pages/service-provider/SPCustomerInsight"; 
import SPManageListing from "./pages/service-provider/SPManageListing";
import SPEditListing from "./pages/service-provider/SPEditListing";
import SPEditProfile from "./pages/service-provider/SPEditProfile";
import SPBookingDetails from "./pages/service-provider/SPBookingDetails";

// Admin Pages
import AdminChangePassword from "./pages/admin/AdminChangePassword";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminViewProvider from "./pages/admin/AdminViewProvider";
import AdminViewBooking from "./pages/admin/AdminViewBooking"; 
import AdminSPInsights from "./pages/admin/AdminSPInsights";
import AdminPOInsights from "./pages/admin/AdminPOInsights";

// Route Guards
import ProtectedRoute from "./components/ProtectedRoute";
import SuspensionGuard from "./components/SuspensionGuard"; 
import RequireNewApplicant from "./components/RequireNewApplicant";
import RequireProviderApplication from "./components/RequireProviderApplication";
import PageNotFoundRedirect from "./components/PageNotFoundRedirect";


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
        
        {/* --- ADDED PLATFORM LEGAL ROUTES --- */}
        <Route path="/platform-waiver" element={<PlatformWaiver />} />
        <Route path="/terms-and-conditions" element={<PlatformTerms />} />
        <Route path="/privacy-policy" element={<PlatformPrivacy />} />

        {/* ==========================
            PROTECTED ROUTES (Logged In)
            ========================== */}

        <Route element={<ProtectedRoute />}>

          {/* ⭐ SUSPENSION GUARD: Wraps all functional pages to check for Auto-Reactivation */}
          {/* Note: Suspended users will now pass through here to the dashboard */}
          <Route element={<SuspensionGuard />}>

            {/* --- 1. PET OWNER / GENERAL USER SIDE --- */}
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/listing/:id" element={<ListingInfo />} />
            
            {/* User & Pet Management */}
            <Route path="/pet-details" element={<PetDetails />} />
            <Route path="/appointments" element={<Appointments />} />
            <Route path="/booking-history" element={<BookingHistory />} />
            <Route path="/my-pets" element={<MyPets />} />
            <Route path="/profile" element={<UserProfile />} />
            <Route path="/payment/:id" element={<Payment />} />
            <Route path="/booking-success" element={<BookingSuccess />} />

            {/* --- 2. SERVICE PROVIDER SIDE --- */}

            {/* ZONE A: Application Start */}
            <Route element={<RequireNewApplicant />}>
                <Route path="/apply-provider" element={<ApplyProvider />} />
            </Route>

            {/* ZONE B: Application Continued */}
            <Route element={<RequireProviderApplication />}>
              <Route path="/service-setup" element={<ServiceSetup />} />
              <Route path="/service-listing" element={<ServiceListing />} />
              <Route path="/service/dashboard" element={<SPDashboard />} />
              <Route path="/service/dashboard/:id" element={<SPDashboard />} />
              <Route path="/service/sales" element={<SPSales />} /> 
              <Route path="/service/business-dashboard" element={<SPBusinessDashboard />} />
              <Route path="/service/customer-insight" element={<SPCustomerInsight />} />
              <Route path="/service/booking-details/:id" element={<SPBookingDetails />} />
              <Route path="/service/manage-listing" element={<SPManageListing />} />
              <Route path="/service/edit-listing" element={<SPEditListing />} />
              <Route path="/service/edit-profile" element={<SPEditProfile />} />
            </Route>

            {/* --- 3. ADMIN SIDE --- */}
            <Route path="/admin-change-password" element={<AdminChangePassword />} />
            <Route path="/admin-dashboard" element={<AdminDashboard />} />
            <Route path="/admin/provider/:id" element={<AdminViewProvider />} /> 
            <Route path="/admin/user-bookings/:id" element={<AdminViewBooking />} /> 
            <Route path="/admin/service-provider-insights" element={<AdminSPInsights />} />
            <Route path="/admin/pet-owner-insights" element={<AdminPOInsights />} />

          </Route> {/* End SuspensionGuard */}
        </Route> {/* End ProtectedRoute */}
         <Route path="*" element={<PageNotFoundRedirect />} /> 
      </Routes>
    </Router>
  );
}

export default App;