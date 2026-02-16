import React, { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { supabase } from "../config/supabase";

export default function SuspensionGuard() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Fetch profile to check status
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_active, suspension_end_date")
        .eq("id", user.id)
        .single();

      // LOGIC: We no longer BLOCK. We only check for REACTIVATION.

      // CASE 1: Has a suspension date?
      if (profile?.suspension_end_date) {
        const endDate = new Date(profile.suspension_end_date);
        const now = new Date();

        // If suspension time has passed, REACTIVATE them automatically.
        if (now > endDate) {
          await reactivateUser(user.id);
        }
        // If time hasn't passed, we DO NOTHING. 
        // We let them proceed to the Dashboard (read-only mode handled by UI later).
      } 
      
      // CASE 2: Inactive but NO suspension date (Voluntary Deactivation)
      // Since they logged in, we assume they want to come back.
      else if (profile?.is_active === false) {
        await reactivateUser(user.id);
      }

    } catch (error) {
      console.error("Suspension check failed:", error);
    } finally {
      setLoading(false);
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

  if (loading) return null; // Or a simple loading spinner if you prefer

  // ALWAYS render the child routes (Dashboard, etc.)
  // The UI inside these pages will now be responsible for showing "Restricted" states.
  return <Outlet />;
}