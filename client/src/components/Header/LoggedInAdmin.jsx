import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FaBell, FaUserCircle, FaSignOutAlt, FaBars, FaTimes } from "react-icons/fa";
import { supabase } from "../../config/supabase";
import "./LoggedInAdmin.css";
import logo from "../../assets/logo.png";

const LoggedInAdmin = () => {
  const navigate = useNavigate();
  const [showNotif, setShowNotif] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false); // NEW: Mobile Drawer State
  const [notifications, setNotifications] = useState([]);
  const [profile, setProfile] = useState(null);

  // SEPARATE REFS: Prevents mobile/desktop click collision
  const desktopNotifRef = useRef();
  const mobileNotifRef = useRef();
  const menuRef = useRef();

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate("/login");

      const { data: profileData } = await supabase
        .from("profiles")
        .select("first_name")
        .eq("id", user.id)
        .single();

      const { data: notifData } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      setProfile(profileData);
      setNotifications(notifData || []);
    };

    fetchData();
  }, [navigate]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      // Check outside notification refs
      const outsideDesktopNotif = desktopNotifRef.current && !desktopNotifRef.current.contains(e.target);
      const outsideMobileNotif = mobileNotifRef.current && !mobileNotifRef.current.contains(e.target);
      
      if (outsideDesktopNotif && outsideMobileNotif) {
        setShowNotif(false);
      }
      
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("token");
    navigate("/");
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Shared Notification Component
  const NotificationContent = () => (
    <div className="notif-dropdown">
      {notifications.length === 0 ? (
        <div className="notif-empty">No notifications</div>
      ) : (
        notifications.slice(0, 3).map((notif) => (
          <div key={notif.id} className={`notif-item ${notif.read ? "" : "unread"}`}>
            <strong>{notif.title}</strong>
            <p>{notif.message}</p>
          </div>
        ))
      )}
    </div>
  );

  return (
    <>
      <header className="loggedin-header">
        <div className="navbar-container">
          
          {/* === DESKTOP LAYOUT === */}
          <div className="header-left desktop-only-group" onClick={() => navigate("/admin-dashboard")}>
            <img src={logo} alt="Furlink logo" className="header-logo" />
          </div>

          <div className="nav-right desktop-only-group">
            <div ref={desktopNotifRef} className="notif-wrapper">
              <button className="icon-btn" onClick={() => setShowNotif(!showNotif)}>
                <FaBell className="icon" />
                {unreadCount > 0 && <span className="notif-dot">{unreadCount}</span>}
              </button>
              {showNotif && <NotificationContent />}
            </div>

            <div ref={menuRef} className="profile-wrapper">
              <button className="icon-btn" onClick={() => setShowMenu(!showMenu)}>
                <FaUserCircle className="icon" />
              </button>
              {showMenu && (
                <div className="dropdown">
                  <p className="user-name">{profile?.first_name || "Admin"}</p>
                  <button className="logout-btn" onClick={handleLogout}>
                    <FaSignOutAlt /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* === MOBILE LAYOUT === */}
          <div className="mobile-nav-container mobile-only-group">
            <div className="mobile-left-nav">
              <button className="icon-btn" onClick={() => setShowMobileMenu(true)}>
                <FaBars className="icon" />
              </button>
              
              <div ref={mobileNotifRef} className="notif-wrapper">
                <button className="icon-btn" onClick={() => setShowNotif(!showNotif)}>
                  <FaBell className="icon" />
                  {unreadCount > 0 && <span className="notif-dot">{unreadCount}</span>}
                </button>
                {showNotif && <NotificationContent />}
              </div>
            </div>

            <div className="mobile-right-nav" onClick={() => navigate("/admin-dashboard")}>
              <img src={logo} alt="Furlink logo" className="header-logo" />
            </div>
          </div>

        </div>
      </header>

      {/* === MOBILE SIDEBAR (LEFT) === */}
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
              <p className="drawer-welcome">Admin Panel</p>
              <p className="drawer-username">{profile?.first_name || "Admin"}</p>
            </div>
          </div>
          <div className="drawer-footer">
            <button className="drawer-logout-btn" onClick={handleLogout}>
              <FaSignOutAlt /> Logout
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default LoggedInAdmin;