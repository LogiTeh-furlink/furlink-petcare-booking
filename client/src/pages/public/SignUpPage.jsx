import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash, FaCheckCircle, FaExclamationCircle} from "react-icons/fa";
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

  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showHybridWelcomeModal, setShowHybridWelcomeModal] = useState(false);

  // 1. UPDATED VALIDATE FUNCTION
  const validate = () => {
    let newErrors = {};
    if (!formData.firstName.trim()) newErrors.firstName = "First name is required.";
    if (!formData.lastName.trim()) newErrors.lastName = "Last name is required.";
    if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) newErrors.email = "Invalid email format.";
    if (!formData.mobile.match(/^9\d{9}$/)) newErrors.mobile = "Mobile must be 10 digits starting with 9.";
    if (!formData.roleChoice) newErrors.roleChoice = "Please select at least one role.";
    
    // DOB Validation (Checking MM/DD/YYYY format)
    if (!formData.dob.match(/^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/)) {
      newErrors.dob = "Format must be MM/DD/YYYY.";
    } else {
      const [m, d, y] = formData.dob.split("/").map(Number);
      const dobDate = new Date(y, m - 1, d);
      const age = new Date().getFullYear() - dobDate.getFullYear();
      if (age < 13) newErrors.dob = "Must be at least 13 years old.";
    }

    if (!formData.password.match(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,12}$/)) {
      newErrors.password = "Must be 8-12 chars with upper, lower, number & symbol.";
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match.";
    }
    return newErrors;
  };

  // 2. NUMERIC ONLY MOBILE HANDLER
  const handleMobileChange = (e) => {
    const val = e.target.value.replace(/\D/g, ""); // Remove non-digits
    if (val.length <= 10) {
      setFormData({ ...formData, mobile: val });
    }
  };

  // 3. DOB MASK HANDLER (MM/DD/YYYY)
  const handleDobChange = (e) => {
    let val = e.target.value.replace(/\D/g, "");
    if (val.length > 8) val = val.slice(0, 8);
    
    // Add slashes automatically
    if (val.length >= 5) {
      val = `${val.slice(0, 2)}/${val.slice(2, 4)}/${val.slice(4)}`;
    } else if (val.length >= 3) {
      val = `${val.slice(0, 2)}/${val.slice(2)}`;
    }
    setFormData({ ...formData, dob: val });
  };

  const handleRoleToggle = (selectedRole) => {
    let currentRole = formData.roleChoice;
    let newRole = "";

    if (selectedRole === "pet_owner") {
      if (currentRole === "pet_owner") newRole = "";
      else if (currentRole === "service_provider") newRole = "both"; 
      else if (currentRole === "both") newRole = "service_provider";
      else newRole = "pet_owner";
    } else if (selectedRole === "service_provider") {
      if (currentRole === "service_provider") newRole = "";
      else if (currentRole === "pet_owner") newRole = "both";
      else if (currentRole === "both") newRole = "pet_owner";
      else newRole = "service_provider";
    }

    setFormData({ ...formData, roleChoice: newRole });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    const validationErrors = validate();
    
    // Add checkbox validation
    if (!agreedToTerms) validationErrors.terms = "You must agree to the terms.";
    
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length === 0) {
      setLoading(true);
      try {
        const { data: signUpData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
        });
        if (authError) throw authError;

        const user = signUpData.user;
        if (user) {
          const { error: profileError } = await supabase.from("profiles").upsert([
            {
              id: user.id,
              first_name: formData.firstName,
              last_name: formData.lastName,
              display_name: `${formData.firstName} ${formData.lastName}`,
              mobile_number: formData.mobile,
              date_of_birth: formData.dob,
              role: formData.roleChoice 
            },
          ]);
          if (profileError) throw profileError;

          if (formData.roleChoice === "service_provider") navigate("/apply-provider");
          else {
            navigate("/dashboard");
            if (formData.roleChoice === "both") setTimeout(() => setShowHybridWelcomeModal(true), 500);
          }
        }
      } catch (err) {
        setErrors({ general: err.message });
      } finally {
        setLoading(false);
      }
    }
  };

  const isPetOwner = formData.roleChoice === "pet_owner" || formData.roleChoice === "both";
  const isProvider = formData.roleChoice === "service_provider" || formData.roleChoice === "both";
  const isBoth = formData.roleChoice === "both";

  const SUPABASE_PROJECT_ID = "mdhudfatvdipxwufcbis"; 
  const BASE_URL = `https://mdhudfatvdipxwufcbis.supabase.co/storage/v1/object/public/agreements`;

  const getTermsLink = () => {
    if (formData.roleChoice === "service_provider") return `${BASE_URL}/terms_sp.pdf`;
    if (formData.roleChoice === "pet_owner") return `${BASE_URL}/terms_po.pdf`;
    return `${BASE_URL}/terms_general.pdf`;
  };

// You can use this for the Privacy Policy link
const getPrivacyPath = () => `${BASE_URL}/privacy_policy.pdf`;

