import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { 
  FaUserEdit, 
  FaSave, 
  FaEnvelope, 
  FaPhone, 
  FaLock, 
  FaEye, 
  FaEyeSlash, 
  FaExclamationCircle,
  FaCheckCircle,
  FaExclamationTriangle,
  FaInfoCircle // Added for No Changes icon
} from "react-icons/fa";
import "./UserProfile.css";

export default function UserProfile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Modal States
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showNoChangesModal, setShowNoChangesModal] = useState(false); // New Modal State
  
  // Toggle Password Visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Form Data
  const [formData, setFormData] = useState({
    email: "", 
    first_name: "",
    last_name: "",
    mobile_number: ""
  });

  // Keep track of original data to compare changes
  const [initialData, setInitialData] = useState({});

  const [passwords, setPasswords] = useState({
    new_password: "",
    confirm_password: ""
  });

  // Errors State
  const [errors, setErrors] = useState({});

  useEffect(() => {
    fetchProfile();
  }, [navigate]);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate("/login");

      const { data, error } = await supabase
        .from("profiles")
        .select("first_name, last_name, mobile_number")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      const profileData = {
        email: user.email, 
        first_name: data.first_name || "",
        last_name: data.last_name || "",
        mobile_number: data.mobile_number || "" 
      };

      setFormData(profileData);
      setInitialData(profileData); // Save initial state

    } catch (err) {
      console.error("Error fetching profile:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (errors[e.target.name]) setErrors(prev => ({ ...prev, [e.target.name]: "" }));
    if (errors.general) setErrors(prev => ({ ...prev, general: "" }));
  };

  const handlePasswordChange = (e) => {
    setPasswords({ ...passwords, [e.target.name]: e.target.value });
    if (errors.password || errors.confirm_password) setErrors(prev => ({ ...prev, password: "", confirm_password: "" }));
    if (errors.general) setErrors(prev => ({ ...prev, general: "" }));
  };

  // Check if form is dirty (has changes)
  const hasChanges = () => {
    // 1. Check Personal Details
    const detailsChanged = 
      formData.first_name !== initialData.first_name ||
      formData.last_name !== initialData.last_name ||
      formData.mobile_number !== initialData.mobile_number;

    // 2. Check Password Fields
    const passwordChanged = passwords.new_password.trim() !== "";

    return detailsChanged || passwordChanged;
  };

  const validateForm = () => {
    const newErrors = {};
    let isValid = true;

    if (!formData.first_name.trim()) { newErrors.first_name = "First name is required."; isValid = false; }
    if (!formData.last_name.trim()) { newErrors.last_name = "Last name is required."; isValid = false; }

    const mobileRegex = /^(09|\+639)\d{9}$/;
    if (!formData.mobile_number.trim()) {
      newErrors.mobile_number = "Mobile number is required.";
      isValid = false;
    } else if (!mobileRegex.test(formData.mobile_number.replace(/\s/g, ''))) {
      newErrors.mobile_number = "Invalid format. Use 09XXXXXXXXX or +639XXXXXXXXX";
      isValid = false;
    }

    if (passwords.new_password) {
      if (passwords.new_password.length < 6) { newErrors.password = "Password must be at least 6 characters."; isValid = false; }
      if (!passwords.confirm_password) { newErrors.confirm_password = "Please confirm your new password."; isValid = false; }
      else if (passwords.new_password !== passwords.confirm_password) { newErrors.confirm_password = "Passwords do not match."; isValid = false; }
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSaveClick = (e) => {
    e.preventDefault();
    
    // Check for changes first
    if (!hasChanges()) {
      setShowNoChangesModal(true);
      return;
    }

    if (validateForm()) {
      setShowConfirmModal(true);
    }
  };

  const confirmSave = async () => {
    setSaving(true);
    setShowConfirmModal(false); 
    setErrors({}); 

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          first_name: formData.first_name,
          last_name: formData.last_name,
          mobile_number: formData.mobile_number,
          updated_at: new Date(),
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      if (passwords.new_password) {
        const { error: authError } = await supabase.auth.updateUser({
          password: passwords.new_password
        });
        if (authError) throw authError;
      }

      // Update initial data to match new saved data so future checks work
      setInitialData({ ...formData });
      setPasswords({ new_password: "", confirm_password: "" });

      setShowSuccessModal(true);

    } catch (err) {
      console.error("Error updating profile:", err);
      const errorMessage = err.message || "An unexpected error occurred.";
      const errorMsgLower = errorMessage.toLowerCase();

      if (errorMsgLower.includes("password")) setErrors({ password: errorMessage });
      else if (errorMsgLower.includes("mobile")) setErrors({ mobile_number: errorMessage });
      else setErrors({ general: errorMessage });

    } finally {
      setSaving(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    navigate("/dashboard");
  };

  const handleNoChangesClose = () => {
    setShowNoChangesModal(false);
    navigate("/dashboard");
  };

  if (loading) return <div className="profile-loading">Loading Profile...</div>;

  return (
    <>
      <LoggedInNavbar />
      <div className="profile-page-wrapper">
        <div className="profile-container">
          
          <div className="profile-header">
            <div className="header-icon"><FaUserEdit /></div>
            <h1>My Profile</h1>
            <p>Manage your personal information and security</p>
          </div>

          {errors.general && (
            <div className="general-error-banner">
              <FaExclamationTriangle /> {errors.general}
            </div>
          )}

          <form className="profile-form" onSubmit={handleSaveClick}>
            
            <div className="form-section">
              <h3>Account Info</h3>
              <div className="input-group full-width">
                <label><FaEnvelope className="input-icon"/> Email Address</label>
                <input type="email" value={formData.email} disabled className="read-only-input"/>
                <span className="helper-text">Email cannot be changed.</span>
              </div>
            </div>

            <div className="form-section">
              <h3>Personal Details</h3>
              <div className="form-row">
                <div className="input-group">
                  <label>First Name</label>
                  <input type="text" name="first_name" value={formData.first_name} onChange={handleProfileChange} className={errors.first_name ? "input-error" : ""}/>
                  {errors.first_name && <span className="field-error-msg">{errors.first_name}</span>}
                </div>
                <div className="input-group">
                  <label>Last Name</label>
                  <input type="text" name="last_name" value={formData.last_name} onChange={handleProfileChange} className={errors.last_name ? "input-error" : ""}/>
                  {errors.last_name && <span className="field-error-msg">{errors.last_name}</span>}
                </div>
              </div>
              <div className="input-group">
                <label><FaPhone className="input-icon"/> Mobile Number</label>
                <input type="text" name="mobile_number" value={formData.mobile_number} onChange={handleProfileChange} placeholder="09XXXXXXXXX" className={errors.mobile_number ? "input-error" : ""}/>
                {errors.mobile_number && <span className="field-error-msg">{errors.mobile_number}</span>}
              </div>
            </div>

            <div className="form-section">
              <h3>Change Password</h3>
              <p className="section-subtitle">Leave blank to keep current password.</p>
              <div className="form-row">
                <div className="input-group">
                  <label><FaLock className="input-icon"/> New Password</label>
                  <div className="password-wrapper">
                    <input type={showPassword ? "text" : "password"} name="new_password" value={passwords.new_password} onChange={handlePasswordChange} placeholder="New Password" className={errors.password ? "input-error" : ""}/>
                    <button type="button" className="toggle-password-btn" onClick={() => setShowPassword(!showPassword)} tabIndex="-1">
                      {showPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                  {errors.password && <span className="field-error-msg">{errors.password}</span>}
                </div>
                <div className="input-group">
                  <label><FaLock className="input-icon"/> Confirm Password</label>
                  <div className="password-wrapper">
                    <input type={showConfirmPassword ? "text" : "password"} name="confirm_password" value={passwords.confirm_password} onChange={handlePasswordChange} placeholder="Confirm New Password" className={errors.confirm_password ? "input-error" : ""} disabled={!passwords.new_password}/>
                    <button type="button" className="toggle-password-btn" onClick={() => setShowConfirmPassword(!showConfirmPassword)} tabIndex="-1">
                      {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                  {errors.confirm_password && <span className="field-error-msg">{errors.confirm_password}</span>}
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="save-btn" disabled={saving}>
                <FaSave /> Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* --- MODALS --- */}

      {/* 1. CONFIRMATION MODAL */}
      {showConfirmModal && (
        <div className="modal-overlay">
          <div className="modal-content confirm-save-modal">
            <div className="modal-icon-wrapper warn">
              <FaExclamationCircle />
            </div>
            <h3>Save Changes?</h3>
            <p>Are you sure you want to update your profile information?</p>
            <div className="modal-actions-row">
              <button className="modal-btn-cancel" onClick={() => setShowConfirmModal(false)}>Cancel</button>
              <button className="modal-btn-confirm" onClick={confirmSave}>Yes, Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* 2. SUCCESS MODAL */}
      {showSuccessModal && (
        <div className="modal-overlay">
          <div className="modal-content confirm-save-modal">
            <div className="modal-icon-wrapper success">
              <FaCheckCircle />
            </div>
            <h3>Profile Updated!</h3>
            <p>Your details have been successfully updated.</p>
            <div className="modal-actions-row">
              <button className="modal-btn-confirm" onClick={handleSuccessClose} style={{ width: '100%' }}>
                Great, Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. NO CHANGES MODAL (NEW) */}
      {showNoChangesModal && (
        <div className="modal-overlay">
          <div className="modal-content confirm-save-modal">
            <div className="modal-icon-wrapper info">
              <FaInfoCircle />
            </div>
            <h3>No Changes Detected</h3>
            <p>You haven't made any changes to your profile.</p>
            <div className="modal-actions-row">
              <button className="modal-btn-cancel" onClick={() => setShowNoChangesModal(false)}>
                Keep Editing
              </button>
              <button className="modal-btn-confirm" onClick={handleNoChangesClose}>
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
}