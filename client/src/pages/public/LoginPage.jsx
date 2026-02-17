import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  FaEye, FaEyeSlash, FaStore, FaQuestionCircle, 
  FaTimes, FaClock, FaCheckCircle 
} from "react-icons/fa";
import { supabase } from "../../config/supabase";
import "./LoginPage.css"; 
import becomePetOwnerImg from "../../assets/become-a-pet-owner.png";
import becomeServiceProviderImg from "../../assets/become-a-service-provider.png";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";

const LoginPage = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState(null);

  // Modal State for Hybrid Users
  const [showHybridPrompt, setShowHybridPrompt] = useState(false);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [showPetOwnerPromo, setShowPetOwnerPromo] = useState(false);
  const [showRoleChangeConfirmation, setShowRoleChangeConfirmation] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [agreedToUpgradeTerms, setAgreedToUpgradeTerms] = useState(false);  

  // Handler for when SP clicks "Explore Shops" in the PetOwnerPromo modal
  const initiateUpgradeFromPromo = () => {
    setShowPetOwnerPromo(false); // Close the promo modal first
    setShowUpgradeModal(true);   // Open the legal confirmation modal
    setAgreedToUpgradeTerms(false);
  };

  // Handler for the FINAL database update
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
      setShowRoleChangeConfirmation(true); // Show the final success screen
    } catch (err) {
      console.error("Error upgrading role:", err);
      alert("Failed to update account role.");
    } finally {
      setLoading(false);
    }
  };

  // --- ADD THESE STATES ---
  const [showReactivateModal, setShowReactivateModal] = useState(false);
  const [deactivatedUser, setDeactivatedUser] = useState(null);

  const handleDismissPromo = async (columnName, targetPath) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Save preference to database
        await supabase
          .from("profiles")
          .update({ [columnName]: true })
          .eq("id", user.id);
      }
    } catch (err) {
      console.error("Error saving preference:", err);
    } finally {
      // Always navigate so the user isn't stuck
      navigate(targetPath);
    }
  };

  const handleBecomeBoth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setLoading(true);
      // Update the profiles table
      const { error } = await supabase
        .from("profiles")
        .update({ role: "both" })
        .eq("id", user.id);

      if (error) throw error;

      // Hide the promo and show the success confirmation
      setShowPetOwnerPromo(false);
      setShowRoleChangeConfirmation(true);
    } catch (err) {
      console.error("Error switching role:", err);
      alert("Failed to update account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      newErrors.email = "Enter a valid email address.";
    }
    if (!formData.password) {
      newErrors.password = "Password is required.";
    }
    return newErrors;
  };

  const handleReactivate = async () => {
    setLoading(true);
    try {
      // 1. Restore Profile Status
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ is_active: true, deactivated_at: null })
        .eq("id", deactivatedUser.id);
      
      if (profileErr) throw profileErr;

      // 2. Restore Provider Status (if they were an SP)
      if (deactivatedUser.providerStatus === 'deactivated') {
        await supabase
          .from("service_providers")
          .update({ status: 'approved' })
          .eq("user_id", deactivatedUser.id);
      }

      setShowReactivateModal(false);

      // 3. ROLE-BASED REDIRECTION
      const role = deactivatedUser.role;
      if (role === "service_provider" || role === "both") {
        navigate("/service/dashboard");
      } else {
        navigate("/dashboard");
      }

    } catch (err) {
      console.error("Reactivation Error:", err);
      alert("Reactivation failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    if (lockUntil && Date.now() < lockUntil) {
      const secondsLeft = Math.ceil((lockUntil - Date.now()) / 1000);
      setErrors({ general: `Too many failed attempts. Try again in ${secondsLeft} seconds.` });
      return;
    }

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (error) {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        if (newAttempts >= 3) {
          setLockUntil(Date.now() + 60 * 1000);
          setErrors({ general: "Too many failed attempts. Locked for 1 minute." });
        } else {
          setErrors({ general: "Invalid email or password." });
        }
        return;
      }

      // FETCH PROFILE AND PROVIDER STATUS IN PARALLEL
      const [profileRes, providerRes] = await Promise.all([
        supabase
          .from("profiles")
          // UPDATED: Added suspension_end_date to the selection
          // Change your .select to include the new hidden columns
          .select("role, must_change_password, is_active, suspension_end_date, hide_sp_promo, hide_po_promo")
          .eq("id", data.user.id)
          .single(),
        supabase
          .from("service_providers")
          .select("status")
          .eq("user_id", data.user.id)
          .maybeSingle()
      ]);

      if (profileRes.error || !profileRes.data) {
        setErrors({ general: "Unable to fetch user profile." });
        setLoading(false);
        return;
      }

      const profile = profileRes.data;
      const provider = providerRes.data;

      // --- ETERNAL REACTIVATION CHECK ---
      // Logic Update: Check if they are suspended (suspension date is in future)
      const isSuspended = profile.suspension_end_date && new Date(profile.suspension_end_date) > new Date();

      // Only show "Welcome Back" if they are inactive AND NOT suspended.
      // If they ARE suspended, we skip this block and let them fall through to navigation.
      // The SuspensionGuard in App.jsx will then catch them and show the Lock Screen.
      if (profile.is_active === false && !isSuspended) {
        
        setDeactivatedUser({ 
          id: data.user.id, 
          role: profile.role, 
          providerStatus: provider?.status 
        });
        setShowReactivateModal(true);
        setLoading(false);
        return; // Stop here and wait for modal confirmation
      }

      // If active (or suspended), proceed to store token
      localStorage.setItem("token", data.session.access_token);

      /* =============================================
        UPDATED REDIRECTION LOGIC
      ============================================= */

      // 1. Admin Logic
      if (profile.role === "admin") {
        return navigate(profile.must_change_password ? "/admin-change-password" : "/admin-dashboard");
      }

      // 2. Both (Hybrid Logic)
      // 2. Both (Hybrid Logic)
      if (profile.role === "both") {
        if (provider?.status === "approved") {
          return navigate("/service/dashboard");
        } else if (provider?.status === "incomplete") {
          // If business name exists, they finished step 1, send to step 2
          const target = provider.business_name ? "/service-listing" : "/apply-provider";
          return navigate(target);
        } else if (provider?.status === "rejected" || provider?.status === "pending") {
          return navigate("/dashboard");
        } else {
          setLoading(false);
          setShowHybridPrompt(true);
          return;
        }
      }

      // 3. Service Provider Only
      if (profile.role === "service_provider") {
        if (provider?.status === "approved") {
          if (profile.hide_po_promo) return navigate("/service/dashboard");
          setLoading(false);
          setShowPetOwnerPromo(true);
          return;
        } else if (!provider || provider.status === "incomplete") {
          // Check progress: if business_name is already in DB, skip to listings
          const target = provider?.business_name ? "/service-listing" : "/apply-provider";
          return navigate(target);
        } else if (provider.status === "pending" || provider.status === "rejected") {
          return navigate("/dashboard");
        }
      }

      // 4. Pet Owner Only
      if (profile.role === "pet_owner") {
        // --- ADDED CHECK FOR PENDING/REJECTED STATUS ---
        // If they have an existing application, we skip the promo entirely
        const hasActiveApplication = provider && (provider.status === "pending" || provider.status === "rejected");

        if (profile.hide_sp_promo || hasActiveApplication) {
          return navigate("/dashboard"); 
        }

        setLoading(false);
        setShowPromoModal(true);
        return;
      }

      // Fallback
      navigate("/dashboard");
    } finally {
      if (!showHybridPrompt && !showPromoModal && !showPetOwnerPromo && !showReactivateModal) setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <Header hideLogin={true} />

      <main className="login-container">
        <form className="login-form" onSubmit={handleSubmit}>
          <h2>Login to <i>furlink</i></h2>
          <p className="subtitle">You are a step closer to a hassle-free booking experience</p>

          <div className="form-group">
            <input type="email" name="email" placeholder="Email Address" value={formData.email} onChange={handleChange} />
            {errors.email && <p className="error">{errors.email}</p>}
          </div>

          <div className="form-group password-field">
            <input type={showPassword ? "text" : "password"} name="password" placeholder="Password" value={formData.password} onChange={handleChange} />
            <button type="button" className="toggle-password" onClick={() => setShowPassword(!showPassword)}>
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
            {errors.password && <p className="error">{errors.password}</p>}
          </div>

          {errors.general && <p className="error general">{errors.general}</p>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>

          <p className="redirect-text">
            Don’t have an account? <span className="redirect-link" onClick={() => navigate("/signup")}>Sign up here</span>
          </p>
        </form>
      </main>

      {/* HYBRID ROLE PROMPT MODAL */}
      {showHybridPrompt && (
        <div className="modal-overlay">
          <div className="modal-content hybrid-modal">
            <div className="modal-icon-wrapper info">
              <FaQuestionCircle />
            </div>
            <h3>Continue Application?</h3>
            <p>You registered as both a Pet Owner and a Service Provider. Would you like to set up your grooming shop profile now?</p>
            
            <div className="modal-actions-column">
              <button 
                className="btn-primary" 
                onClick={() => navigate("/apply-provider")}
              >
                <FaStore /> Register as Provider Now
              </button>
              <button 
                className="btn-secondary-outline" 
                onClick={() => navigate("/dashboard")}
              >
                I'll do it later (Go to Dashboard)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW PROMO MODAL FOR STRICT PET OWNERS */}
      {showPromoModal && (
        <div className="promo-overlay">
          <div className="promo-card">
            <button className="promo-close-btn" onClick={() => navigate("/dashboard")}>
              <FaTimes />
            </button>
            <div className="promo-image-wrapper" onClick={() => navigate("/apply-provider")}>
              {/* UPDATED IMAGE SOURCE BELOW */}
              <img 
                src={becomeServiceProviderImg} 
                alt="Become a provider" 
                className="promo-main-image"
              />
              <div className="promo-overlay-text">
                <h2>Love Pets?</h2>
                <p>Earn by becoming a service provider today!</p>
                <span className="promo-badge">Apply Now</span>
              </div>
            </div>
            <div className="promo-footer">
              <button 
                className="promo-later-btn" 
                onClick={() => handleDismissPromo("hide_sp_promo", "/dashboard")}
              >
                Do not show this again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PROMO MODAL FOR SERVICE PROVIDERS */}
      {showPetOwnerPromo && (
        <div className="promo-overlay">
          <div className="promo-card">
            <button className="promo-close-btn" onClick={() => navigate("/service/dashboard")}>
              <FaTimes />
            </button>
            
            {/* Change handleBecomeBoth to initiateUpgradeFromPromo */}
            <div className="promo-image-wrapper" onClick={initiateUpgradeFromPromo}>
                <img src={becomePetOwnerImg} alt="Become a pet owner" className="promo-main-image" />
                <div className="promo-overlay-text">
                  <h2>Need Grooming?</h2>
                  <p>Discover and book top-rated pet stylists for your own fur babies!</p>
                  <span className="promo-badge">Explore Shops</span>
                </div>
            </div>
            <div className="promo-footer">
              <button 
                className="promo-later-btn" 
                onClick={() => handleDismissPromo("hide_po_promo", "/service/dashboard")}
              >
                Do not show this again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UPGRADE LEGAL MODAL */}
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
                <button className="modal-cancel-btn" onClick={() => setShowUpgradeModal(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS CONFIRMATION MODAL */}
      {showRoleChangeConfirmation && (
        <div className="modal-overlay">
          <div className="modal-content hybrid-modal" style={{ textAlign: 'center' }}>
            <div className="modal-icon-wrapper success" style={{ background: '#e6fffa', color: '#38a169', margin: '0 auto 20px' }}>
              <FaStore />
            </div>
            <h3>Account Updated!</h3>
            <p>You are now a <strong>Pet Owner and Service Provider</strong>. You can now browse grooming shops and book appointments while managing your own business.</p>
            
            <div className="modal-actions-column">
              <button 
                className="btn-primary" 
                onClick={() => navigate("/dashboard")}
              >
                Explore Grooming Shops
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REACTIVATION MODAL */}
      {showReactivateModal && (
      <div className="modal-overlay">
        <div className="modal-content reactivate-modal" style={{ textAlign: 'center', padding: '40px 30px' }}>
          <div style={{ marginBottom: '20px', color: '#0E2679' }}>
            <FaCheckCircle size={60} />
          </div>
          
          <h2 style={{ color: '#0E2679', marginBottom: '15px' }}>Welcome Back!</h2>
          
          <p style={{ color: '#475569', fontSize: '1rem', lineHeight: '1.6', marginBottom: '25px' }}>
            Your account is currently <strong>deactivated</strong>. Would you like to reactivate it and restore your grooming records and profile?
          </p>

          <div className="modal-actions-column" style={{ gap: '12px' }}>
            <button 
                className="btn-primary" 
                onClick={handleReactivate} 
                disabled={loading}
                style={{ width: '100%', padding: '14px', fontSize: '1rem' }}
            >
              {loading ? "Reactivating..." : "Yes, Reactivate My Account"}
            </button>
            
            <button 
                className="btn-secondary-outline" 
                style={{ width: '100%', padding: '12px' }}
                onClick={async () => {
                    await supabase.auth.signOut();
                    setShowReactivateModal(false);
                    setDeactivatedUser(null);
                }}
            >
              No, stay deactivated
            </button>
          </div>
        </div>
      </div>
    )}

      <Footer />
    </div>
  );
};

export default LoginPage;