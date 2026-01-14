import React, { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { supabase } from "../config/supabase";

export default function RequireNewApplicant() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasApplication, setHasApplication] = useState(false);

  useEffect(() => {
    // Inside RequireNewApplicant.jsx
    const checkProviderStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data } = await supabase
          .from("service_providers")
          .select("status")
          .eq("user_id", user.id)
          .maybeSingle();

        // CHANGE: Only redirect if they have an active or finished application
        // If data is null OR status is 'rejected', we let them stay on /apply-provider
        if (data && (data.status === 'pending' || data.status === 'approved')) {
          setShouldRedirect(true);
        }
      }
      setIsLoading(false);
    };

    checkProviderStatus();
  }, []);

  if (isLoading) return null; // Or a loading spinner

  // If they already applied, force them to the next step
  if (hasApplication) {
    return <Navigate to="/service-setup" replace />;
  }

  // Otherwise, let them view the ApplyProvider page
  return <Outlet />;
}