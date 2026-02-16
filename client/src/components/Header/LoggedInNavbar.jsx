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
  FaBars,
  FaBan 
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
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [agreedToUpgradeTerms, setAgreedToUpgradeTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  // Data State
  const [notifications, setNotifications] = useState([]);
  const [profile, setProfile] = useState(null);
  const [providerData, setProviderData] = useState(null); 
  const [hasServices, setHasServices] = useState(false); 
  
  // Suspension State
  const [suspensionData, setSuspensionData] = useState(null);

  // REFS
  const desktopNotifRef = useRef();
  const mobileNotifRef = useRef();
  const menuRef = useRef();

  // Triggered by the "Become a Pet Owner" button
  const initiateUpgrade = () => {
    setShowUpgradeModal(true);
    setAgreedToUpgradeTerms(false);
  };

  // Triggered only after confirming in the modal
  const handleFinalUpgrade = async () => {
    if (!agreedToUpgradeTerms) return;
    
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("profiles")
        .update({ role: "both" })
        .eq("id", user.id);

      if (error) throw error;

      setShowUpgradeModal(false);
      navigate("/dashboard");
      window.location.reload(); 
    } catch (err) {
      console.error("Error upgrading role:", err);
      alert("Failed to update account role.");
    } finally {
      setLoading(false);
    }
  };
  
  
  const currentPath = location.pathname;
  const isServiceProviderPage = currentPath.startsWith("/service/");

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

  const hideManageListingOption = [
    "/service/manage-listing",
    "/service/edit-listing",
    "/service/edit-profile"
  ].includes(currentPath);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data?.user) {
          console.warn("Session expired or invalid:", error);
          return;
        }
        const user = data.user;

        // 1. Fetch Profile 
        const { data: profileData } = await supabase
          .from("profiles")
          .select("first_name, role, suspension_end_date, is_active") 
          .eq("id", user.id)
          .single();
        setProfile(profileData);

        // CHECK SUSPENSION STATUS
        if (profileData?.suspension_end_date) {
            const endDate = new Date(profileData.suspension_end_date);
            if (endDate > new Date()) {
                setSuspensionData({
                    endDate: endDate,
                    isActive: profileData.is_active
                });
            }
        }

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
      } catch (err) {
        console.error("Auth fetch error:", err);
      }
    };

    fetchData();
  }, [navigate]);

  useEffect(() => {
    const subscribeNotifications = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const channel = supabase
        .channel('schema-db-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            setNotifications((prev) => [payload.new, ...prev]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    subscribeNotifications();
  }, []);

  const userRole = profile?.role; 
  const providerStatus = providerData?.status;
  const isStrictProvider = userRole === 'service_provider';
  const isApproved = providerStatus === 'approved';
  const isIncomplete = providerStatus === 'incomplete';
  
  // ⭐ Derived Suspension Boolean
  const isSuspended = !!suspensionData;

  const canManageListing = (userRole === 'service_provider' || userRole === 'both') && isApproved;

  const handleProviderClick = () => {
    setShowMobileMenu(false); 
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
    else if (isIncomplete) {
      navigate("/service-setup");
    }
  };

  const handleNotifClick = async (notif) => {
    try {
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notif.id);

      setShowNotif(false);
      setNotifications(prev => 
        prev.map(n => n.id === notif.id ? { ...n, read: true } : n)
      );
      navigate(notif.link || "/dashboard");
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) throw error;
      setNotifications(notifications.map(n => ({ ...n, read: true })));
    } catch (err) {
      console.error("Error marking all read:", err);
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
      const outsideDesktop = desktopNotifRef.current && !desktopNotifRef.current.contains(e.target);
      const outsideMobile = mobileNotifRef.current && !mobileNotifRef.current.contains(e.target);
      
      if (outsideDesktop && outsideMobile) {
        setShowNotif(false);
      }

      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogoClick = () => {
    if (location.pathname.startsWith("/service")) {
      navigate("/service/dashboard");
    } 
    else {
      navigate("/dashboard");
    }
  };

  const handleNavClick = (path) => {
    setShowMobileMenu(false);
    setShowMenu(false);
    navigate(path);
  };

  const NotificationDropdown = () => (
    <div className="dropdown notif-dropdown">
      <div className="notif-header">
        <h3>Notifications</h3>
        {notifications.filter(n => !n.read).length > 0 && (
          <button className="mark-all-link" onClick={handleMarkAllAsRead}>
            Mark all as read
          </button>
        )}
      </div>
      <div className="notif-list">
        {notifications.length > 0 ? (
          notifications.map((n, index) => (
            <div 
              key={n.id} 
              className={`notif-item ${!n.read ? "unread" : ""} ${index < 3 ? "recent" : ""}`}
              onClick={() => handleNotifClick(n)}
            >
              <div className="notif-indicator"></div>
              <div className="notif-content">
                <div className="notif-title-row">
                  <span className="notif-title">{n.title}</span>
                  <span className="notif-date">
                    {new Date(n.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <p className="notif-message">{n.message}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="no-notif-empty">
            <FaBell className="empty-bell" />
            <p>All caught up!</p>
          </div>
        )}
      </div>
    </div>
  );

  /* Helper to determine suspension text based on role */
  const getSuspensionMessage = () => {
    if (userRole === 'service_provider') {
        return "You are restricted from accepting new bookings until";
    } 
    if (userRole === 'pet_owner') {
        return "You are restricted from booking services until";
    }
    return "You are restricted from booking or accepting services until";
  };

  return (
    <>
      {/* ⭐ GLOBAL SUSPENSION BANNER */}
      {suspensionData && (
        <div className="global-suspension-banner">
            <div className="suspension-content">
                <FaBan className="suspension-icon" />
                <span>
                    <strong>Account Suspended:</strong> {getSuspensionMessage()} 
                    {' '}{suspensionData.endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}.
                </span>
            </div>
        </div>
      )}

      <header className={`loggedin-header ${suspensionData ? 'has-banner' : ''}`}>
        <div className="navbar-container">
          
          {/* ... (Desktop Layout) ... */}
          <div className="header-left desktop-only-group" onClick={handleLogoClick}>
            <img src={logo} alt="Furlink logo" className="header-logo" />
          </div>

          <div className="nav-right desktop-only-group">
            <div className="desktop-btn-group">
              
              {/* ⭐ BUTTON LOGIC: 
                  1. 'Become a Pet Owner' is hidden if user is a strict Service Provider AND Suspended.
              */}
              {/* Mobile Drawer section */}
              {isStrictProvider && !isSuspended && (
                <button className="drawer-action-btn" onClick={initiateUpgrade}>
                  Become a Pet Owner
                </button>
              )}

              {/* MODAL SECTION - Place near other modals at the bottom */}
              {showUpgradeModal && (
                <div className="modal-overlay">
                  <div className="modal-content upgrade-modal">
                    <button className="close-modal-btn" onClick={() => setShowUpgradeModal(false)}>
                      <FaTimes />
                    </button>
                    
                    <div className="modal-header-upgrade">
                      <h3>Upgrade to Dual Account</h3>
                      <p>You are about to unlock Pet Owner features alongside your Provider profile.</p>
                    </div>

                    <div className="upgrade-terms-box">
                      <p>
                        By upgrading, you agree to our{" "}
                        <strong>
                          <a 
                            href="https://mdhudfatvdipxwufcbis.supabase.co/storage/v1/object/public/agreements/terms_general.pdf" 
                            target="_blank" 
                            rel="noreferrer"
                            className="view-terms-link"
                          >
                            Terms and Conditions
                          </a>
                        </strong>
                        . Please review the document carefully.
                      </p>
                    </div>

                    <div className="modal-footer-upgrade">
                      <label className="checkbox-label">
                        <input 
                          type="checkbox" 
                          checked={agreedToUpgradeTerms} 
                          onChange={(e) => setAgreedToUpgradeTerms(e.target.checked)} 
                        />
                        <span>I have read and agree to the Terms and Conditions</span>
                      </label>

                      <div className="modal-actions">
                        <button 
                          className="modal-ok-btn" 
                          onClick={handleFinalUpgrade} 
                          disabled={!agreedToUpgradeTerms || loading}
                        >
                          {loading ? "Processing..." : "Confirm Upgrade"}
                        </button>
                        <button 
                          className="modal-cancel-btn" 
                          onClick={() => setShowUpgradeModal(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ⭐ BUTTON LOGIC:
                  2. 'Become a Service Provider' (Application) is hidden if user is a strict Pet Owner AND Suspended.
                  3. If role is 'both', the button acts as a Switcher, so we KEEP it visible (read-only access).
              */}
              {!isStrictProvider && !hideBecomeProviderAction && (userRole !== 'pet_owner' || !isSuspended) && (
                <button className={`provider-btn ${isApproved ? 'business-mode' : ''}`} onClick={handleProviderClick}>
                  {isApproved ? (isServiceProviderPage ? "Switch to Pet Owner" : `Switch to Service Provider`) : isIncomplete ? "Continue Application" : "Become a Service Provider"} 
                </button>
              )}

            </div>

            <div ref={desktopNotifRef} className="notif-wrapper">
              <button className="icon-btn" onClick={() => setShowNotif(!showNotif)}>
                <FaBell className="icon" />
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="notif-badge">{notifications.filter(n => !n.read).length}</span>
                )}
              </button>
              {showNotif && <NotificationDropdown />}
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
                      <FaUser className="menu-icon" /> Manage Account
                    </button>
                  )}
                  {canManageListing && !hideManageListingOption && (
                    <button className="menu-item-btn" onClick={() => { navigate("/service/manage-listing"); setShowMenu(false); }}>
                      <FaStore className="menu-icon" /> Manage Listing
                    </button>
                  )}
                  {!isStrictProvider && !hideAppointmentsOption && (
                    <button className="menu-item-btn" onClick={() => { navigate("/appointments"); setShowMenu(false); }}>
                      <FaCalendarAlt className="menu-icon" /> Manage Bookings
                    </button>
                  )}
                  <button className="logout-btn" onClick={handleLogout}>
                    <FaSignOutAlt className="menu-icon" /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ... (Mobile Layout) ... */}
          <div className="mobile-nav-container mobile-only-group">
            
            <div className="mobile-left-nav">
              <button className="icon-btn mobile-menu-btn" onClick={() => setShowMobileMenu(true)}>
                <FaBars className="icon" />
              </button>
              
              <div ref={mobileNotifRef} className="notif-wrapper">
                <button className="icon-btn" onClick={() => setShowNotif(!showNotif)}>
                  <FaBell className="icon" />
                  {notifications.filter(n => !n.read).length > 0 && (
                    <span className="notif-badge">
                      {notifications.filter(n => !n.read).length}
                    </span>
                  )}
                </button>
                {showNotif && <NotificationDropdown />}
              </div>
            </div>

            <div className="mobile-right-nav" onClick={handleLogoClick}>
              <img src={logo} alt="Furlink logo" className="header-logo" />
            </div>

          </div>

        </div>
      </header>

      {/* ... (Mobile Drawer) ... */}
      <div className={`mobile-drawer-overlay ${showMobileMenu ? 'active' : ''}`} onClick={() => setShowMobileMenu(false)}></div>
      
      <div className={`mobile-drawer ${showMobileMenu ? 'active' : ''}`}>
        <div className="mobile-drawer-header">
           <img src={logo} alt="Logo" className="mobile-drawer-logo" />
           <button className="close-drawer-btn" onClick={() => setShowMobileMenu(false)}>
             <FaTimes />
           </button>
        </div>

        <div className="mobile-drawer-content">
          <div className="drawer-user-card">
            <FaUserCircle className="drawer-user-icon" />
            <div>
              <p className="drawer-welcome">Welcome back,</p>
              <p className="drawer-username">{profile?.first_name || "User"}</p>
            </div>
          </div>

          <div className="drawer-section">
            {/* Mobile: Same logic applied */}
            {isStrictProvider && !isSuspended && (
              <button className="drawer-action-btn" onClick={initiateUpgrade}>
                Become a Pet Owner
              </button>
            )}
            
            {!isStrictProvider && !hideBecomeProviderAction && (userRole !== 'pet_owner' || !isSuspended) && (
              <button className="drawer-action-btn" onClick={handleProviderClick}>
                 {isApproved 
                   ? (isServiceProviderPage ? "Switch to Pet Owner" : "Switch to Provider") 
                   : isIncomplete ? "Continue Application" : "Become a Service Provider"}
              </button>
            )}
          </div>

          <div className="drawer-links">
             {!hideProfileOption && (
                <button className="drawer-link-item" onClick={() => handleNavClick("/profile")}>
                  <FaUser /> Manage Account
                </button>
             )}
             {canManageListing && !hideManageListingOption && (
                <button className="drawer-link-item" onClick={() => handleNavClick("/service/manage-listing")}>
                  <FaStore /> Manage Listing
                </button>
             )}
             {!isStrictProvider && !hideAppointmentsOption && (
                <button className="drawer-link-item" onClick={() => handleNavClick("/appointments")}>
                  <FaCalendarAlt /> Manage Bookings
                </button>
             )}
          </div>

          <div className="drawer-footer">
            <button className="drawer-logout-btn" onClick={handleLogout}>
              <FaSignOutAlt /> Logout
            </button>
          </div>
        </div>
      </div>

      {/* ... (Modals remain unchanged) ... */}
      {showPendingModal && (
        <div className="modal-overlay">
          <div className="modal-content pending-modal">
            <button className="close-modal-btn" onClick={() => setShowPendingModal(false)}><FaTimes /></button>
            <div className="modal-icon-wrapper pending"><FaListUl /></div>
            <h3>Application Under Review</h3>
            <p>Your application for <strong>{providerData?.business_name}</strong> has been submitted...</p>
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