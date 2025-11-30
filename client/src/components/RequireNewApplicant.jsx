import React, { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { supabase } from "../config/supabase";

export default function RequireNewApplicant() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasApplication, setHasApplication] = useState(false);

  useEffect(() => {
    const checkProviderStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Check if a service_provider record already exists for this user
        const { data, error } = await supabase
          .from("service_providers")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        // If data exists, it means they have already submitted ApplyProvider
        if (data) {
          setHasApplication(true);
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