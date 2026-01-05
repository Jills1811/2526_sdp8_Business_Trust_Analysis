import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const BASE_URL = "http://localhost:8000"; // change if your backend runs elsewhere

function saveToken(token) {
  localStorage.setItem("companyToken", token);
  try { window.dispatchEvent(new Event("auth-changed")); } catch {}
}

export function getCompanyToken() {
  return localStorage.getItem("companyToken");
}

async function apiRequest(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    const errorMessage =
      typeof data === "string" ? data : JSON.stringify(data, null, 2);
    throw new Error(errorMessage);
  }
  return data;
}

const containerStyle = {
  minHeight: "100vh",
  display: "flex",
  justifyContent: "center",
  alignItems: "flex-start",
  padding: "2rem",
  background: "#f5f5f5",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
};

const cardStyle = {
  background: "#ffffff",
  padding: "1.5rem",
  borderRadius: "0.75rem",
  boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
  maxWidth: "420px",
  width: "100%",
};

export function CompanySignupPage() {
  const [signupForm, setSignupForm] = useState({
    email: "",
    password: "",
    name: "",
    category: "",
    description: "",
    phone: "",
    address: "",
    city: "",
    country: "",
  });

  const [signupStatus, setSignupStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignupChange = (e) => {
    const { name, value } = e.target;
    setSignupForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSignupStatus(null);

    try {
      const data = await apiRequest("/api/company/signup/", signupForm);
      saveToken(data.token);
      setSignupStatus({
        type: "success",
        message: "Signup successful! Redirecting to login...",
      });
      console.log("Company signup response:", data);
      // Redirect to login page after successful signup
      setTimeout(() => navigate("/company/login"), 1500);
    } catch (err) {
      setSignupStatus({
        type: "error",
        message: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h2 style={{ marginTop: 0, marginBottom: "0.75rem" }}>
          Company Signup
        </h2>
        <p style={{ marginTop: 0, marginBottom: "1rem", color: "#6b7280" }}>
          Create your company account to access the dashboard.
        </p>
        <form onSubmit={handleSignupSubmit}>
          {[
            { label: "Email", name: "email", type: "email", required: true },
            {
              label: "Password",
              name: "password",
              type: "password",
              required: true,
            },
            { label: "Company Name", name: "name", type: "text", required: true },
            { label: "Category", name: "category", type: "text", required: true },
            { label: "Description", name: "description", type: "text" },
            { label: "Phone", name: "phone", type: "text" },
            { label: "Address", name: "address", type: "text" },
            { label: "City", name: "city", type: "text" },
            { label: "Country", name: "country", type: "text" },
          ].map((field) => (
            <div key={field.name} style={{ marginBottom: "0.75rem" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.25rem",
                  fontSize: "0.85rem",
                  color: "#374151",
                }}
              >
                {field.label}
              </label>
              <input
                type={field.type}
                name={field.name}
                required={field.required}
                value={signupForm[field.name]}
                onChange={handleSignupChange}
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.375rem",
                  border: "1px solid #d1d5db",
                  fontSize: "0.9rem",
                }}
              />
            </div>
          ))}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "0.6rem 1rem",
              borderRadius: "0.5rem",
              border: "none",
              background: loading ? "#9ca3af" : "#2563eb",
              color: "white",
              fontWeight: 600,
              cursor: loading ? "default" : "pointer",
              marginTop: "0.25rem",
            }}
          >
            {loading ? "Please wait..." : "Sign Up"}
          </button>

          {signupStatus && (
            <div
              style={{
                marginTop: "0.75rem",
                fontSize: "0.85rem",
                color: signupStatus.type === "success" ? "#15803d" : "#b91c1c",
                whiteSpace: "pre-wrap",
              }}
            >
              {signupStatus.message}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

export function CompanyLoginPage() {
  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });

  const [loginStatus, setLoginStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLoginChange = (e) => {
    const { name, value } = e.target;
    setLoginForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setLoginStatus(null);

    try {
      const data = await apiRequest("/api/company/login/", loginForm);
      saveToken(data.token);
      if (data.company) {
        localStorage.setItem("companyData", JSON.stringify(data.company));
      }
      setLoginStatus({
        type: "success",
        message: "Login successful. Token saved in localStorage.",
      });
      console.log("Company login response:", data);
      // Redirect to business dashboard after a brief tick so UI can update.
      setTimeout(() => navigate("/dashboard"), 150);
    } catch (err) {
      setLoginStatus({
        type: "error",
        message: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={containerStyle}>
      <div style={{ ...cardStyle, maxWidth: "360px" }}>
        <h2 style={{ marginTop: 0, marginBottom: "0.75rem" }}>Company Login</h2>
        <p style={{ marginTop: 0, marginBottom: "1rem", color: "#6b7280" }}>
          Access your existing company account.
        </p>
        <form onSubmit={handleLoginSubmit}>
          {[
            { label: "Email", name: "email", type: "email", required: true },
            {
              label: "Password",
              name: "password",
              type: "password",
              required: true,
            },
          ].map((field) => (
            <div key={field.name} style={{ marginBottom: "0.75rem" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.25rem",
                  fontSize: "0.85rem",
                  color: "#374151",
                }}
              >
                {field.label}
              </label>
              <input
                type={field.type}
                name={field.name}
                required={field.required}
                value={loginForm[field.name]}
                onChange={handleLoginChange}
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.375rem",
                  border: "1px solid #d1d5db",
                  fontSize: "0.9rem",
                }}
              />
            </div>
          ))}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "0.6rem 1rem",
              borderRadius: "0.5rem",
              border: "none",
              background: loading ? "#9ca3af" : "#10b981",
              color: "white",
              fontWeight: 600,
              cursor: loading ? "default" : "pointer",
              marginTop: "0.25rem",
            }}
          >
            {loading ? "Please wait..." : "Login"}
          </button>

          {loginStatus && (
            <div
              style={{
                marginTop: "0.75rem",
                fontSize: "0.85rem",
                color: loginStatus.type === "success" ? "#15803d" : "#b91c1c",
                whiteSpace: "pre-wrap",
              }}
            >
              {loginStatus.message}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

export function CompanyHomePage() {
  const [company, setCompany] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const stored = localStorage.getItem("companyData");
    if (stored) {
      try {
        setCompany(JSON.parse(stored));
      } catch (e) {
        setCompany(null);
      }
    }
  }, []);

  return (
    <div style={containerStyle}>
      <div style={{ ...cardStyle, maxWidth: "520px" }}>
        <h2 style={{ marginTop: 0, marginBottom: "0.75rem" }}>
          Company Home
        </h2>
        {company ? (
          <>
            <p style={{ margin: "0 0 0.5rem", color: "#374151" }}>
              Welcome back, <strong>{company.name}</strong>.
            </p>
            <p style={{ margin: "0 0 1rem", color: "#6b7280" }}>
              Category: {company.category} • Email: {company.email || "N/A"}
            </p>
            <button
              className="btn btn-outline"
              onClick={() => navigate("/company/login")}
            >
              Switch account
            </button>
          </>
        ) : (
          <>
            <p style={{ color: "#6b7280", margin: "0 0 1rem" }}>
              No company data found. Please log in again.
            </p>
            <button
              className="btn btn-primary"
              onClick={() => navigate("/company/login")}
            >
              Go to login
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// Optional combined layout (not used now but kept if needed elsewhere)
export default function CompanyAuth() {
  return (
    <div
      style={{
        ...containerStyle,
        justifyContent: "center",
        alignItems: "flex-start",
        gap: "2rem",
      }}
    >
      <CompanySignupPage />
      <CompanyLoginPage />
    </div>
  );
}
