import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { 
  FaBell, 
  FaUserCircle, 
  FaSignOutAlt, 
  FaTimes, 
  FaStore, 
  FaListUl, 
  FaExclamationCircle,
  FaCalendarAlt,
  FaUser,
  FaExchangeAlt
} from "react-icons/fa";
import { supabase } from "../../config/supabase";
import "./LoggedInNavbar.css";
import logo from "../../assets/logo.png";

const LoggedInNavbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // UI Toggles
  const [showNotif, setShowNotif] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);

  // Data State
  const [notifications, setNotifications] = useState([]);
  const [profile, setProfile] = useState(null);
  const [providerData, setProviderData] = useState(null); 
  const [hasServices, setHasServices] = useState(false); 

  const notifRef = useRef();
  const menuRef = useRef();

  const currentPath = location.pathname;
  const isServiceProviderPage = currentPath.startsWith("/service/");

  /* ==========================
      PATH-BASED VISIBILITY LOGIC
     ========================== */
  
  const hideBecomeProviderAction = [
    "/apply-provider", 
    "/service-setup", 
    "/service-listing"
  ].includes(currentPath);

  const hideProfileOption = currentPath === "/profile";

  const hideAppointmentsOption = [
    "/appointments", 
    "/booking-history"
  ].includes(currentPath) || currentPath.startsWith("/payment/");

  // New Logic: Hide "Manage Listing" if already on service management pages
  const hideManageListingOption = [
    "/service/manage-listing",
    "/service/edit-listing",
    "/service/edit-profile"
  ].includes(currentPath);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate("/login");

      const { data: profileData } = await supabase
        .from("profiles")
        .select("first_name, role")
        .eq("id", user.id)
        .single();
      setProfile(profileData);

      const { data: notifData } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      setNotifications(notifData || []);

      const { data: provider } = await supabase
        .from("service_providers")
        .select("id, status, business_name, rejection_reasons")
        .eq("user_id", user.id)
        .maybeSingle();

      if (provider) {
        setProviderData(provider);
        const { count } = await supabase
          .from("services")
          .select("*", { count: 'exact', head: true })
          .eq("provider_id", provider.id);
        
        setHasServices(count > 0);
      }
    };

    fetchData();
  }, [navigate]);

  const userRole = profile?.role; 
  const providerStatus = providerData?.status;
  const isStrictProvider = userRole === 'service_provider';
  const isApproved = providerStatus === 'approved';
  
  // Logic for showing Manage Listing: Role must be 'service_provider' or 'both'
  const canManageListing = (userRole === 'service_provider' || userRole === 'both') && isApproved;

  const handleProviderClick = () => {
    if (!providerData) return navigate("/apply-provider");
    if (isApproved) {
      navigate(isServiceProviderPage ? "/dashboard" : "/service/dashboard");
      return;
    }
    if (providerStatus === "rejected") {
      setShowRejectModal(true);
    } else if (providerStatus === "pending") {
      if (hasServices) {
        setShowPendingModal(true);
      } else {
        navigate("/service-setup");
      }
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("token");
    navigate("/");
  };

  const formatReason = (str) => {
    if (!str) return "";
    return str.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false);
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      <header className="loggedin-header">
        <div className="navbar-container">
          <div className="header-left" onClick={() => navigate("/dashboard")}>
            <img src={logo} alt="Furlink logo" className="header-logo" />
          </div>

          <div className="nav-right">
            {!isStrictProvider && !hideBecomeProviderAction && (
              <button 
                className={`provider-btn ${isApproved ? 'business-mode' : ''}`}
                onClick={handleProviderClick}
              >
                {isApproved 
                  ? (isServiceProviderPage ? "Switch to Pet Owner" : `Switch to ${providerData.business_name}`) 
                  : "Become a Service Provider"}
              </button>
            )}

            <div ref={notifRef} className="notif-wrapper">
              <button className="icon-btn" onClick={() => setShowNotif(!showNotif)}>
                <FaBell className="icon" />
                {notifications.filter(n => !n.read).length > 0 && <span className="notif-dot" />}
              </button>
            </div>

            <div ref={menuRef} className="profile-wrapper">
              <button className="icon-btn" onClick={() => setShowMenu(!showMenu)}>
                <FaUserCircle className="icon" />
              </button>

              {showMenu && (
                <div className="dropdown profile-dropdown">
                  <p className="user-name">Hi, {profile?.first_name || "User"}</p>
                  
                  {!hideProfileOption && (
                    <button className="menu-item-btn" onClick={() => { navigate("/profile"); setShowMenu(false); }}>
                      <FaUser className="menu-icon" /> Profile
                    </button>
                  )}

                  {/* ADDED: Manage Listing Option */}
                  {canManageListing && !hideManageListingOption && (
                    <button className="menu-item-btn" onClick={() => { navigate("/service/manage-listing"); setShowMenu(false); }}>
                      <FaStore className="menu-icon" /> Manage Listing
                    </button>
                  )}

                  {!isStrictProvider && !hideAppointmentsOption && (
                    <button className="menu-item-btn" onClick={() => { navigate("/appointments"); setShowMenu(false); }}>
                      <FaCalendarAlt className="menu-icon" /> Appointments
                    </button>
                  )}

                  <button className="logout-btn" onClick={handleLogout}>
                    <FaSignOutAlt className="menu-icon" /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* MODALS REMAIN UNCHANGED */}
      {showPendingModal && (
        <div className="modal-overlay">
          <div className="modal-content pending-modal">
            <button className="close-modal-btn" onClick={() => setShowPendingModal(false)}><FaTimes /></button>
            <div className="modal-icon-wrapper pending"><FaListUl /></div>
            <h3>Application Under Review</h3>
            <p>Your application for <strong>{providerData?.business_name}</strong> has been submitted and is currently being reviewed by our team.</p>
            <button className="modal-ok-btn" onClick={() => setShowPendingModal(false)}>Got it</button>
          </div>
        </div>
      )}

      {showRejectModal && (
        <div className="modal-overlay">
          <div className="modal-content reject-modal">
            <button className="close-modal-btn" onClick={() => setShowRejectModal(false)}><FaTimes /></button>
            <div className="modal-icon-wrapper reject"><FaTimes /></div>
            <h3>Application Rejected</h3>
            <p>Your application was not approved at this time.</p>
            {providerData?.rejection_reasons && providerData.rejection_reasons.length > 0 && (
              <div className="rejection-details-box">
                <p className="reject-reason-title"><FaExclamationCircle /> <strong>Reason(s):</strong></p>
                <ul className="reject-reason-list">
                  {providerData.rejection_reasons.map((reason, idx) => (
                    <li key={idx} className="reject-reason-item">{formatReason(reason)}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="modal-actions">
                <button className="modal-ok-btn reject-bg" onClick={() => navigate("/apply-provider")}>Re-apply</button>
                <button className="modal-cancel-btn" onClick={() => setShowRejectModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LoggedInNavbar;