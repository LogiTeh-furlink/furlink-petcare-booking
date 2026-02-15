import React, { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { supabase } from "../config/supabase";

export default function SuspensionGuard() {
  const [status, setStatus] = useState("checking"); // checking | allowed | blocked
  const location = useLocation();

  useEffect(() => {
    checkStatus();
  }, [location.pathname]);

  const checkStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setStatus("allowed"); // Let ProtectedRoute handle the redirect to login
        return;
      }

      // Fetch the columns we need for the logic
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_active, suspension_end_date")
        .eq("id", user.id)
        .single();

      // CASE 1: User is active. Let them pass.
      if (profile?.is_active) {
        setStatus("allowed");
        return;
      }

      // CASE 2: User is INACTIVE. Check why.
      // If there is a suspension_end_date, it's an Admin Suspension.
      if (profile?.suspension_end_date) {
        const endDate = new Date(profile.suspension_end_date);
        const now = new Date();

        if (now < endDate) {
          // SUSPENDED and time is NOT up -> BLOCK
          setStatus("blocked"); 
        } else {
          // SUSPENDED but time IS up -> REACTIVATE AUTOMATICALLY
          await reactivateUser(user.id);
          setStatus("allowed");
        }
      } else {
        // CASE 3: Inactive but NO suspension date.
        // This means the user voluntarily deactivated their account previously.
        // Since they just logged in successfully, we reactivate them now.
        await reactivateUser(user.id);
        setStatus("allowed");
      }

    } catch (error) {
      console.error("Suspension check failed:", error);
      setStatus("allowed"); // Fail-safe: allow access if DB check fails so we don't lock everyone out
    }
  };

  const reactivateUser = async (userId) => {
    await supabase
      .from('profiles')
      .update({ 
        is_active: true, 
        suspension_end_date: null // Clear the timer
      })
      .eq('id', userId);
  };

  if (status === "checking") return null; // Or return <div className="loading">Checking...</div>

  if (status === "blocked") {
    return <Navigate to="/suspended" replace />;
  }

  return <Outlet />;
}