// src/pages/admin/AdminChangePassword.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import Footer from "../../components/Footer/Footer";
import "./AdminChangePassword.css";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import logo from "../../assets/logo.png";

const AdminChangePassword = () => {
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("token");
    navigate("/login");
  };

  const validatePassword = () => {
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,12}$/.test(password);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!validatePassword()) {
      setError(
        "Password must be 8–12 characters and include uppercase, lowercase, number, and a special character."
      );
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) throw updateError;

      const { data: userData } = await supabase.auth.getUser();

      if (userData?.user) {
        await supabase
          .from("profiles")
          .update({ must_change_password: false })
          .eq("id", userData.user.id);
      }

      navigate("/admin-dashboard");
    } catch (err) {
      console.error(err);
      setError("Failed to update password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="change-password-page">

      {/* Admin Header */}
      <header className="admin-header">
        <div className="admin-header-left" onClick={() => navigate("/admin-dashboard")}>
          <img src={logo} alt="Furlink Logo" className="admin-logo" />
        </div>

        <button className="admin-logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </header>

      {/* Form */}
      <div className="change-password-form">
        <h2>Change Your Password</h2>

        <form onSubmit={handleSubmit}>
          
          {/* New Password */}
          <div className="input-wrapper">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="New Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <span
              className="toggle-icon"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </span>
          </div>

          {/* Confirm Password */}
          <div className="input-wrapper">
            <input
              type={showConfirm ? "text" : "password"}
              placeholder="Confirm New Password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />

            <span
              className="toggle-icon"
              onClick={() => setShowConfirm(!showConfirm)}
            >
              {showConfirm ? <FaEyeSlash /> : <FaEye />}
            </span>
          </div>

          {error && <p className="error">{error}</p>}

          <button type="submit" disabled={loading}>
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>

      <Footer />
    </div>
  );
};

export default AdminChangePassword;
