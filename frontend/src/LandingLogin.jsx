import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { saveToken } from "./CompanyAuth";
import { saveCustomerToken } from "./CustomerAuth";

const BASE_URL = "http://localhost:8000";
const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || "";

async function apiRequest(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = typeof data === "string" ? data : JSON.stringify(data, null, 2);
    throw new Error(msg);
  }
  return data;
}

const customerSignupInitial = {
  email: "",
  password: "",
  first_name: "",
  last_name: "",
  location: "",
};

const companySignupInitial = {
  email: "",
  password: "",
  name: "",
  category: "",
  description: "",
  services: "",
  timings: "",
  phone: "",
  address: "",
  city: "",
  country: "",
};

export default function LandingLogin() {
  const [role, setRole] = useState("customer"); // 'customer' | 'company'
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [customerSignup, setCustomerSignup] = useState(customerSignupInitial);
  const [companySignup, setCompanySignup] = useState(companySignupInitial);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const switchToSignup = () => {
    setIsSignup(true);
    setStatus(null);
  };
  const switchToLogin = () => {
    setIsSignup(false);
    setStatus(null);
  };

  const handleCustomerSignupChange = (e) => {
    const { name, value } = e.target;
    setCustomerSignup((prev) => ({ ...prev, [name]: value }));
  };
  const handleCompanySignupChange = (e) => {
    const { name, value } = e.target;
    setCompanySignup((prev) => ({ ...prev, [name]: value }));
  };

  const handleGoogleCompany = useCallback(
    async (response) => {
      try {
        const idToken = response.credential;
        if (!idToken) throw new Error("Missing Google credential.");
        setLoading(true);
        setStatus(null);
        const data = await apiRequest("/api/company/google-login/", { id_token: idToken });
        saveToken(data.token);
        if (data.company) localStorage.setItem("companyData", JSON.stringify(data.company));
        setStatus({ type: "success", message: "Logged in with Google. Redirecting..." });
        setTimeout(() => navigate("/dashboard"), 150);
      } catch (err) {
        setStatus({ type: "error", message: err.message || "Google login failed." });
      } finally {
        setLoading(false);
      }
    },
    [navigate]
  );

  const handleGoogleCustomer = useCallback(
    async (response) => {
      try {
        const idToken = response.credential;
        if (!idToken) throw new Error("Missing Google credential.");
        setLoading(true);
        setStatus(null);
        const data = await apiRequest("/api/customer/google-login/", { id_token: idToken });
        saveCustomerToken(data.token);
        if (data.user) localStorage.setItem("customerData", JSON.stringify(data.user));
        setStatus({ type: "success", message: "Logged in with Google. Redirecting..." });
        setTimeout(() => navigate("/customer/home"), 150);
      } catch (err) {
        setStatus({ type: "error", message: err.message || "Google login failed." });
      } finally {
        setLoading(false);
      }
    },
    [navigate]
  );

  useEffect(() => {
    const initGoogle = () => {
      if (!GOOGLE_CLIENT_ID || !window.google) return;
      const el = document.getElementById("landing-google-btn");
      if (!el) return;
      el.innerHTML = "";
      const callback = role === "company" ? handleGoogleCompany : handleGoogleCustomer;
      try {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback,
        });
        window.google.accounts.id.renderButton(el, {
          theme: "outline",
          size: "large",
          width: "100%",
        });
      } catch (e) {
        console.error("Google button init error:", e);
      }
    };
    if (window.google) {
      initGoogle();
    } else {
      const t = setInterval(() => {
        if (window.google) {
          clearInterval(t);
          initGoogle();
        }
      }, 100);
      return () => clearInterval(t);
    }
  }, [role, handleGoogleCompany, handleGoogleCustomer]);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      if (role === "company") {
        const data = await apiRequest("/api/company/login/", { email, password });
        saveToken(data.token);
        if (data.company) localStorage.setItem("companyData", JSON.stringify(data.company));
        setStatus({ type: "success", message: "Login successful. Redirecting..." });
        setTimeout(() => navigate("/dashboard"), 150);
      } else {
        const data = await apiRequest("/api/customer/login/", { email, password });
        saveCustomerToken(data.token);
        if (data.user) localStorage.setItem("customerData", JSON.stringify(data.user));
        setStatus({ type: "success", message: "Login successful. Redirecting..." });
        setTimeout(() => navigate("/customer/home"), 150);
      }
    } catch (err) {
      setStatus({ type: "error", message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerSignupSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      const data = await apiRequest("/api/customer/signup/", customerSignup);
      saveCustomerToken(data.token);
      if (data.user) localStorage.setItem("customerData", JSON.stringify(data.user));
      setStatus({ type: "success", message: "Account created. Redirecting..." });
      setTimeout(() => navigate("/customer/home"), 150);
    } catch (err) {
      setStatus({ type: "error", message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCompanySignupSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      const data = await apiRequest("/api/company/signup/", companySignup);
      saveToken(data.token);
      if (data.company) localStorage.setItem("companyData", JSON.stringify(data.company));
      setStatus({ type: "success", message: "Account created. Redirecting..." });
      setTimeout(() => navigate("/dashboard"), 150);
    } catch (err) {
      setStatus({ type: "error", message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const bgImage = `${process.env.PUBLIC_URL || ""}/i1.webp`;

  return (
    <div className="landing-login">
      <div
        className="landing-login__bg"
        aria-hidden="true"
        style={{ backgroundImage: `url(${bgImage})` }}
      />
      <div className={`landing-login__card ${isSignup ? "landing-login__card--signup" : ""}`}>
        <h1 className="landing-login__title">Business Trust Platform</h1>
        <p className="landing-login__subtitle">
          {isSignup ? "Create your account" : "Log in to continue"}
        </p>

        <div className="landing-login__tabs">
          <button
            type="button"
            className={`landing-login__tab ${role === "customer" ? "landing-login__tab--active" : ""}`}
            onClick={() => setRole("customer")}
          >
            User
          </button>
          <button
            type="button"
            className={`landing-login__tab ${role === "company" ? "landing-login__tab--active" : ""}`}
            onClick={() => setRole("company")}
          >
            Company
          </button>
        </div>

        {!isSignup ? (
          <form onSubmit={handleLoginSubmit} className="landing-login__form">
            <div className="landing-login__field">
              <label htmlFor="landing-email">Email</label>
              <input
                id="landing-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="landing-login__field">
              <label htmlFor="landing-password">Password</label>
              <input
                id="landing-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <button type="submit" className="landing-login__submit" disabled={loading}>
              {loading ? "Please wait..." : "Log in"}
            </button>
          </form>
        ) : role === "customer" ? (
          <form onSubmit={handleCustomerSignupSubmit} className="landing-login__form">
            <div className="landing-login__field">
              <label htmlFor="su-email">Email</label>
              <input
                id="su-email"
                type="email"
                name="email"
                required
                value={customerSignup.email}
                onChange={handleCustomerSignupChange}
                placeholder="you@example.com"
              />
            </div>
            <div className="landing-login__field">
              <label htmlFor="su-password">Password</label>
              <input
                id="su-password"
                type="password"
                name="password"
                required
                value={customerSignup.password}
                onChange={handleCustomerSignupChange}
                placeholder="••••••••"
              />
            </div>
            <div className="landing-login__row">
              <div className="landing-login__field">
                <label htmlFor="su-first">First Name</label>
                <input
                  id="su-first"
                  type="text"
                  name="first_name"
                  value={customerSignup.first_name}
                  onChange={handleCustomerSignupChange}
                  placeholder="First name"
                />
              </div>
              <div className="landing-login__field">
                <label htmlFor="su-last">Last Name</label>
                <input
                  id="su-last"
                  type="text"
                  name="last_name"
                  value={customerSignup.last_name}
                  onChange={handleCustomerSignupChange}
                  placeholder="Last name"
                />
              </div>
            </div>
            <div className="landing-login__field">
              <label htmlFor="su-location">Location (city / area)</label>
              <input
                id="su-location"
                type="text"
                name="location"
                value={customerSignup.location}
                onChange={handleCustomerSignupChange}
                placeholder="City or area"
              />
            </div>
            <button type="submit" className="landing-login__submit" disabled={loading}>
              {loading ? "Please wait..." : "Sign up"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleCompanySignupSubmit} className="landing-login__form landing-login__form--company">
            <div className="landing-login__field">
              <label htmlFor="cs-email">Email</label>
              <input
                id="cs-email"
                type="email"
                name="email"
                required
                value={companySignup.email}
                onChange={handleCompanySignupChange}
                placeholder="company@example.com"
              />
            </div>
            <div className="landing-login__field">
              <label htmlFor="cs-password">Password</label>
              <input
                id="cs-password"
                type="password"
                name="password"
                required
                value={companySignup.password}
                onChange={handleCompanySignupChange}
                placeholder="••••••••"
              />
            </div>
            <div className="landing-login__field">
              <label htmlFor="cs-name">Company Name</label>
              <input
                id="cs-name"
                type="text"
                name="name"
                required
                value={companySignup.name}
                onChange={handleCompanySignupChange}
                placeholder="Your company name"
              />
            </div>
            <div className="landing-login__field">
              <label htmlFor="cs-category">Category</label>
              <input
                id="cs-category"
                type="text"
                name="category"
                required
                value={companySignup.category}
                onChange={handleCompanySignupChange}
                placeholder="e.g. Printing, Design"
              />
            </div>
            <div className="landing-login__field">
              <label htmlFor="cs-description">Description</label>
              <input
                id="cs-description"
                type="text"
                name="description"
                value={companySignup.description}
                onChange={handleCompanySignupChange}
                placeholder="Short description"
              />
            </div>
            <div className="landing-login__field">
              <label htmlFor="cs-phone">Phone</label>
              <input
                id="cs-phone"
                type="text"
                name="phone"
                value={companySignup.phone}
                onChange={handleCompanySignupChange}
                placeholder="Phone number"
              />
            </div>
            <div className="landing-login__field">
              <label htmlFor="cs-address">Address</label>
              <input
                id="cs-address"
                type="text"
                name="address"
                value={companySignup.address}
                onChange={handleCompanySignupChange}
                placeholder="Street address"
              />
            </div>
            <div className="landing-login__row">
              <div className="landing-login__field">
                <label htmlFor="cs-city">City</label>
                <input
                  id="cs-city"
                  type="text"
                  name="city"
                  value={companySignup.city}
                  onChange={handleCompanySignupChange}
                  placeholder="City"
                />
              </div>
              <div className="landing-login__field">
                <label htmlFor="cs-country">Country</label>
                <input
                  id="cs-country"
                  type="text"
                  name="country"
                  value={companySignup.country}
                  onChange={handleCompanySignupChange}
                  placeholder="Country"
                />
              </div>
            </div>
            <div className="landing-login__field">
              <label htmlFor="cs-services">Services</label>
              <textarea
                id="cs-services"
                name="services"
                value={companySignup.services}
                onChange={handleCompanySignupChange}
                placeholder="e.g. Printing, Binding, Design"
                rows={2}
                className="landing-login__textarea"
              />
            </div>
            <div className="landing-login__field">
              <label htmlFor="cs-timings">Business Hours</label>
              <input
                id="cs-timings"
                type="text"
                name="timings"
                value={companySignup.timings}
                onChange={handleCompanySignupChange}
                placeholder="e.g. Mon–Fri 9AM–6PM"
              />
            </div>
            <button type="submit" className="landing-login__submit" disabled={loading}>
              {loading ? "Please wait..." : "Sign up"}
            </button>
          </form>
        )}

        {status && (
          <p
            className={`landing-login__status ${
              status.type === "success" ? "landing-login__status--success" : "landing-login__status--error"
            }`}
          >
            {status.message}
          </p>
        )}

        <p className="landing-login__signup-text">
          {isSignup ? (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={switchToLogin}
                className="landing-login__signup-link landing-login__signup-link--btn"
              >
                Log in
              </button>
            </>
          ) : (
            <>
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={switchToSignup}
                className="landing-login__signup-link landing-login__signup-link--btn"
              >
                Sign up
              </button>
            </>
          )}
        </p>

        <div className="landing-login__divider">
          <span>Or continue with</span>
        </div>
        <div id="landing-google-btn" className="landing-login__google" />
      </div>
    </div>
  );
}
