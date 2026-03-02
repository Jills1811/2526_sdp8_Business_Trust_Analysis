import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";

const BASE_URL = "http://localhost:8000";
const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || "";

export function saveCustomerToken(token) {
  localStorage.setItem("customerToken", token);
  try { window.dispatchEvent(new Event("auth-changed")); } catch {}
}

export function getCustomerToken() {
  return localStorage.getItem("customerToken");
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

export function CustomerSignupPage() {
  const [signupForm, setSignupForm] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    location: "",
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
      const data = await apiRequest("/api/customer/signup/", signupForm);
      saveCustomerToken(data.token);
      setSignupStatus({
        type: "success",
        message: "Signup successful! Redirecting to login...",
      });
      console.log("Customer signup response:", data);
      setTimeout(() => navigate("/customer/login"), 1500);
    } catch (err) {
      setSignupStatus({
        type: "error",
        message: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCredentialSignup = useCallback(async (response) => {
    try {
      const idToken = response.credential;
      if (!idToken) {
        throw new Error("Missing Google credential.");
      }
      setLoading(true);
      setSignupStatus(null);

      const data = await apiRequest("/api/customer/google-login/", {
        id_token: idToken,
      });

      saveCustomerToken(data.token);
      if (data.user) {
        localStorage.setItem("customerData", JSON.stringify(data.user));
      }
      setSignupStatus({
        type: "success",
        message: "Signed up with Google. Redirecting...",
      });
      setTimeout(() => navigate("/customer/home"), 150);
    } catch (err) {
      console.error("Google signup error:", err);
      setSignupStatus({
        type: "error",
        message: err.message || "Google signup failed.",
      });
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    const initGoogleButton = () => {
      if (!GOOGLE_CLIENT_ID || !window.google) {
        return;
      }
      const btnElement = document.getElementById("customer-signup-google-btn");
      if (!btnElement) {
        return;
      }
      try {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCredentialSignup,
        });
        window.google.accounts.id.renderButton(
          btnElement,
          { theme: "outline", size: "large", width: "100%" }
        );
      } catch (e) {
        console.error("Failed to initialize Google Identity Services (signup):", e);
      }
    };

    if (window.google) {
      initGoogleButton();
    } else {
      const checkGoogle = setInterval(() => {
        if (window.google) {
          clearInterval(checkGoogle);
          initGoogleButton();
        }
      }, 100);
      return () => clearInterval(checkGoogle);
    }
  }, [handleGoogleCredentialSignup]);

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h2 style={{ marginTop: 0, marginBottom: "0.75rem" }}>
          Customer Signup
        </h2>
        <p style={{ marginTop: 0, marginBottom: "1rem", color: "#6b7280" }}>
          Create your account to browse and review businesses.
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
            { label: "First Name", name: "first_name", type: "text" },
            { label: "Last Name", name: "last_name", type: "text" },
            {
              label: "Location (city / area)",
              name: "location",
              type: "text",
              required: false,
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

        <div
          style={{
            marginTop: "1rem",
            borderTop: "1px solid #e5e7eb",
            paddingTop: "1rem",
          }}
        >
          <p
            style={{
              margin: "0 0 0.5rem",
              fontSize: "0.85rem",
              color: "#6b7280",
              textAlign: "center",
            }}
          >
            Or sign up with
          </p>
          <div id="customer-signup-google-btn" style={{ display: "flex", justifyContent: "center" }} />
        </div>
      </div>
    </div>
  );
}

export function CustomerLoginPage() {
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
      const data = await apiRequest("/api/customer/login/", loginForm);
      saveCustomerToken(data.token);
      if (data.user) {
        localStorage.setItem("customerData", JSON.stringify(data.user));
      }
      setLoginStatus({
        type: "success",
        message: "Login successful. Redirecting...",
      });
      console.log("Customer login response:", data);
      setTimeout(() => navigate("/customer/home"), 150);
    } catch (err) {
      setLoginStatus({
        type: "error",
        message: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCredential = useCallback(async (response) => {
    try {
      const idToken = response.credential;
      if (!idToken) {
        throw new Error("Missing Google credential.");
      }
      setLoading(true);
      setLoginStatus(null);

      const data = await apiRequest("/api/customer/google-login/", {
        id_token: idToken,
      });

      saveCustomerToken(data.token);
      if (data.user) {
        localStorage.setItem("customerData", JSON.stringify(data.user));
      }
      setLoginStatus({
        type: "success",
        message: "Logged in with Google. Redirecting...",
      });
      setTimeout(() => navigate("/customer/home"), 150);
    } catch (err) {
      console.error("Google login error:", err);
      setLoginStatus({
        type: "error",
        message: err.message || "Google login failed.",
      });
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    const initGoogleButton = () => {
      if (!GOOGLE_CLIENT_ID || !window.google) {
        return;
      }
      const btnElement = document.getElementById("customer-google-btn");
      if (!btnElement) {
        return;
      }
      try {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCredential,
        });
        window.google.accounts.id.renderButton(
          btnElement,
          { theme: "outline", size: "large", width: "100%" }
        );
      } catch (e) {
        console.error("Failed to initialize Google Identity Services:", e);
      }
    };

    if (window.google) {
      initGoogleButton();
    } else {
      const checkGoogle = setInterval(() => {
        if (window.google) {
          clearInterval(checkGoogle);
          initGoogleButton();
        }
      }, 100);
      return () => clearInterval(checkGoogle);
    }
  }, [handleGoogleCredential]);

  return (
    <div style={containerStyle}>
      <div style={{ ...cardStyle, maxWidth: "360px" }}>
        <h2 style={{ marginTop: 0, marginBottom: "0.75rem" }}>Customer Login</h2>
        <p style={{ marginTop: 0, marginBottom: "1rem", color: "#6b7280" }}>
          Access your account to browse businesses.
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

        <div
          style={{
            marginTop: "1rem",
            borderTop: "1px solid #e5e7eb",
            paddingTop: "1rem",
          }}
        >
          <p
            style={{
              margin: "0 0 0.5rem",
              fontSize: "0.85rem",
              color: "#6b7280",
              textAlign: "center",
            }}
          >
            Or continue with
          </p>
          <div id="customer-google-btn" style={{ display: "flex", justifyContent: "center" }} />
        </div>
      </div>
    </div>
  );
}

export function CustomerHomePage() {
  const [customer, setCustomer] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [recLoading, setRecLoading] = useState(true);
  const [recExpanded, setRecExpanded] = useState(false);
  const navigate = useNavigate();

  const REC_INITIAL = 4;
  const displayedRec = recExpanded ? recommendations : recommendations.slice(0, REC_INITIAL);
  const hasMoreRec = recommendations.length > REC_INITIAL;

  useEffect(() => {
    const stored = localStorage.getItem("customerData");
    if (stored) {
      try {
        setCustomer(JSON.parse(stored));
      } catch (e) {
        setCustomer(null);
      }
    }
  }, []);

  useEffect(() => {
    const loadRecommendations = async () => {
      setRecLoading(true);
      const url = `${BASE_URL}/api/company/recommendations/`;
      try {
        const token = getCustomerToken();
        const headers = token ? { Authorization: `Token ${token}` } : {};
        const res = await fetch(url, { headers });
        const json = await res.json();
        setRecommendations(Array.isArray(json.recommendations) ? json.recommendations : []);
      } catch {
        setRecommendations([]);
      } finally {
        setRecLoading(false);
      }
    };
    loadRecommendations();
  }, []);

  useEffect(() => {
    // Fetch companies list
    const fetchCompanies = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${BASE_URL}/api/mongo/companies/`);
        if (!res.ok) {
          throw new Error("Failed to fetch companies");
        }
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.companies || [];
        setCompanies(list);
        setError(null);
      } catch (err) {
        setError(err.message);
        console.error("Error fetching companies:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCompanies();
  }, []);

  return (
  <div
    style={{
      minHeight: "100vh",
      padding: "2.5rem 1.5rem",
      background: "radial-gradient(circle at top, #eef2ff, #f8fafc)",
      fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    }}
  >
    <div style={{ maxWidth: "1250px", margin: "0 auto" }}>

      {/* Header Card */}
      <div
        style={{
          background: "rgba(255,255,255,0.9)",
          backdropFilter: "blur(12px)",
          padding: "2rem",
          borderRadius: "1rem",
          boxShadow: "0 20px 45px rgba(15,23,42,0.12)",
          marginBottom: "2.2rem",
          border: "1px solid rgba(99,102,241,0.12)",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: "0.4rem", fontSize: "1.6rem", fontWeight: 800 }}>
          Customer Home
        </h2>

        {customer ? (
          <p style={{ margin: 0, color: "#475569", fontSize: "0.95rem" }}>
            Welcome back,&nbsp;
            <strong>
              {customer.first_name || customer.last_name
                ? `${customer.first_name || ""} ${customer.last_name || ""}`.trim()
                : customer.email}
            </strong>
            !
          </p>
        ) : (
          <p style={{ margin: 0, color: "#64748b" }}>
            Please log in to continue.
          </p>
        )}

        <button
          onClick={() => navigate("/customer/login")}
          style={{
            marginTop: "1.1rem",
            padding: "0.55rem 1.4rem",
            borderRadius: "999px",
            border: "1px solid #c7d2fe",
            background: "linear-gradient(135deg,#eef2ff,#ffffff)",
            cursor: "pointer",
            fontWeight: 600,
            color: "#4f46e5",
          }}
        >
          Switch account
        </button>
      </div>

      {/* Recommendations */}
      <div
        style={{
          background: "rgba(255,255,255,0.9)",
          backdropFilter: "blur(12px)",
          padding: "2rem",
          borderRadius: "1rem",
          boxShadow: "0 20px 45px rgba(15,23,42,0.12)",
          marginBottom: "2.2rem",
          border: "1px solid rgba(99,102,241,0.12)",
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: "0.4rem", fontSize: "1.35rem", fontWeight: 700 }}>
          Recommended for you
        </h3>

        <p style={{ margin: "0 0 1.25rem", color: "#475569", fontSize: "0.9rem" }}>
          Personalized recommendations based on your recent views, search activity, location, and business reputation.
        </p>

        {recLoading ? (
          <p style={{ color: "#64748b" }}>Loading recommendations...</p>
        ) : recommendations.length === 0 ? (
          <p style={{ color: "#64748b" }}>No recommendations yet.</p>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                gap: "1rem",
              }}
            >
              {displayedRec.map((c) => (
                <div
                  key={c.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: "1rem",
                    padding: "1.2rem",
                    background: "linear-gradient(180deg,#ffffff,#f9fafb)",
                    transition: "all 0.2s ease",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-6px) scale(1.01)";
                    e.currentTarget.style.boxShadow = "0 15px 30px rgba(15,23,42,0.15)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "none";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <p style={{ margin: 0, fontSize: "0.75rem", fontWeight: 600, color: "#6366f1" }}>
                    {c.category}
                  </p>

                  <h4 style={{ margin: "0.3rem 0 0.35rem", fontSize: "1.05rem", fontWeight: 700 }}>
                    {c.name}
                  </h4>

                  {c.city && c.country && (
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "#475569" }}>
                      📍 {c.city}, {c.country}
                    </p>
                  )}

                  <p style={{ margin: "0.45rem 0 0", fontSize: "0.85rem", fontWeight: 700, color: "#15803d" }}>
                    Reputation: {(c.reputation_score ?? 0).toFixed(1)} / 100
                  </p>

                  <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 600, color: "#2563eb" }}>
                    Rating: {(c.average_rating ?? 0).toFixed(1)} / 5.0
                  </p>

                  <Link to={`/companies/${c.id}`}>
                    <button
                      style={{
                        marginTop: "0.75rem",
                        padding: "0.45rem 1.3rem",
                        borderRadius: "999px",
                        border: "1px solid #c7d2fe",
                        background: "white",
                        color: "#4f46e5",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      View
                    </button>
                  </Link>
                </div>
              ))}
            </div>

            {hasMoreRec && (
              <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
                <button
                  type="button"
                  onClick={() => setRecExpanded((e) => !e)}
                  style={{
                    padding: "0.6rem 1.6rem",
                    borderRadius: "999px",
                    border: "1px solid #c7d2fe",
                    background: "linear-gradient(135deg,#eef2ff,#ffffff)",
                    cursor: "pointer",
                    fontWeight: 600,
                    color: "#4f46e5",
                  }}
                >
                  {recExpanded ? "Show Less ▲" : `Show More (${recommendations.length - REC_INITIAL}) ▼`}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Browse Companies */}
      <div
        style={{
          background: "rgba(255,255,255,0.9)",
          backdropFilter: "blur(12px)",
          padding: "2rem",
          borderRadius: "1rem",
          boxShadow: "0 20px 45px rgba(15,23,42,0.12)",
          border: "1px solid rgba(99,102,241,0.12)",
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: "1.25rem", fontSize: "1.35rem", fontWeight: 700 }}>
          Browse Companies
        </h3>

        {loading ? (
          <p style={{ color: "#64748b" }}>Loading companies...</p>
        ) : error ? (
          <p style={{ color: "#b91c1c" }}>Error: {error}</p>
        ) : companies.length === 0 ? (
          <p style={{ color: "#64748b" }}>No companies found.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: "1.2rem",
            }}
          >
            {companies.map((company) => (
              <div
                key={company.id}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: "1rem",
                  padding: "1.25rem",
                  background: "linear-gradient(180deg,#ffffff,#f8fafc)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-6px) scale(1.01)";
                  e.currentTarget.style.boxShadow = "0 16px 30px rgba(15,23,42,0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "none";
                  e.currentTarget.style.boxShadow = "none";
                }}
                onClick={() => navigate(`/companies/${company.id}`)}
              >
                <h4 style={{ margin: "0 0 0.6rem", fontSize: "1.05rem", fontWeight: 700 }}>
                  {company.name}
                </h4>

                <p style={{ margin: "0 0 0.5rem", fontSize: "0.85rem", color: "#475569" }}>
                  <strong>Category:</strong> {company.category}
                </p>

                {company.description && (
                  <p style={{ margin: "0 0 0.6rem", fontSize: "0.85rem", color: "#64748b" }}>
                    {company.description.length > 100
                      ? `${company.description.substring(0, 100)}...`
                      : company.description}
                  </p>
                )}

                {company.average_rating > 0 && (
                  <p style={{ margin: "0 0 0.5rem", fontSize: "0.85rem", color: "#1d4ed8", fontWeight: 600 }}>
                    ⭐ {company.average_rating.toFixed(1)} / 5.0
                  </p>
                )}

                {company.city && company.country && (
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b" }}>
                    📍 {company.city}, {company.country}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  </div>
);
}

