// src/components/ProtectedRoute.jsx
import React, { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { supabase } from "../config/supabase";

export default function ProtectedRoute() {
  const [isLoading, setIsLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data: sessionData } = await supabase.auth.getSession();

      setAuthenticated(!!sessionData?.session);
      setIsLoading(false);
    };

    checkSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setAuthenticated(!!session);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  if (isLoading) return null;

  if (!authenticated) return <Navigate to="/login" replace />;

  return <Outlet />;
}
