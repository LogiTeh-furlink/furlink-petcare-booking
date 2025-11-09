// src/pages/auth/SignUpPage.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { supabase } from "../../config/supabase";
import "../../styles/pages/SignUpPage.css";

import Header from "../../components/Header";
import Footer from "../../components/Footer";

const SignUpPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: "", lastName: "", email: "", mobile: "", dob: "", password: "", confirmPassword: "", agree: false,
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.firstName.trim()) newErrors.firstName = "First name required.";
    if (!formData.lastName.trim()) newErrors.lastName = "Last name required.";
    if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) newErrors.email = "Invalid email.";
    if (!formData.mobile.match(/^(09\d{9}|\+639\d{9})$/)) newErrors.mobile = "Use PH format: 09XXXXXXXXX or +639XXXXXXXXX";
    if (!formData.dob) newErrors.dob = "Date of Birth required.";
    if (formData.dob) {
      const age = new Date().getFullYear() - new Date(formData.dob).getFullYear();
      if (age < 13 || age > 80) newErrors.dob = "Age must be 13–80.";
    }
    if (!formData.password.match(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,12}$/)) newErrors.password = "Password 8–12 chars, upper/lower, number, special char.";
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = "Passwords do not match.";
    if (!formData.agree) newErrors.agree = "You must agree to terms.";
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length) return;

    setLoading(true);
    try {
      const { data: signUpData, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: { data: { first_name: formData.firstName, last_name: formData.lastName, mobile: formData.mobile, dob: formData.dob, display_name: `${formData.firstName} ${formData.lastName}` } },
      });
      if (error) return setErrors({ general: error.message.includes("already registered") ? "Email already used." : "Failed to register." });

      const user = signUpData.user;
      if (user) {
        await supabase.from("profiles").insert([{ id: user.id, first_name: formData.firstName, last_name: formData.lastName, display_name: `${formData.firstName} ${formData.lastName}`, mobile: formData.mobile, dob: formData.dob }]);
        navigate("/dashboard");
      }
    } catch { setErrors({ general: "Something went wrong. Please try again." }); }
    finally { setLoading(false); }
  };

  return (
    <div className="signup-page">
      <Header hideSignup />
      <div className="signup-container">
        <form className="signup-form" onSubmit={handleSubmit}>
          <h2>Create Your Account</h2>
          <div className="form-row">
            <div className="form-group"><input type="text" name="firstName" placeholder="First Name" value={formData.firstName} onChange={handleChange} />{errors.firstName && <p className="error">{errors.firstName}</p>}</div>
            <div className="form-group"><input type="text" name="lastName" placeholder="Last Name" value={formData.lastName} onChange={handleChange} />{errors.lastName && <p className="error">{errors.lastName}</p>}</div>
          </div>
          <div className="form-group"><input type="email" name="email" placeholder="Email Address" value={formData.email} onChange={handleChange} />{errors.email && <p className="error">{errors.email}</p>}</div>
          <div className="form-group"><input type="text" name="mobile" placeholder="Mobile Number" value={formData.mobile} onChange={handleChange} />{errors.mobile && <p className="error">{errors.mobile}</p>}</div>
          <div className="form-group"><label>Date of Birth</label><input type="date" name="dob" value={formData.dob} onChange={handleChange} />{errors.dob && <p className="error">{errors.dob}</p>}</div>
          <div className="form-group password-field"><input type={showPassword ? "text" : "password"} name="password" placeholder="Password" value={formData.password} onChange={handleChange} /><button type="button" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <FaEyeSlash /> : <FaEye />}</button>{errors.password && <p className="error">{errors.password}</p>}</div>
          <div className="form-group password-field"><input type={showConfirmPassword ? "text" : "password"} name="confirmPassword" placeholder="Confirm Password" value={formData.confirmPassword} onChange={handleChange} /><button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>{showConfirmPassword ? <FaEyeSlash /> : <FaEye />}</button>{errors.confirmPassword && <p className="error">{errors.confirmPassword}</p>}</div>
          <div className="form-group checkbox"><input type="checkbox" name="agree" checked={formData.agree} onChange={handleChange} /><label>I agree to the Terms and Privacy Policy</label>{errors.agree && <p className="error">{errors.agree}</p>}</div>
          {errors.general && <p className="error general">{errors.general}</p>}
          <button type="submit" className="btn-primary" disabled={loading}>{loading ? "Creating..." : "Register"}</button>
          <p className="redirect-text">Already have an account? <span className="redirect-link" onClick={() => navigate("/login")}>Login here</span></p>
        </form>
      </div>
      <Footer />
    </div>
  );
};

export default SignUpPage;
