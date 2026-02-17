import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { 
  FaUserEdit, FaSave, FaEnvelope, FaPhone, FaLock, 
  FaEye, FaEyeSlash, FaExclamationCircle, FaCheckCircle, 
  FaExclamationTriangle, FaInfoCircle, FaUserShield, 
  FaClock, FaPaw, FaStore, FaExternalLinkAlt,
  FaTimes, FaBan 
} from "react-icons/fa";
import "./UserProfile.css";

export default function UserProfile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Warning & Suspension State
  const [activeWarning, setActiveWarning] = useState(null);
  const [isSuspended, setIsSuspended] = useState(false);
  const [suspensionDate, setSuspensionDate] = useState(null);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showNoChangesModal, setShowNoChangesModal] = useState(false);

  const [showDeactivateBlock, setShowDeactivateBlock] = useState(false);
  const [activeBookingCount, setActiveBookingCount] = useState(0);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    email: "", 
    first_name: "",
    last_name: "",
    mobile_number: ""
  });

  const [userRoleInfo, setUserRoleInfo] = useState({
    baseRole: "pet_owner",
    isProvider: false,
    providerStatus: null,
    providerId: null
  });

  const [initialData, setInitialData] = useState({});
  const [passwords, setPasswords] = useState({
    new_password: "",
    confirm_password: ""
  });

  const [errors, setErrors] = useState({});

  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [showDeactivateSuccess, setShowDeactivateSuccess] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, [navigate]);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate("/login");

      const [profileRes, providerRes, warningRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("service_providers").select("id, status").eq("user_id", user.id).maybeSingle(),
        supabase.from("notifications")
          .select("*")
          .eq("user_id", user.id)
          .eq("title", "Admin Warning")
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      ]);

      if (profileRes.error) throw profileRes.error;

      // CHECK FOR SUSPENSION
      if (profileRes.data.suspension_end_date) {
        const endDate = new Date(profileRes.data.suspension_end_date);
        if (endDate > new Date()) {
          setIsSuspended(true);
          setSuspensionDate(endDate);
        }
      }

      const profileData = {
        email: user.email, 
        first_name: profileRes.data.first_name || "",
        last_name: profileRes.data.last_name || "",
        mobile_number: (profileRes.data.mobile_number || "")
          .replace("+63", "")
          .replace(/^0/, "") 
      };

      setFormData(profileData);
      setInitialData(profileData);
      setActiveWarning(warningRes.data);

      setUserRoleInfo({
        baseRole: profileRes.data.role,
        isProvider: !!providerRes.data,
        providerStatus: providerRes.data ? providerRes.data.status : null,
        providerId: providerRes.data ? providerRes.data.id : null
      });

    } catch (err) {
      console.error("Error fetching profile:", err);
    } finally {
      setLoading(false);
    }
  };

  const checkEligibilityAndDeactivate = async () => {
    if (isSuspended) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let query = supabase.from("bookings").select("id", { count: 'exact' });
      
      if (userRoleInfo.isProvider && userRoleInfo.providerId) {
          query = query.eq('provider_id', userRoleInfo.providerId);
      } else {
          query = query.eq('user_id', user.id);
      }

      const { count, error } = await query.in('status', ['pending', 'approved', 'paid']);
      if (error) throw error;

      if (count > 0) {
        setActiveBookingCount(count);
        setShowDeactivateBlock(true);
      } else {
        setShowDeactivateConfirm(true);
      }
    } catch (err) {
      console.error("Eligibility check failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivateAccount = async () => {
    if (isSuspended) return;
    setDeactivating(true);
    try {
        const { data: { user } } = await supabase.auth.getUser();
        const updates = [
          supabase.from("profiles").update({ is_active: false, deactivated_at: new Date().toISOString() }).eq("id", user.id)
        ];
        if (userRoleInfo.isProvider && userRoleInfo.providerId) {
          updates.push(supabase.from("service_providers").update({ status: 'deactivated' }).eq("id", userRoleInfo.providerId));
          updates.push(supabase.from("bookings").update({ status: 'cancelled', rejection_reason: 'Provider account deactivated' }).eq('provider_id', userRoleInfo.providerId).in('status', ['pending', 'approved', 'paid']));
        }
        if (userRoleInfo.baseRole === 'pet_owner' || userRoleInfo.baseRole === 'both') {
          updates.push(supabase.from("bookings").update({ status: 'cancelled', rejection_reason: 'Owner account deactivated' }).eq('user_id', user.id).in('status', ['pending', 'approved', 'paid']));
        }
        const results = await Promise.all(updates);
        if (results.find(r => r.error)) throw new Error("Deactivation failed");
        setShowDeactivateConfirm(false);
        setShowDeactivateSuccess(true);
        await supabase.auth.signOut();
      } catch (err) {
        alert(err.message);
      } finally {
        setDeactivating(false);
      }
  };

  const handleProfileChange = (e) => {
    if (isSuspended) return;
    const { name, value } = e.target;

    if (name === "mobile_number") {
      // 1. Remove any non-digit characters
      const onlyNums = value.replace(/[^0-9]/g, '');
      // 2. Limit to exactly 10 digits
      if (onlyNums.length <= 10) {
        setFormData({ ...formData, mobile_number: onlyNums });
      }
    } else {
      setFormData({ ...formData, [name]: value });
    }

    if (errors[name]) setErrors(prev => ({ ...prev, [name]: "" }));
  };

  const handlePasswordChange = (e) => {
    if (isSuspended) return;
    setPasswords({ ...passwords, [e.target.name]: e.target.value });
    if (errors.password || errors.confirm_password) setErrors(prev => ({ ...prev, password: "", confirm_password: "" }));
  };

  const handleSaveClick = (e) => {
    e.preventDefault();
    if (isSuspended) return;
    const detailsChanged = formData.first_name !== initialData.first_name || formData.last_name !== initialData.last_name || formData.mobile_number !== initialData.mobile_number;
    const passwordChanged = passwords.new_password.trim() !== "";
    if (!(detailsChanged || passwordChanged)) { setShowNoChangesModal(true); return; }
    if (validateForm()) setShowConfirmModal(true);
  };

  const validateForm = () => {
    const newErrors = {};
    let isValid = true;
    if (!formData.first_name.trim()) { newErrors.first_name = "First name is required."; isValid = false; }
    if (!formData.last_name.trim()) { newErrors.last_name = "Last name is required."; isValid = false; }
    const mobileRegex = /^[0-9]{10}$/;
    if (!formData.mobile_number.trim()) {
      newErrors.mobile_number = "Mobile number is required.";
      isValid = false;
    } else if (!mobileRegex.test(formData.mobile_number.replace(/\s/g, ''))) {
      newErrors.mobile_number = "Invalid format.";
      isValid = false;
    }
    if (passwords.new_password) {
      if (passwords.new_password.length < 6) { newErrors.password = "Min 6 characters."; isValid = false; }
      if (passwords.new_password !== passwords.confirm_password) { newErrors.confirm_password = "Passwords do not match."; isValid = false; }
    }
    setErrors(newErrors);
    return isValid;
  };

const confirmSave = async () => {
    setSaving(true);
    setShowConfirmModal(false); 
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Save as local format: 0 + 9XXXXXXXXX
      const formattedMobile = `0${formData.mobile_number}`;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          first_name: formData.first_name,
          last_name: formData.last_name,
          mobile_number: formattedMobile, 
          updated_at: new Date(),
        })
        .eq("id", user.id);

      if (profileError) throw profileError;
      if (passwords.new_password) {
        const { error: authError } = await supabase.auth.updateUser({ password: passwords.new_password });
        if (authError) throw authError;
      }
      setInitialData({ ...formData });
      setPasswords({ new_password: "", confirm_password: "" });
      setShowSuccessModal(true);
    } catch (err) {
      setErrors({ general: err.message });
    } finally {
      setSaving(false);
    }
  };

  const renderRoleBadge = () => {
    const { baseRole, providerStatus } = userRoleInfo;
    return (
      <div className="role-display-container">
        <div className="role-card">
          {baseRole === "pet_owner" && (
            <div className="role-item active">
              <div className="role-icon-circle active"><FaPaw /></div>
              <div className="role-text"><h4>Pet Owner</h4></div>
              <FaCheckCircle className="status-icon-check" title="Active" />
            </div>
          )}
          {baseRole === "both" && (
            <>
              <div className="role-item active">
                <div className="role-icon-circle active"><FaPaw /></div>
                <div className="role-text"><h4>Pet Owner</h4></div>
                <FaCheckCircle className="status-icon-check" title="Active" />
              </div>
              <div className={`role-item ${providerStatus === 'approved' ? 'active' : 'inactive'}`}>
                <div className={`role-icon-circle ${providerStatus}`}><FaStore /></div>
                <div className="role-text">
                  <h4>Service Provider</h4>
                  <p>Status: <span className={`status-text ${providerStatus}`}>{providerStatus || 'Pending'}</span></p>
                </div>
                {providerStatus === 'approved' ? <FaCheckCircle className="status-icon-check" /> : <FaClock className="status-icon-pending" />}
              </div>
            </>
          )}
          {baseRole === "service_provider" && (
            <div className={`role-item ${providerStatus === 'approved' ? 'active' : 'inactive'}`}>
              <div className={`role-icon-circle ${providerStatus}`}><FaStore /></div>
              <div className="role-text">
                <h4>Service Provider</h4>
                <p>Status: <span className={`status-text ${providerStatus}`}>{providerStatus || 'Pending'}</span></p>
              </div>
              {providerStatus === 'approved' ? <FaCheckCircle className="status-icon-check" /> : <FaClock className="status-icon-pending" />}
            </div>
          )}
        </div>
      </div>
    );
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

          {/* WARNING BANNER */}
          {activeWarning && (
            <div className="warning-banner-container">
              <div className="warning-banner-content">
                <div className="warning-banner-left">
                  <FaExclamationTriangle className="warning-banner-icon" />
                  <div className="warning-banner-text">
                    <strong>Account Warning</strong>
                    <p>"{activeWarning.message}"</p>
                    <small>Please review our community guidelines to avoid suspension.</small>
                  </div>
                </div>
                <button className="warning-banner-btn" onClick={() => navigate('/terms')}>
                  Review Guidelines <FaExternalLinkAlt size={12}/>
                </button>
              </div>
            </div>
          )}

          {/* SUSPENSION BANNER */}
          {isSuspended && (
            <div className="general-error-banner" style={{ backgroundColor: '#fff1f2', color: '#be123c', border: '1px solid #fecdd3', marginBottom: '30px' }}>
              <FaBan style={{ marginRight: '10px' }} /> 
              <strong>Profile Locked:</strong> Your account is currently suspended until {suspensionDate.toLocaleDateString()}. You cannot update your information or deactivate your account at this time.
            </div>
          )}

          {errors.general && (
            <div className="general-error-banner">
              <FaExclamationTriangle /> {errors.general}
            </div>
          )}

          <form className="profile-form" onSubmit={handleSaveClick}>
            <div className="profile-form-body">
              <div className="profile-column">
                <div className="form-section">
                  <h3>Account Info</h3>
                  <div className="input-group">
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
                      <input 
                        type="text" name="first_name" 
                        value={formData.first_name} 
                        onChange={handleProfileChange} 
                        readOnly={isSuspended}
                        className={`${errors.first_name ? "input-error" : ""} ${isSuspended ? "read-only-input" : ""}`}
                      />
                      {errors.first_name && <span className="field-error-msg">{errors.first_name}</span>}
                    </div>
                    <div className="input-group">
                      <label>Last Name</label>
                      <input 
                        type="text" name="last_name" 
                        value={formData.last_name} 
                        onChange={handleProfileChange} 
                        readOnly={isSuspended}
                        className={`${errors.last_name ? "input-error" : ""} ${isSuspended ? "read-only-input" : ""}`}
                      />
                      {errors.last_name && <span className="field-error-msg">{errors.last_name}</span>}
                    </div>
                  </div>
                  <div className="input-group">
                    <label><FaPhone className="input-icon"/> Mobile Number</label>
                    <div className="mobile-input-wrapper" style={{ 
                      display: 'flex', 
                      alignItems: 'stretch', 
                      height: '45px' 
                    }}>
                      <span className="ph-prefix" style={{ 
                        padding: '0 12px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        background: '#f1f5f9', 
                        border: '1px solid #cbd5e1', 
                        borderRight: 'none',
                        borderRadius: '8px 0 0 8px',
                        color: '#64748b',
                        fontWeight: 'bold',
                        fontSize: '1rem'
                      }}>
                        +63
                      </span>
                      <input 
                        type="text" 
                        name="mobile_number" 
                        value={formData.mobile_number} 
                        onChange={handleProfileChange} 
                        placeholder="9XXXXXXXXX" 
                        readOnly={isSuspended}
                        style={{ 
                          borderTopLeftRadius: '0', 
                          borderBottomLeftRadius: '0', 
                          flex: 1,
                          height: '100%',
                          margin: 0 
                        }}
                        className={`${errors.mobile_number ? "input-error" : ""} ${isSuspended ? "read-only-input" : ""}`}
                      />
                    </div>
                    {errors.mobile_number && <span className="field-error-msg">{errors.mobile_number}</span>}
                  </div>
                  </div> 

                  <div className="form-section deactivation-section">
                    <h3>Account Security</h3>
                    <p className="section-subtitle">
                      No longer need your account? Deactivate it here.
                    </p>
                    <button 
                      type="button" 
                      onClick={checkEligibilityAndDeactivate} 
                      disabled={isSuspended}
                      style={{ 
                        marginTop: '10px', 
                        border: isSuspended ? '1px solid #cbd5e1' : '1px solid #ef4444', 
                        color: isSuspended ? '#94a3b8' : '#ef4444', 
                        background: 'none', padding: '10px', borderRadius: '8px', width: '100%', 
                        cursor: isSuspended ? 'not-allowed' : 'pointer', fontWeight: '600' 
                      }}
                    >
                      {isSuspended ? "Deactivation Restricted" : "Deactivate My Account"}
                    </button>
                  </div>
                </div>

              <div className="profile-column">
                <div className="form-section security-section">
                  <h3>Security</h3>
                  <p className="section-subtitle">Change your password below.</p>
                  
                  <div className="input-group">
                    <label><FaLock className="input-icon"/> New Password</label>
                    <div className="password-wrapper">
                      <input 
                        type={showPassword ? "text" : "password"} 
                        name="new_password" 
                        value={passwords.new_password} 
                        onChange={handlePasswordChange} 
                        readOnly={isSuspended}
                        placeholder={isSuspended ? "Password change restricted" : "New Password"} 
                        className={`${errors.password ? "input-error" : ""} ${isSuspended ? "read-only-input" : ""}`}
                      />
                      <button type="button" className="toggle-password-btn" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <FaEyeSlash /> : <FaEye />}
                      </button>
                    </div>
                    {errors.password && <span className="field-error-msg">{errors.password}</span>}
                  </div>

                  <div className="input-group">
                    <label><FaLock className="input-icon"/> Confirm Password</label>
                    <div className="password-wrapper">
                      <input 
                        type={showConfirmPassword ? "text" : "password"} 
                        name="confirm_password" 
                        value={passwords.confirm_password} 
                        onChange={handlePasswordChange} 
                        placeholder="Confirm New Password" 
                        className={`${errors.confirm_password ? "input-error" : ""} ${isSuspended ? "read-only-input" : ""}`}
                        disabled={!passwords.new_password || isSuspended}
                        readOnly={isSuspended}
                      />
                      <button type="button" className="toggle-password-btn" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                        {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                      </button>
                    </div>
                    {errors.confirm_password && <span className="field-error-msg">{errors.confirm_password}</span>}
                  </div>
                </div>

                <div className="form-section role-section">
                  <h3>Account Roles</h3>
                  <p className="section-subtitle">Your current verified roles in furlink.</p>
                  {renderRoleBadge()}
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button 
                type="submit" 
                className="save-btn" 
                disabled={saving || isSuspended}
                style={isSuspended ? { backgroundColor: '#94a3b8', cursor: 'not-allowed' } : {}}
              >
                {isSuspended ? <><FaBan /> Saving Restricted</> : <><FaSave /> Save Changes</>}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Modals */}
      {showConfirmModal && (
        <div className="modal-overlay">
          <div className="modal-content confirm-save-modal">
            <div className="modal-icon-wrapper warn"><FaExclamationCircle /></div>
            <h3>Save Changes?</h3>
            <div className="modal-actions-row">
              <button className="modal-btn-cancel" onClick={() => setShowConfirmModal(false)}>Cancel</button>
              <button className="modal-btn-confirm" onClick={confirmSave}>Yes, Save</button>
            </div>
          </div>
        </div>
      )}

      {showDeactivateBlock && (
        <div className="modal-overlay">
          <div className="modal-content small-modal">
            <div className="modal-header" style={{ borderBottom: 'none' }}>
               <h3 style={{ color: '#0E2679' }}>Deactivation Blocked</h3>
               <button className="close-btn" onClick={() => setShowDeactivateBlock(false)}><FaTimes /></button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center', padding: '10px 20px 30px' }}>
              <div style={{ color: '#ef4444', marginBottom: '20px' }}>
                <FaExclamationTriangle size={60} />
              </div>
              <p style={{ color: '#1e293b', fontSize: '1rem', fontWeight: '700' }}>
                You have {activeBookingCount} ongoing booking(s).
              </p>
              <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '12px', lineHeight: '1.6' }}>
                To protect our community, accounts with <strong>Accepted</strong> or <strong>Paid</strong> appointments cannot be deactivated. 
                <br/><br/>
                Please complete these services or cancel them (with manual refunds) before trying again.
              </p>
              <button 
                className="save-btn" 
                style={{ width: '100%', marginTop: '25px', backgroundColor: '#0E2679', alignContent: 'center', display: 'flex', justifyContent: 'center', gap: '8px' }} 
                onClick={() => navigate(userRoleInfo.isProvider ? "/service/dashboard" : "/appointments")}
              >
                Manage My Bookings
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeactivateConfirm && (
      <div className="modal-overlay">
        <div className="modal-content small-modal">
          <div className="modal-header"><h3>Deactivate Account</h3></div>
          <div className="modal-body" style={{ padding: '20px' }}>
            <div style={{ textAlign: 'center', marginBottom: '15px' }}>
              <FaExclamationTriangle size={40} color="#ef4444" />
            </div>
            <p style={{ fontWeight: '700', color: '#1e293b', marginBottom: '10px' }}>
              Are you sure you want to deactivate?
            </p>
            <ul style={{ fontSize: '0.85rem', color: '#475569', paddingLeft: '20px', lineHeight: '1.6' }}>
              {userRoleInfo.isProvider && (
                <li>Your shop listing will be <strong>hidden from the public</strong>.</li>
              )}
              <li>All current and paid bookings will be <strong>automatically cancelled</strong>.</li>
              <li style={{ marginTop: '5px' }}>
                <em>Note: Completed records ("To Rate" and "Rated") will remain in our database for dashboard accuracy.</em>
              </li>
            </ul>
            <div className="modal-actions-row" style={{ marginTop: '20px' }}>
              <button className="modal-btn-cancel" onClick={() => setShowDeactivateConfirm(false)}>Cancel</button>
              <button className="modal-btn-confirm" style={{ background: '#ef4444' }} onClick={handleDeactivateAccount} disabled={deactivating}>
                {deactivating ? "Deactivating..." : "Yes, Deactivate"}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

      {showDeactivateSuccess && (
      <div className="modal-overlay" style={{ zIndex: 9999 }}>
        <div className="modal-content small-modal success-center" style={{ textAlign: 'center', padding: '40px 30px' }}>
          <div style={{ marginBottom: '20px' }}>
            <FaCheckCircle size={60} color="#22c55e" />
          </div>
          <h2 style={{ color: '#0E2679', marginBottom: '15px' }}>Account Deactivated</h2>
          <button 
            className="save-btn" 
            style={{ width: '100%', padding: '14px', fontSize: '1rem', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }} 
            onClick={() => navigate("/login")}
          >
            Return to Login <FaExternalLinkAlt size={14} />
          </button>
        </div>
      </div>
    )}
      <Footer />
    </>
  );
}