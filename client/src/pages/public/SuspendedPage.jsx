import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import { FaUserLock, FaCalendarAlt, FaSignOutAlt, FaExclamationTriangle } from "react-icons/fa";

export default function SuspendedPage() {
  const navigate = useNavigate();
  const [endDate, setEndDate] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate("/login");

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_active, suspension_end_date")
        .eq("id", user.id)
        .single();
      
      // If the account is active or has no suspension date, they shouldn't be here
      if (profile?.is_active || !profile?.suspension_end_date) {
         return navigate("/dashboard");
      }
      
      setEndDate(profile.suspension_end_date);
      setLoading(false);
    };
    fetchStatus();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  if (loading) return <div className="profile-loading">Checking status...</div>;

  return (
    <div className="profile-page-wrapper" style={{ justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <div className="profile-container" style={{ maxWidth: '600px', borderRadius: '20px', textAlign: 'center', height: 'auto', flex: 'none', padding: '40px' }}>
        <div className="header-icon" style={{ backgroundColor: '#fee2e2', color: '#ef4444', margin: '0 auto 20px' }}>
          <FaUserLock />
        </div>
        <h1 style={{ color: '#0E2679', fontSize: '2rem' }}>Account Suspended</h1>
        <p style={{ color: '#64748b', marginBottom: '30px' }}>
          Your access to FurLink has been temporarily restricted by an administrator due to multiple policy violations.
        </p>

        <div className="security-section" style={{ textAlign: 'left', marginBottom: '30px', backgroundColor: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <FaCalendarAlt size={24} color="#0E2679" />
            <div>
              <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                Restoration Date
              </label>
              <strong style={{ fontSize: '1.1rem', color: '#0E2679' }}> {/* Updated to Dark Blue */}
                {new Date(endDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </strong>
            </div>
          </div>
        </div>

        <div className="general-error-banner" style={{ fontSize: '0.85rem', textAlign: 'left', margin: '0 0 30px 0' }}>
          <FaExclamationTriangle /> While suspended, you cannot book services, manage listings, or update profile info. Access is restored automatically on the date above.
        </div>

        <button 
          className="save-btn" 
          style={{ 
            width: '100%', 
            backgroundColor: '#0E2679', 
            justifyContent: 'center', 
            padding: '15px' 
          }} 
          onClick={handleLogout}
        >
          <FaSignOutAlt /> Sign Out and Return to Login
        </button>
      </div>
    </div>
  );
}