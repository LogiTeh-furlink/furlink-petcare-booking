// src/components/RequireProviderApplication.jsx
import React, { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { supabase } from "../config/supabase";

export default function RequireProviderApplication() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasApplication, setHasApplication] = useState(false);

  useEffect(() => {
    const checkProviderStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Check if they have a provider record
        const { data } = await supabase
          .from("service_providers")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        // If data exists, they are allowed to proceed
        if (data) {
          setHasApplication(true);
        }
      }
      setIsLoading(false);
    };

    checkProviderStatus();
  }, []);

  if (isLoading) return null; // Or a loading spinner

  // ⛔ If no application found, force them back to the start
  if (!hasApplication) {
    return <Navigate to="/apply-provider" replace />;
  }

  // ✅ Otherwise, render the protected page
  return <Outlet />;
}