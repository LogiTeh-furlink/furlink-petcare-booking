// src/components/RequireNewApplicant.jsx
import React, { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { supabase } from "../config/supabase";

export default function RequireNewApplicant() {
  const [isLoading, setIsLoading] = useState(true);
  const [redirectPath, setRedirectPath] = useState(null);

  useEffect(() => {
    const checkProviderStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data } = await supabase
          .from("service_providers")
          .select("status")
          .eq("user_id", user.id)
          .maybeSingle();

        // SCENARIO 1: They finished Step 1 but not Step 2
        if (data?.status === 'incomplete') {
          setRedirectPath("/service-setup");
        } 
        // SCENARIO 2: They finished everything
        else if (data?.status === 'pending' || data?.status === 'approved') {
          setRedirectPath("/dashboard");
        }
        
        // SCENARIO 3: No record OR status is 'rejected'
        // redirectPath stays null -> User is ALLOWED to stay on /apply-provider
      }
      setIsLoading(false);
    };

    checkProviderStatus();
  }, []);

  if (isLoading) return null;

  if (redirectPath) {
    return <Navigate to={redirectPath} replace />;
  }

  return <Outlet />;
}