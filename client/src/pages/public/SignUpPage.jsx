import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash, FaExclamationTriangle, FaCheckCircle, FaFileContract, FaTimes } from "react-icons/fa";
import { supabase } from "../../config/supabase";

import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";

import "./SignUpPage.css";

const SignUpPage = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    mobile: "",
    dob: "",
    password: "",
    confirmPassword: "",
    roleChoice: "", 
  });

  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [showTermsModal, setShowTermsModal] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showHybridWelcomeModal, setShowHybridWelcomeModal] = useState(false);

  const validate = () => {
    let newErrors = {};
    if (!formData.firstName.trim()) newErrors.firstName = true;
    if (!formData.lastName.trim()) newErrors.lastName = true;
    if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) newErrors.email = true;
    if (!formData.mobile.match(/^9\d{9}$/)) newErrors.mobile = true;
    if (!formData.roleChoice) newErrors.roleChoice = "Please select a role.";
    if (!formData.dob) {
      newErrors.dob = true;
    } else {
      const dobDate = new Date(formData.dob);
      const age = new Date().getFullYear() - dobDate.getFullYear();
      if (age < 13) newErrors.dob = "Must be at least 13 years old.";
    }
    if (!formData.password.match(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,12}$/)) newErrors.password = true;
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = true;
    return newErrors;
  };

  const handleRegisterClick = (e) => {
    e.preventDefault();
    setSubmitted(true);
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length === 0) {
      setShowTermsModal(true); 
    }
  };

  const handleFinalSubmit = async () => {
  if (!agreedToTerms) return;
  setLoading(true);
  setShowTermsModal(false);

  try {
    // 1. Auth SignUp
    const { data: signUpData, error: authError } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
    });

    if (authError) throw authError;

    const user = signUpData.user;
    if (user) {
      // 2. Use UPSERT instead of INSERT to avoid "Duplicate Key" errors
      // This handles cases where a DB trigger might have already created the row
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert([
          {
            id: user.id,
            first_name: formData.firstName,
            last_name: formData.lastName,
            display_name: `${formData.firstName} ${formData.lastName}`,
            mobile_number: formData.mobile, 
            date_of_birth: formData.dob,    
            role: formData.roleChoice === 'service_provider' ? 'service_provider' : 'pet_owner' 
          },
        ], { onConflict: 'id' }); // Explicitly tell it to resolve conflicts on 'id'

      if (profileError) throw profileError;

      // 3. Create Session Record
      await supabase.from("user_sessions").insert([{ user_id: user.id }]);

      // 4. Handle Redirections (Now reachable since errors are caught/resolved)
      if (formData.roleChoice === "pet_owner") {
        navigate("/dashboard");
      } else if (formData.roleChoice === "service_provider") {
        navigate("/apply-provider");
      } else if (formData.roleChoice === "both") {
        // For 'both', redirect to dashboard then show the modal
        navigate("/dashboard");
        setTimeout(() => setShowHybridWelcomeModal(true), 500);
      }
    }
  } catch (err) {
    console.error("Registration error:", err);
    setErrors({ general: err.message });
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="signup-page">
      <Header hideSignup={true} />
      <div className="signup-container">
        <form className="signup-form" onSubmit={handleRegisterClick}>
          <h2>Create Your Account</h2>
          <p className="subtitle">Join the Furlink community today</p>

          {errors.general && <div className="general-error">{errors.general}</div>}

          <div className="form-row">
            <input type="text" placeholder="First Name" className={submitted && errors.firstName ? "input-error" : ""} value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} />
            <input type="text" placeholder="Last Name" className={submitted && errors.lastName ? "input-error" : ""} value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} />
          </div>

          <div className={`form-group ${submitted && errors.email ? "has-error" : ""}`}>
            <input type="email" placeholder="Email Address" className={submitted && errors.email ? "input-error" : ""} value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
          </div>
          
          <div className="phone-input-wrapper">
             <span className="country-code">+63</span>
             <input 
                type="text" 
                placeholder="9XXXXXXXXX" 
                className={submitted && errors.mobile ? "input-error" : ""} 
                value={formData.mobile} 
                onChange={(e) => setFormData({ ...formData, mobile: e.target.value })} 
             />
          </div>

          <div className="form-group">
            <label className="input-label">Date of Birth</label>
            <input type="date" className={submitted && errors.dob ? "input-error" : ""} value={formData.dob} onChange={(e) => setFormData({ ...formData, dob: e.target.value })} />
          </div>

          <div className="form-group">
            <label className="input-label">I want to join as a:</label>
            <select className={`role-dropdown ${submitted && errors.roleChoice ? "input-error" : ""}`} value={formData.roleChoice} onChange={(e) => setFormData({...formData, roleChoice: e.target.value})}>
              <option value="" disabled>Select your primary role</option>
              <option value="pet_owner">Pet Owner</option>
              <option value="both">Both (Pet Owner & Provider)</option>
              <option value="service_provider">Service Provider Only</option>
            </select>
          </div>

          <div className="password-group">
             <input type={showPassword ? "text" : "password"} placeholder="Password" className={submitted && errors.password ? "input-error" : ""} value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} />
             <button type="button" className="toggle-btn" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <FaEyeSlash /> : <FaEye />}</button>
          </div>
          <div className="password-group">
             <input type={showConfirmPassword ? "text" : "password"} placeholder="Confirm Password" className={submitted && errors.confirmPassword ? "input-error" : ""} value={formData.confirmPassword} onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})} />
             <button type="button" className="toggle-btn" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>{showConfirmPassword ? <FaEyeSlash /> : <FaEye />}</button>
          </div>

          <button className="btn-primary" type="submit" disabled={loading}>{loading ? "Processing..." : "Register"}</button>
        </form>
      </div>

      {showTermsModal && (
        <div className="modal-overlay">
          <div className="modal-content terms-modal-container">
            <div className="modal-header">
              <FaFileContract className="icon-brand" /> <h3>Terms & Privacy Policy</h3>
              <button className="close-btn-x" onClick={() => setShowTermsModal(false)}><FaTimes /></button>
            </div>
            <div className="modal-body-scrollable">
              <h4>Terms and Conditions</h4>
              <p>Sample terms content...</p>
              <h4>Privacy Policy</h4>
              <p>Sample privacy content...</p>
            </div>
            <div className="modal-footer-sticky">
              <label className="checkbox-agreement-label">
                <input type="checkbox" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} />
                <span>I agree to the Terms and Condition and Privacy Policy</span>
              </label>
              <div className="modal-action-btns">
                <button type="button" className="btn-cancel-modal" onClick={() => setShowTermsModal(false)}>Cancel</button>
                <button type="button" className="btn-continue-modal" onClick={handleFinalSubmit} disabled={!agreedToTerms}>Continue</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showHybridWelcomeModal && (
        <div className="modal-overlay">
          <div className="modal-content welcome-modal" style={{textAlign: 'center'}}>
            <FaCheckCircle className="success-icon" style={{fontSize: '3rem', color: '#48bb78', marginBottom: '1rem'}} />
            <h3>Account Created!</h3>
            <p>Would you like to set up your business profile now?</p>
            <div style={{display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '1.5rem'}}>
              <button onClick={() => navigate("/apply-provider")} className="btn-primary">Register as Provider Now</button>
              <button onClick={() => navigate("/dashboard")} className="btn-cancel-modal">I'll do it later</button>
            </div>
          </div>
        </div>
      )}
      <Footer />
    </div>
  );
};

export default SignUpPage;