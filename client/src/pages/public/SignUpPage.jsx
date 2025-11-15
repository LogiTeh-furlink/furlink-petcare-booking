import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";
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
    agree: false,
  });

  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const validate = () => {
    let newErrors = {};

    if (!formData.firstName.trim()) newErrors.firstName = true;
    if (!formData.lastName.trim()) newErrors.lastName = true;

    if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/))
      newErrors.email = true;

    if (!formData.mobile.match(/^9\d{9}$/))
      newErrors.mobile = true;

    if (!formData.dob) {
      newErrors.dob = true;
    } else {
      const dob = new Date(formData.dob);
      const today = new Date();
      const age = today.getFullYear() - dob.getFullYear();
      if (age < 13 || age > 80) newErrors.dob = true;
    }

    if (
      !formData.password.match(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,12}$/
      )
    ) {
      newErrors.password = true;
    }

    if (formData.password !== formData.confirmPassword)
      newErrors.confirmPassword = true;

    if (!formData.agree) newErrors.agree = true;

    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitted(true);

    const validationErrors = validate();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) return;

    setLoading(true);

    try {
      const { data: signUpData, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
            mobile: formData.mobile,
            dob: formData.dob,
            display_name: `${formData.firstName} ${formData.lastName}`,
          },
        },
      });

      if (error) {
        // Supabase duplicate email detection
        if (error.message?.toLowerCase().includes("already registered")) {
            setErrors({ email: "Email  is already in use." });
        } 
        
        // Email format issues from Supabase
        else if (error.message?.toLowerCase().includes("invalid email")) {
            setErrors({ email: "Invalid email format." });
        }

        // Weak password error from Supabase
        else if (error.message?.toLowerCase().includes("password")) {
            setErrors({ password: "Password does not meet requirements." });
        }

        // Generic fallback
        else {
            setErrors({ general: error.message });
        }

        return;
        }

      const user = signUpData.user;

      if (user) {
        await supabase.from("profiles").insert([
          {
            id: user.id,
            first_name: formData.firstName,
            last_name: formData.lastName,
            display_name: `${formData.firstName} ${formData.lastName}`,
            mobile: formData.mobile,
            dob: formData.dob,
          },
        ]);

        await supabase.from("user_sessions").insert([
          {
            user_id: user.id,
            ip_address: window.location.hostname,
            user_agent: navigator.userAgent,
          },
        ]);

        navigate("/dashboard");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-page">
      <Header hideSignup={true} />

      <div className="signup-container">
        <form className="signup-form" onSubmit={handleSubmit}>
          <h2>Create Your Account</h2>
          <p className="subtitle">You are a step closer to a hassle-free booking experience</p>

          {/* FIRST + LAST NAME */}
          <div className="form-row">
            <div className={`form-group ${submitted && errors.firstName ? "has-error" : ""}`}>
              <input
                type="text"
                name="firstName"
                placeholder="First Name"
                value={formData.firstName}
                onChange={(e) =>
                  setFormData({ ...formData, firstName: e.target.value })
                }
              />
            </div>

            <div className={`form-group ${submitted && errors.lastName ? "has-error" : ""}`}>
              <input
                type="text"
                name="lastName"
                placeholder="Last Name"
                value={formData.lastName}
                onChange={(e) =>
                  setFormData({ ...formData, lastName: e.target.value })
                }
              />
            </div>
          </div>

          {/* EMAIL */}
          <div className={`form-group ${submitted && errors.email ? "has-error" : ""}`}>
            <input
                type="email"
                name="email"
                placeholder="Enter a valid email address."
                value={formData.email}
                onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
                }
            />
            {submitted && errors.email === "duplicate" && (
                <span className="error-text">Email is already registered.</span>
            )}
            </div>

          {/* MOBILE */}
          <div className={`form-group ${submitted && errors.mobile ? "has-error" : ""}`}>
            <input
              type="text"
              name="mobile"
              placeholder="Enter a valid Philippine number (Ex: 9XXXXXXXXX)."
              value={formData.mobile}
              onChange={(e) =>
                setFormData({ ...formData, mobile: e.target.value })
              }
            />
          </div>

          {/* DOB */}
          <div className={`form-group ${submitted && errors.dob ? "has-error" : ""}`}>
            <label>Date of Birth</label>
            <input
              type="date"
              name="dob"
              value={formData.dob}
              onChange={(e) =>
                setFormData({ ...formData, dob: e.target.value })
              }
            />
          </div>

          {/* PASSWORD */}
            <div className={`form-group password-field ${submitted && errors.password ? "has-error" : ""}`}>
            <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Enter your secure password."
                value={formData.password}
                onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
                }
            />
            <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="toggle-password"
            >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
            </div>

            {/* REQUIREMENTS LIST BELOW THE FIELD */}
            {submitted && errors.password && (
            <ul className="password-rules">
                <li>• Must include 8-12 characters long</li>
                <li>• Must include an uppercase letter (A-Z)</li>
                <li>• Must include a lowercase letter (a-z)</li>
                <li>• Must include a number (0-9)</li>
                <li>• Must include a special character (!@#$%^&*)</li>
            </ul>
            )}

          {/* CONFIRM PASSWORD */}
          <div className={`form-group password-field ${submitted && errors.confirmPassword ? "has-error" : ""}`}>
            <input
              type={showConfirmPassword ? "text" : "password"}
              name="confirmPassword"
              placeholder="Confirm Password"
              value={formData.confirmPassword}
              onChange={(e) =>
                setFormData({ ...formData, confirmPassword: e.target.value })
              }
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="toggle-password"
            >
              {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>

          {/* TERMS + CLICKABLE LINKS */}
          <div className={`form-group checkbox-group ${submitted && errors.agree ? "has-error" : ""}`}>
            <label className="checkbox-wrapper">
              <input
                type="checkbox"
                name="agree"
                checked={formData.agree}
                onChange={(e) =>
                  setFormData({ ...formData, agree: e.target.checked })
                }
              />
              <span>
                I agree to the{" "}
                <span className="link" onClick={() => navigate("/terms-and-conditions")}>
                  Terms
                </span>{" "}
                and{" "}
                <span className="link" onClick={() => navigate("/privacy-policy")}>
                  Privacy Policy
                </span>
              </span>
            </label>

            {submitted && errors.agree && <span className="warning-icon">!</span>}
          </div>

          {/* Specific email error */}
            {submitted && errors.email && typeof errors.email === "string" && (
            <p className="field-error">{errors.email}</p>
            )}

            {/* Specific password error */}
            {submitted && errors.password && typeof errors.password === "string" && (
            <p className="field-error">{errors.password}</p>
            )}

            {/* Generic fallback */}
            {submitted && errors.general && (
            <p className="general-error">{errors.general}</p>
            )}

          <button className="btn-primary" disabled={loading}>
            {loading ? "Creating..." : "Register"}
          </button>

          <p className="redirect-text">
            Already have an account?{" "}
            <span onClick={() => navigate("/login")} className="redirect-link">
              Login here
            </span>
          </p>
        </form>
      </div>

      <Footer />
    </div>
  );
};

export default SignUpPage;
