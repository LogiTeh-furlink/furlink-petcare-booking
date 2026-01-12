import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash, FaStore, FaQuestionCircle } from "react-icons/fa";
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
        supabase.from("profiles").select("role, must_change_password").eq("id", data.user.id).single(),
        supabase.from("service_providers").select("status").eq("user_id", data.user.id).maybeSingle()
      ]);

      if (profileRes.error || !profileRes.data) {
        setErrors({ general: "Unable to fetch user profile." });
        return;
      }

      const profile = profileRes.data;
      const provider = providerRes.data;

      localStorage.setItem("token", data.session.access_token);

      /* =============================================
        UPDATED REDIRECTION LOGIC
      ============================================= */

      // 1. Admin Logic
      if (profile.role === "admin") {
        return navigate(profile.must_change_password ? "/admin-change-password" : "/admin-dashboard");
      }

      // 2. Both (Pet Owner & Service Provider)
      if (profile.role === "both") {
        if (provider?.status === "approved") {
          return navigate("/service/dashboard");
        } else if (!provider) {
          // If no record in service_providers table yet, show the prompt
          setLoading(false);
          setShowHybridPrompt(true); // This will now trigger correctly
          return;
        } else {
          // Application is pending or rejected, default to pet owner view
          return navigate("/dashboard");
        }
      }

      // 3. Service Provider Only
      if (profile.role === "service_provider") {
        if (provider?.status === "approved") {
          return navigate("/service/dashboard");
        } else {
          return navigate("/apply-provider");
        }
      }

      // 4. Default / Pet Owner Only
      navigate("/dashboard");

    } catch (err) {
      console.error(err);
      setErrors({ general: "Something went wrong. Please try again." });
    } finally {
      if (!showHybridPrompt) setLoading(false);
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

      <Footer />
    </div>
  );
};

export default LoginPage;