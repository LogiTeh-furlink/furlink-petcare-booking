// src/components/ProtectedRoute.jsx
import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../config/supabase";

const ProtectedRoute = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data: sessionData } = await supabase.auth.getSession();

      if (sessionData?.session) {
        setAuthenticated(true);
      } else {
        setAuthenticated(false);
      }

      setIsLoading(false);
    };

    checkSession();

    // Listen for auth changes (logout or session expiration)
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

  if (!authenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
