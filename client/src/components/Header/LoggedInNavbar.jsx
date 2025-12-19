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
  FaUser // Added FaUser for the Profile icon
} from "react-icons/fa";
import { supabase } from "../../config/supabase";
import "./LoggedInNavbar.css";
import logo from "../../assets/logo.png";

const LoggedInNavbar = ({ hideBecomeProvider = false }) => {
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
  
  // Provider Logic State
  const [providerData, setProviderData] = useState(null); 
  const [hasServices, setHasServices] = useState(false); 

  const notifRef = useRef();
  const menuRef = useRef();

  /* ==========================
      FETCH DATA
     ========================== */
  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate("/login");

      // 1. Fetch Profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("first_name")
        .eq("id", user.id)
        .single();
      setProfile(profileData);

      // 2. Fetch Notifications
      const { data: notifData } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      setNotifications(notifData || []);

      // 3. Fetch Provider Data
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

  /* ==========================
      LOGIC HANDLERS
     ========================== */
  const isServiceProviderPage = location.pathname.startsWith("/service/");

  const handleProviderClick = () => {
    if (!providerData) {
      navigate("/apply-provider");
      return;
    }
    const { status } = providerData;

    if (status === "approved") {
      navigate("/service/dashboard");
    } else if (status === "rejected") {
      setShowRejectModal(true);
    } else if (status === "pending") {
      if (hasServices) {
        setShowPendingModal(true);
      } else {
        navigate("/service-setup");
      }
    }
  };

  const handleNotifClick = async (notif) => {
    if (!notif.read) {
      await supabase.from("notifications").update({ read: true }).eq("id", notif.id);
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
    }
    const title = notif.title?.toLowerCase() || "";
    if (title.includes("approved")) {
      navigate("/service/dashboard");
      setShowNotif(false);
    } else if (title.includes("rejected")) {
      setShowRejectModal(true);
      setShowNotif(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("token");
    navigate("/");
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false);
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const formatReason = (str) => {
    if (!str) return "";
    return str.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <>
      <header className="loggedin-header">
        <div className="navbar-container">
          {/* Left Logo */}
          <div className="header-left" onClick={() => navigate("/dashboard")}>
            <img src={logo} alt="Furlink logo" className="header-logo" />
          </div>

          {/* Right Section */}
          <div className="nav-right">
            {!hideBecomeProvider && !isServiceProviderPage && (
              <button 
                className={`provider-btn ${providerData?.status === 'approved' ? 'business-mode' : ''}`}
                onClick={handleProviderClick}
              >
                {providerData?.status === 'approved' 
                  ? `Switch to ${providerData.business_name}` 
                  : "Become a Service Provider"}
              </button>
            )}

            {/* Notifications */}
            <div ref={notifRef} className="notif-wrapper">
              <button className="icon-btn" onClick={() => setShowNotif(!showNotif)}>
                <FaBell className="icon" />
                {unreadCount > 0 && <span className="notif-dot">{unreadCount}</span>}
              </button>

              {showNotif && (
                <div className="notif-dropdown">
                  <div className="dropdown-header">Notifications</div>
                  {notifications.length === 0 ? (
                    <div className="notif-empty">No notifications</div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={`notif-item ${notif.read ? "read" : "unread"}`}
                        onClick={() => handleNotifClick(notif)}
                      >
                        <div className="notif-title">{notif.title}</div>
                        <div className="notif-msg">{notif.message}</div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Profile Menu */}
            <div ref={menuRef} className="profile-wrapper">
              <button className="icon-btn" onClick={() => setShowMenu(!showMenu)}>
                <FaUserCircle className="icon" />
              </button>

              {showMenu && (
                <div className="dropdown profile-dropdown">
                  <p className="user-name">Hi, {profile?.first_name || "User"}</p>
                  
                  {/* --- NEW: Profile Button --- */}
                  <button 
                    className="menu-item-btn" 
                    onClick={() => {
                      navigate("/profile");
                      setShowMenu(false);
                    }}
                  >
                    <FaUser className="menu-icon" /> Profile
                  </button>

                  {providerData?.status === 'approved' && (
                    <button 
                      className="menu-item-btn" 
                      onClick={() => navigate("/service/manage-listing")}
                    >
                      <FaStore className="menu-icon" /> Manage Listing
                    </button>
                  )}

                  <button 
                    className="menu-item-btn" 
                    onClick={() => {
                      navigate("/appointments");
                      setShowMenu(false);
                    }}
                  >
                    <FaCalendarAlt className="menu-icon" /> Appointments
                  </button>

                  <button className="logout-btn" onClick={handleLogout}>
                    <FaSignOutAlt className="menu-icon" /> Logout
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      </header>

      {/* Modals remain unchanged */}
      {showPendingModal && (
        <div className="modal-overlay">
          <div className="modal-content pending-modal">
            <button className="close-modal-btn" onClick={() => setShowPendingModal(false)}><FaTimes /></button>
            <div className="modal-icon-wrapper pending"><FaListUl /></div>
            <h3>Application Under Review</h3>
            <p>Your application has been submitted and is currently being reviewed by our team.</p>
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
            {providerData?.rejection_reasons && providerData.rejection_reasons.length > 0 ? (
              <div className="rejection-details-box">
                <p className="reject-reason-title"><FaExclamationCircle /> <strong>Reason(s):</strong></p>
                <ul className="reject-reason-list">
                  {providerData.rejection_reasons.map((reason, idx) => (
                    <li key={idx} className="reject-reason-item">{formatReason(reason)}</li>
                  ))}
                </ul>
              </div>
            ) : (
                <p>Please contact support for more details.</p>
            )}
            <button className="modal-ok-btn reject-bg" onClick={() => setShowRejectModal(false)}>Close</button>
          </div>
        </div>
      )}
    </>
  );
};

export default LoggedInNavbar;