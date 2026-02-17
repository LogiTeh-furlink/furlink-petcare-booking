import React, { useState, useEffect  } from "react";
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
  const [touched, setTouched] = useState({});

const handleBlur = async (e) => {
    const { name, value } = e.target;
    if (!name) return;

    // 1. Mark the field as touched immediately
    setTouched((prev) => ({ ...prev, [name]: true }));

    // 2. Clear general error if user is re-editing the email field
    // This makes the red alert box disappear as they try to fix the email
    if (name === "email") {
      setErrors(prev => {
        const { general, ...rest } = prev;
        return rest;
      });
    }

    // 3. IMMEDIATE EMAIL CHECK (only if format is already valid)
    if (name === "email" && value && !errors.email) {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", value)
          .maybeSingle();

        if (data) {
          // If user exists, set the general error for the top alert box
          setErrors(prev => ({ 
            ...prev, 
            general: "This email is already associated with an account. Please try logging in instead." 
          }));
        } else {
          // Explicitly clear general error if the email is confirmed available
          setErrors(prev => {
            const { general, ...rest } = prev;
            return rest;
          });
        }
      } catch (err) {
        console.error("Error checking email availability:", err);
      }
    }
  };

  const [submitted, setSubmitted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false); 
  const [showHybridWelcomeModal, setShowHybridWelcomeModal] = useState(false);

  // 1. Move the validation function here
  const validateForm = () => {
    let newErrors = {};
    if (!formData.firstName.trim()) newErrors.firstName = "First name is required.";
    if (!formData.lastName.trim()) newErrors.lastName = "Last name is required.";
    
    if (formData.email && !formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      newErrors.email = "Invalid format.";
    } else if (!formData.email) {
      newErrors.email = "Required.";
    }

    if (formData.mobile && !formData.mobile.match(/^9\d{9}$/)) {
      newErrors.mobile = "Must be 9XXXXXXXXX.";
    } else if (!formData.mobile) {
      newErrors.mobile = "Required.";
    }

    // DOB Validation (Inside validateForm)
    if (!formData.dob.match(/^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/)) {
      newErrors.dob = "Format: MM/DD/YYYY";
    } else {
      const [m, d, y] = formData.dob.split("/").map(Number);
      const dobDate = new Date(y, m - 1, d);
      const today = new Date();

      // 1. Prevent future dates
      if (dobDate > today) {
        newErrors.dob = "Birth date cannot be a future date";
      } else {
        // 2. Precise Age Calculation
        let age = today.getFullYear() - dobDate.getFullYear();
        const monthDiff = today.getMonth() - dobDate.getMonth();
        
        // Adjust age if the birthday hasn't happened yet this year
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dobDate.getDate())) {
          age--;
        }

        if (age < 13) {
          newErrors.dob = "You must be at least 13 years old.";
        }
      }
    }

    if (!formData.roleChoice) newErrors.roleChoice = "Select at least one role.";

    if (formData.password && !formData.password.match(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,12}$/)) {
      newErrors.password = "Password must be 8-12 characters with uppercase, lowercase, number, and symbol.";
    } else if (!formData.password) {
      newErrors.password = "Required.";
    }

    if (formData.confirmPassword !== formData.password) {
      newErrors.confirmPassword = "Passwords must match.";
    }

    if (!agreedToTerms) newErrors.terms = "Agreement required.";

    return newErrors;
  };

  // 2. Run validation every time state changes
  useEffect(() => {
      const validationErrors = validateForm();
      
      setErrors(prev => {
        // If a general error exists in the current state, keep it 
        // while updating all the field-level validation errors
        if (prev.general) {
          return { ...validationErrors, general: prev.general };
        }
        return validationErrors;
      });
    }, [formData, agreedToTerms]);

  // 3. Define the validity flag
  // The form is valid if there are no field errors, regardless of previous general failures
    const isFormValid = Object.keys(errors).filter(key => key !== 'general').length === 0 && 
                      agreedToTerms && 
                      formData.firstName !== ""

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
    setTouched(prev => ({ ...prev, roleChoice: true }));
  };

  const handleRegister = async (e) => {
        e.preventDefault();
        setSubmitted(true);
        
        // ADD THIS: Mark everything as touched so errors show up on click
        const allFields = ["firstName", "lastName", "email", "mobile", "dob", "password", "confirmPassword", "roleChoice"];
        const touchAll = {};
        allFields.forEach(field => touchAll[field] = true);
        setTouched(touchAll);

        // Clear any previous general registration errors before trying again
        setErrors(prev => {
            const { general, ...rest } = prev;
            return rest;
        });

        // CHANGE THIS LINE:
        const validationErrors = validateForm();
    
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
      // ... existing try logic
      } catch (err) {
        // Check if it's a "User already registered" error
        if (err.message.includes("already registered") || err.message.includes("User already exists")) {
          setErrors({ general: "This email is already associated with an account. Please try logging in instead." });
        } else {
          setErrors({ general: err.message });
        }
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
                name="firstName"
                placeholder="First Name" 
                className={`${touched.firstName && errors.firstName ? "input-error" : ""}`}
                value={formData.firstName} 
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} 
                onBlur={handleBlur}
              />
              {touched.firstName && errors.firstName && <span className="field-error-msg"><FaExclamationCircle /> {errors.firstName}</span>}
            </div>
            <div className="input-wrap">
              <input 
                type="text" 
                name="lastName"
                placeholder="Last Name" 
                className={`${touched.lastName && errors.lastName ? "input-error" : ""}`}
                value={formData.lastName} 
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} 
                onBlur={handleBlur}
              />
              {touched.lastName && errors.lastName && <span className="field-error-msg"><FaExclamationCircle /> {errors.lastName}</span>}
            </div>
          </div>

          <div className="form-group">
            <input 
              type="email" 
              name="email"
              placeholder="Email Address" 
              className={`${touched.email && errors.email ? "input-error" : ""}`} 
              value={formData.email} 
              onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
              onBlur={handleBlur}
            />
            {touched.email && errors.email && <span className="field-error-msg"><FaExclamationCircle /> {errors.email}</span>}
          </div>
          
          <div className="form-group">
            <div className={`phone-input-wrapper ${touched.mobile && errors.mobile ? "input-error" : ""}`}>
               <span className="country-code">+63</span>
               <input 
                  type="text" 
                  name="mobile"
                  placeholder="9XXXXXXXXX" 
                  value={formData.mobile} 
                  onChange={handleMobileChange} 
                  onBlur={handleBlur}
               />
            </div>
            {touched.mobile && errors.mobile && <span className="field-error-msg"><FaExclamationCircle /> {errors.mobile}</span>}
          </div>

          <div className="form-group" style={{marginTop: '1.25rem'}}>
            <label className="input-label">Date of Birth</label>
            <input 
              type="text" 
              name="dob"
              placeholder="MM/DD/YYYY"
              className={`${touched.dob && errors.dob ? "input-error" : ""}`} 
              value={formData.dob} 
              onChange={handleDobChange} 
              onBlur={handleBlur}
            />
            {touched.dob && errors.dob && <span className="field-error-msg"><FaExclamationCircle /> {errors.dob}</span>}
          </div>

          <div className="form-group">
            <label className="input-label">I want to join as a:</label>
            <div className="role-selection-group">
              <button type="button" className={`role-btn ${isPetOwner ? "active" : ""}`} onClick={() => handleRoleToggle("pet_owner")}>Pet Owner</button>
              <button type="button" className={`role-btn ${isProvider ? "active" : ""}`} onClick={() => handleRoleToggle("service_provider")}>Service Provider</button>
            </div>
            {touched.roleChoice && errors.roleChoice && <span className="field-error-msg"><FaExclamationCircle /> {errors.roleChoice}</span>}
          </div>

          <div className="password-group">
            <div className="input-with-icon" style={{ position: 'relative' }}>
              <input 
                type={showPassword ? "text" : "password"} 
                name="password"
                placeholder="Password" 
                className={`${touched.password && errors.password ? "input-error" : ""}`} 
                value={formData.password} 
                onChange={(e) => setFormData({...formData, password: e.target.value})} 
                onBlur={handleBlur}
              />
              <button type="button" className="toggle-btn" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
            {/* The error message is now OUTSIDE the icon's coordinate system */}
            {touched.password && errors.password && <span className="field-error-msg"><FaExclamationCircle /> {errors.password}</span>}
          </div>

          <div className="password-group">
             <input 
                type={showConfirmPassword ? "text" : "password"} 
                name="confirmPassword"
                placeholder="Confirm Password" 
                className={`${touched.confirmPassword && errors.confirmPassword ? "input-error" : ""}`} 
                value={formData.confirmPassword} 
                onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})} 
                onBlur={handleBlur}
             />
             <button type="button" className="toggle-btn" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>{showConfirmPassword ? <FaEyeSlash /> : <FaEye />}</button>
             {touched.confirmPassword && errors.confirmPassword && <span className="field-error-msg"><FaExclamationCircle /> {errors.confirmPassword}</span>}
          </div>

          {/* NEW TERMS CHECKBOX */}
          <div className={`terms-checkbox-group ${touched.terms && errors.terms ? "checkbox-error" : ""}`}>
            <input 
              type="checkbox" 
              id="terms-checkbox" 
              checked={agreedToTerms} 
              onChange={(e) => setAgreedToTerms(e.target.checked)} 
              onBlur={handleBlur}
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
          {touched.terms && errors.terms && <span className="field-error-msg" style={{marginBottom: '1rem'}}><FaExclamationCircle /> {errors.terms}</span>}

          <button 
            className="btn-primary" 
            type="submit" 
            disabled={loading || !isFormValid}
            style={{ 
              opacity: isFormValid ? 1 : 0.5, 
              cursor: isFormValid ? 'pointer' : 'not-allowed',
            }}
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