const isFormValid = Object.keys(validate()).length === 0 && agreedToTerms;

  return (
    <div className="signup-page">
      <Header hideSignup={true} />
      <div className="signup-container">
        <form className="signup-form" onSubmit={handleRegister}>
          <h2>Create Your Account</h2>
          <p className="subtitle">Join the Furlink community today</p>

          {errors.general && (
          <div className="error-alert-box animate-shake">
            <div className="alert-icon">
              <FaExclamationCircle />
            </div>
            <div className="alert-content">
              <p className="alert-title">Registration Failed</p>
              <p className="alert-message">
                {errors.general.includes("already registered") 
                  ? "This email is already associated with an account. Please try logging in instead." 
                  : errors.general}
              </p>
            </div>
          </div>
        )}

          <div className="form-row">
            <div className="input-wrap">
              <input 
                type="text" 
                placeholder="First Name" 
                className={submitted && errors.firstName ? "input-error" : ""} 
                value={formData.firstName} 
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} 
              />
              {submitted && errors.firstName && <span className="field-error-msg"><FaExclamationCircle /> {errors.firstName}</span>}
            </div>
            <div className="input-wrap">
              <input 
                type="text" 
                placeholder="Last Name" 
                className={submitted && errors.lastName ? "input-error" : ""} 
                value={formData.lastName} 
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} 
              />
              {submitted && errors.lastName && <span className="field-error-msg"><FaExclamationCircle /> {errors.lastName}</span>}
            </div>
          </div>

          <div className="form-group">
            <input 
              type="email" 
              placeholder="Email Address" 
              className={submitted && errors.email ? "input-error" : ""} 
              value={formData.email} 
              onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
            />
            {submitted && errors.email && <span className="field-error-msg"><FaExclamationCircle /> {errors.email}</span>}
          </div>
          
          <div className="form-group">
            <div className={`phone-input-wrapper ${submitted && errors.mobile ? "input-error" : ""}`}>
               <span className="country-code">+63</span>
               <input 
                  type="text" 
                  placeholder="9XXXXXXXXX" 
                  value={formData.mobile} 
                  onChange={handleMobileChange} 
               />
            </div>
            {submitted && errors.mobile && <span className="field-error-msg"><FaExclamationCircle /> {errors.mobile}</span>}
          </div>

          <div className="form-group" style={{marginTop: '1.25rem'}}>
            <label className="input-label">Date of Birth</label>
            <input 
              type="text" 
              placeholder="MM/DD/YYYY"
              className={submitted && errors.dob ? "input-error" : ""} 
              value={formData.dob} 
              onChange={handleDobChange} 
            />
            {submitted && errors.dob && <span className="field-error-msg"><FaExclamationCircle /> {errors.dob}</span>}
          </div>

          <div className="form-group">
            <label className="input-label">I want to join as a:</label>
            <div className="role-selection-group">
              <button type="button" className={`role-btn ${isPetOwner ? "active" : ""}`} onClick={() => handleRoleToggle("pet_owner")}>Pet Owner</button>
              <button type="button" className={`role-btn ${isProvider ? "active" : ""}`} onClick={() => handleRoleToggle("service_provider")}>Service Provider</button>
            </div>
            {submitted && errors.roleChoice && <span className="field-error-msg"><FaExclamationCircle /> {errors.roleChoice}</span>}
          </div>

          <div className="password-group">
            <div className="input-with-icon" style={{ position: 'relative' }}>
              <input 
                type={showPassword ? "text" : "password"} 
                placeholder="Password" 
                className={submitted && errors.password ? "input-error" : ""} 
                value={formData.password} 
                onChange={(e) => setFormData({...formData, password: e.target.value})} 
              />
              <button type="button" className="toggle-btn" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
            {/* The error message is now OUTSIDE the icon's coordinate system */}
            {submitted && errors.password && <span className="field-error-msg"><FaExclamationCircle /> {errors.password}</span>}
          </div>

          <div className="password-group">
             <input 
                type={showConfirmPassword ? "text" : "password"} 
                placeholder="Confirm Password" 
                className={submitted && errors.confirmPassword ? "input-error" : ""} 
                value={formData.confirmPassword} 
                onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})} 
             />
             <button type="button" className="toggle-btn" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>{showConfirmPassword ? <FaEyeSlash /> : <FaEye />}</button>
             {submitted && errors.confirmPassword && <span className="field-error-msg"><FaExclamationCircle /> {errors.confirmPassword}</span>}
          </div>

          {/* NEW TERMS CHECKBOX */}
          <div className={`terms-checkbox-group ${submitted && errors.terms ? "checkbox-error" : ""}`}>
            <input 
              type="checkbox" 
              id="terms-checkbox" 
              checked={agreedToTerms} 
              onChange={(e) => setAgreedToTerms(e.target.checked)} 
            />
            <label htmlFor="terms-checkbox">
              I agree to the{" "}
              <a href={getTermsLink()} target="_blank" rel="noreferrer">
                Terms and Conditions
              </a>{" "}
              and{" "}
              <a href={getPrivacyPath()} target="_blank" rel="noreferrer">
                Privacy Policy
              </a>{" "}
              of Furlink
            </label>
          </div>
          {submitted && errors.terms && <span className="field-error-msg" style={{marginBottom: '1rem'}}><FaExclamationCircle /> {errors.terms}</span>}

          <button 
            className="btn-primary" 
            type="submit" 
            disabled={loading || !isFormValid}
          >
            {loading ? "Processing..." : "Register"}
          </button>
          
          <div className="login-redirect">
            <p>Already have an account? <span className="login-link" onClick={() => navigate("/login")}>Login here</span></p>
          </div>
        </form>
      </div>

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