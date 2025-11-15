import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FaBell, FaUserCircle, FaSignOutAlt } from "react-icons/fa";
import { supabase } from "../../config/supabase";
import "./LoggedInNavbar.css";
import logo from "../../assets/logo.png";

const LoggedInNavbar = () => {
  const navigate = useNavigate();
  const [showNotif, setShowNotif] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [profile, setProfile] = useState(null);

  const notifRef = useRef();
  const menuRef = useRef();

  // Fetch profile + notifications
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

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
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

  return (
    <header className="loggedin-header">
      <div className="navbar-container">
        <div className="header-left" onClick={() => navigate("/dashboard")}>
          <img src={logo} alt="Furlink logo" className="header-logo" />
        </div>

        <div className="nav-right">

          {/* ⭐ ADDED — Become a Service Provider Button */}
          <button 
            className="provider-btn"
            onClick={() => navigate("/apply-provider")}
          >
            Become a Service Provider
          </button>

          {/* Notifications */}
          <div ref={notifRef} className="notif-wrapper">
            <button
              className="icon-btn"
              onClick={() => setShowNotif(!showNotif)}
            >
              <FaBell className="icon" />
              {unreadCount > 0 && <span className="notif-dot">{unreadCount}</span>}
            </button>

            {showNotif && (
              <div className="notif-dropdown">
                {notifications.length === 0 ? (
                  <div className="notif-empty">No notifications</div>
                ) : (
                  notifications.slice(0, 3).map((notif) => (
                    <div
                      key={notif.id}
                      className={`notif-item ${notif.read ? "" : "unread"}`}
                    >
                      <strong>{notif.title}</strong>
                      <p>{notif.message}</p>
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
              <div className="dropdown">
                <p className="user-name">
                  {profile?.first_name || "User"}
                </p>
                <button className="logout-btn" onClick={handleLogout}>
                  <FaSignOutAlt /> Logout
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};

export default LoggedInNavbar;
