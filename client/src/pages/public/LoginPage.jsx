import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";
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

    // Check for lockout
    if (lockUntil && Date.now() < lockUntil) {
      const secondsLeft = Math.ceil((lockUntil - Date.now()) / 1000);
      setErrors({
        general: `Too many failed attempts. Try again in ${secondsLeft} seconds.`,
      });
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

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, must_change_password")
        .eq("id", data.user.id)
        .single();

      if (profileError || !profile) {
        setErrors({ general: "Unable to fetch user profile." });
        return;
      }

      localStorage.setItem("token", data.session.access_token);

      if (profile.role === "admin") {
        navigate(profile.must_change_password ? "/admin-change-password" : "/admin-dashboard");
      } else {
        navigate("/dashboard");
      }
    } catch {
      setErrors({ general: "Something went wrong. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <Header hideLogin={true} />

      <main className="login-container">
        <form className="login-form" onSubmit={handleSubmit}>
          <h2>
            Login to <i>furlink</i>
          </h2>
          <p className="subtitle">You are a step closer to a hassle-free booking experience</p>

          <div className="form-group">
            <input
              type="email"
              name="email"
              placeholder="Email Address"
              value={formData.email}
              onChange={handleChange}
            />
            {errors.email && <p className="error">{errors.email}</p>}
          </div>

          <div className="form-group password-field">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
            />
            <button
              type="button"
              className="toggle-password"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
            {errors.password && <p className="error">{errors.password}</p>}
          </div>

          {errors.general && <p className="error general">{errors.general}</p>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>

          <p className="redirect-text">
            Don’t have an account?{" "}
            <span className="redirect-link" onClick={() => navigate("/signup")}>
              Sign up here
            </span>
          </p>
        </form>
      </main>

      <Footer />
    </div>
  );
};

export default LoginPage;
