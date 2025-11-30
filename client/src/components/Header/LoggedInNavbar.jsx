import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom"; // Added useLocation
import { FaBell, FaUserCircle, FaSignOutAlt, FaTimes, FaStore, FaListUl } from "react-icons/fa";
import { supabase } from "../../config/supabase";
import "./LoggedInNavbar.css";
import logo from "../../assets/logo.png";

const LoggedInNavbar = ({ hideBecomeProvider = false }) => {
  const navigate = useNavigate();
  const location = useLocation(); // Hook to get current URL path
  
  // UI Toggles
  const [showNotif, setShowNotif] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);

  // Data State
  const [notifications, setNotifications] = useState([]);
  const [profile, setProfile] = useState(null);
  
  // Provider Logic State
  const [providerData, setProviderData] = useState(null); // { id, status, business_name }
  const [hasServices, setHasServices] = useState(false); // Check if they finished stage 2 (ServiceListing)

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

      // 3. Fetch Provider Data + Service Check
      const { data: provider } = await supabase
        .from("service_providers")
        .select("id, status, business_name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (provider) {
        setProviderData(provider);
        
        // Check if they have submitted Stage 2 (Service Listing)
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

  // Requirement: Hide "Switch to Business" if already IN the service provider area
  // Check if current path starts with "/service/"
  const isServiceProviderPage = location.pathname.startsWith("/service/");

  // Requirement 1-5: The "Become a Service Provider" Button Logic
  const handleProviderClick = () => {
    // Case 1: No application at all
    if (!providerData) {
      navigate("/apply-provider");
      return;
    }

    const { status, id } = providerData;

    if (status === "approved") {
      // Case 5: Approved -> Go to Dashboard (FIXED URL)
      navigate("/service/dashboard"); // Or `/service/dashboard/${id}` if you prefer specific
    } else if (status === "rejected") {
      // Case 4: Rejected -> Show Modal
      setShowRejectModal(true);
    } else if (status === "pending") {
      if (hasServices) {
        // Case 2: Pending + Has Services -> Under Review Modal
        setShowPendingModal(true);
      } else {
        // Case 3: Pending + No Services -> Continue Setup
        navigate("/service-setup");
      }
    }
  };

  // Requirement 6: Notification Click & Styling
  const handleNotifClick = async (notif) => {
    if (!notif.read) {
      await supabase.from("notifications").update({ read: true }).eq("id", notif.id);
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
    }

    const title = notif.title?.toLowerCase() || "";
    
    // Redirect logic based on notification type
    if (title.includes("approved")) {
      // FIXED URL
      navigate("/service/dashboard");
      setShowNotif(false);
    } else if (title.includes("rejected")) {
      setShowRejectModal(true);
      setShowNotif(false);
    }
  };

  // Logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("token");
    navigate("/");
  };

  // Click Outside Listener
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false);
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

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

            {/* ⭐ Provider Button (Dynamic Text + Visibility Logic) */}
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
                  
                  {/* Requirement 7: Manage Listing (Only if Approved) */}
                  {providerData?.status === 'approved' && (
                    <button 
                      className="menu-item-btn" 
                      onClick={() => navigate("/service/manage-listing")} // FIXED URL
                    >
                      <FaStore className="menu-icon" /> Manage Listing
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

      {/* =======================
          MODALS
         ======================= */}

      {/* Case 2: Under Review Modal */}
      {showPendingModal && (
        <div className="modal-overlay">
          <div className="modal-content pending-modal">
            <button className="close-modal-btn" onClick={() => setShowPendingModal(false)}>
              <FaTimes />
            </button>
            <div className="modal-icon-wrapper pending">
               <FaListUl />
            </div>
            <h3>Application Under Review</h3>
            <p>
              Your application has been submitted and is currently being reviewed by our team. 
              We will notify you once a decision has been made.
            </p>
            <button className="modal-ok-btn" onClick={() => setShowPendingModal(false)}>
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Case 4: Rejected Modal */}
      {showRejectModal && (
        <div className="modal-overlay">
          <div className="modal-content reject-modal">
            <button className="close-modal-btn" onClick={() => setShowRejectModal(false)}>
              <FaTimes />
            </button>
            <div className="modal-icon-wrapper reject">
               <FaTimes />
            </div>
            <h3>Application Rejected</h3>
            <p>
              Your listing was not approved at this time. 
              {/* You can add dynamic reason fetching here later */}
              Please review your details or contact support for more information.
            </p>
            <button className="modal-ok-btn reject-bg" onClick={() => setShowRejectModal(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default LoggedInNavbar;