// src/components/PageNotFoundRedirect.jsx
import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../config/supabase";

const PageNotFoundRedirect = () => {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (currentSession) {
        setSession(currentSession);
        // Fetch the user's specific role from your profiles table
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", currentSession.user.id)
          .single();
        
        setRole(profile?.role);
      }
      setLoading(false);
    };
    checkUser();
  }, []);

  if (loading) return null; // Or a small loading spinner

  // Case 1: Public User (No Session) -> Back to Login
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Case 2: Protected User (LoggedIn) -> Redirect based on Role
  if (role === "admin") {
    return <Navigate to="/admin-dashboard" replace />;
  }
  
  if (role === "service_provider" || role === "both") {
    return <Navigate to="/service/dashboard" replace />;
  }

  // Default fallback for Pet Owners
  return <Navigate to="/dashboard" replace />;
};

export default PageNotFoundRedirect;