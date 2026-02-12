import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash, FaStore, FaQuestionCircle, FaTimes, FaClock } from "react-icons/fa";
import { supabase } from "../../config/supabase";
import "./LoginPage.css"; 
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

  // --- ADD THESE STATES ---
  const [showReactivateModal, setShowReactivateModal] = useState(false);
  const [deactivatedUser, setDeactivatedUser] = useState(null);
  const [daysRemaining, setDaysRemaining] = useState(0);

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

  // --- ADD THIS FUNCTION ---
  const handleReactivate = async () => {
    setLoading(true);
    try {
      // 1. Reactivate Profile
      await supabase.from("profiles").update({ is_active: true, deactivated_at: null }).eq("id", deactivatedUser.id);

      // 2. Reactivate Business (Restore to approved if it was deactivated)
      const { data: prov } = await supabase.from("service_providers").select("status").eq("user_id", deactivatedUser.id).maybeSingle();
      if (prov?.status === 'deactivated') {
        await supabase.from("service_providers").update({ status: 'approved' }).eq("user_id", deactivatedUser.id);
      }

      setShowReactivateModal(false);
      // Re-trigger login flow or refresh
      window.location.reload(); 
    } catch (err) {
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
        supabase.from("profiles").select("role, must_change_password, is_active, deactivated_at").eq("id", data.user.id).single(),
        supabase.from("service_providers").select("status").eq("user_id", data.user.id).maybeSingle()
      ]);

      if (profileRes.error || !profileRes.data) {
        setErrors({ general: "Unable to fetch user profile." });
        return;
      }

      const profile = profileRes.data;
      const provider = providerRes.data;

      if (profile.is_active === false) {
      const deactivationDate = new Date(profile.deactivated_at);
      const diffDays = Math.ceil(Math.abs(new Date() - deactivationDate) / (1000 * 60 * 60 * 24));

      if (diffDays <= 30) {
        setDaysRemaining(30 - diffDays);
        setDeactivatedUser(data.user);
        setShowReactivateModal(true);
        setLoading(false);
        return; // Pause here and show modal
      } else {
        await supabase.auth.signOut();
        setErrors({ general: "This account has passed the 30-day window and is permanently closed." });
        setLoading(false);
        return;
      }
    }

      localStorage.setItem("token", data.session.access_token);

      /* =============================================
        UPDATED REDIRECTION LOGIC
      ============================================= */

      // 1. Admin Logic
      if (profile.role === "admin") {
        return navigate(profile.must_change_password ? "/admin-change-password" : "/admin-dashboard");
      }

      // 2. Both (Hybrid Logic)
      if (profile.role === "both") {
        if (provider?.status === "approved") {
          return navigate("/service/dashboard");
          return;
        } else {
          // No entry, pending, incomplete, or rejected - show Hybrid Prompt
          setLoading(false);
          setShowHybridPrompt(true);
          return;
        }
      }

      // 3. Service Provider Only
      if (profile.role === "service_provider") {
        if (provider?.status === "approved") {
          setLoading(false);
          setShowPetOwnerPromo(true);
          return;
        } else if (!provider || provider.status === "incomplete") {
          // NO ENTRY or INCOMPLETE: Send straight to application
          return navigate("/apply-provider");
        } else if (provider.status === "pending" || provider.status === "rejected") {
          // PENDING or REJECTED: Send to dashboard; Navbar handles the status modals
          return navigate("/dashboard");
        }
      }

      // 4. Pet Owner Only
      if (profile.role === "pet_owner") {
        setLoading(false);
        setShowPromoModal(true);
        return;
      }

      // Fallback
      navigate("/dashboard");
    } finally {
      if (!showHybridPrompt && !showPromoModal && !showPetOwnerPromo) setLoading(false);
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
               <img 
                 src="https://images.unsplash.com/photo-1516733725897-1aa73b87c8e8?q=80&w=1000&auto=format&fit=crop" 
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
               <button className="promo-later-btn" onClick={() => navigate("/dashboard")}>Maybe Later</button>
            </div>
          </div>
        </div>
      )}

      {/* PROMO MODAL FOR SERVICE PROVIDERS (Encouraging them to be Pet Owners) */}
      {showPetOwnerPromo && (
        <div className="promo-overlay">
          <div className="promo-card">
            <button className="promo-close-btn" onClick={() => navigate("/service/dashboard")}>
              <FaTimes />
            </button>
            
            <div className="promo-image-wrapper" onClick={handleBecomeBoth}> {/* Changed this */}
                <img 
                  src="https://images.unsplash.com/photo-1583337130417-3346a1be7dee?q=80&w=1000&auto=format&fit=crop" 
                  alt="Become a pet owner" 
                  className="promo-main-image"
                />
                <div className="promo-overlay-text">
                  <h2>Need Grooming?</h2>
                  <p>Discover and book top-rated pet stylists for your own fur babies!</p>
                  <span className="promo-badge">Explore Shops</span>
                </div>
            </div>

            <div className="promo-footer">
               <button className="promo-later-btn" onClick={() => navigate("/service/dashboard")}>
                 Go to My Shop Dashboard
               </button>
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

      {/* --- ADD THIS MODAL --- */}
      {showReactivateModal && (
        <div className="modal-overlay">
          <div className="modal-content reactivate-modal" style={{ textAlign: 'center', padding: '30px' }}>
            <div className="modal-icon-wrapper warn" style={{ margin: '0 auto 20px', color: '#f59e0b' }}>
              <FaClock size={50} />
            </div>
            <h3>Account Deactivated</h3>
            <p style={{ color: '#475569', fontSize: '0.9rem', marginBottom: '20px' }}>
              Welcome back! Your account is deactivated and scheduled for deletion in <strong>{daysRemaining} days</strong>. 
              Would you like to reactivate your account?
            </p>
            <div className="modal-actions-column">
              <button className="btn-primary" onClick={handleReactivate} disabled={loading}>
                {loading ? "Reactivating..." : "Yes, Reactivate My Account"}
              </button>
              <button className="btn-secondary-outline" onClick={async () => {
                await supabase.auth.signOut();
                setShowReactivateModal(false);
              }}>
                No, keep it deactivated
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