import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const BASE_URL = "http://localhost:8000";

function saveCustomerToken(token) {
  localStorage.setItem("customerToken", token);
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
      </div>
    </div>
  );
}

export function CustomerHomePage() {
  const [customer, setCustomer] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

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
    // Fetch companies list
    const fetchCompanies = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${BASE_URL}/api/company/`);
        if (!res.ok) {
          throw new Error("Failed to fetch companies");
        }
        const data = await res.json();
        setCompanies(data);
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
        padding: "2rem",
        background: "#f5f5f5",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <div
          style={{
            background: "#ffffff",
            padding: "1.5rem",
            borderRadius: "0.75rem",
            boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
            marginBottom: "2rem",
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: "0.5rem" }}>
            Customer Home
          </h2>
          {customer ? (
            <p style={{ margin: 0, color: "#6b7280" }}>
              Welcome back,{" "}
              <strong>
                {customer.first_name || customer.last_name
                  ? `${customer.first_name || ""} ${customer.last_name || ""}`.trim()
                  : customer.email}
              </strong>
              !
            </p>
          ) : (
            <p style={{ margin: 0, color: "#6b7280" }}>
              Please log in to continue.
            </p>
          )}
          <button
            onClick={() => navigate("/customer/login")}
            style={{
              marginTop: "1rem",
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              border: "1px solid #d1d5db",
              background: "transparent",
              cursor: "pointer",
              fontSize: "0.9rem",
            }}
          >
            Switch account
          </button>
        </div>

        <div
          style={{
            background: "#ffffff",
            padding: "1.5rem",
            borderRadius: "0.75rem",
            boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: "1rem" }}>
            Browse Companies
          </h3>

          {loading ? (
            <p style={{ color: "#6b7280" }}>Loading companies...</p>
          ) : error ? (
            <p style={{ color: "#b91c1c" }}>Error: {error}</p>
          ) : companies.length === 0 ? (
            <p style={{ color: "#6b7280" }}>
              No companies found. Companies will appear here once they register.
            </p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: "1rem",
              }}
            >
              {companies.map((company) => (
                <div
                  key={company.id}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: "0.5rem",
                    padding: "1rem",
                    background: "#f8fafc",
                    cursor: "pointer",
                    transition: "transform 0.08s ease, box-shadow 0.08s ease, border-color 0.08s ease",
                  }}
                  onClick={() => navigate(`/companies/${company.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate(`/companies/${company.id}`);
                    }
                  }}
                >
                  <h4 style={{ margin: "0 0 0.5rem", color: "#0b1224" }}>
                    {company.name}
                  </h4>
                  <p
                    style={{
                      margin: "0 0 0.5rem",
                      fontSize: "0.85rem",
                      color: "#475569",
                    }}
                  >
                    <strong>Category:</strong> {company.category}
                  </p>
                  {company.description && (
                    <p
                      style={{
                        margin: "0 0 0.5rem",
                        fontSize: "0.85rem",
                        color: "#64748b",
                      }}
                    >
                      {company.description.length > 100
                        ? `${company.description.substring(0, 100)}...`
                        : company.description}
                    </p>
                  )}
                  {company.average_rating > 0 && (
                    <p
                      style={{
                        margin: "0 0 0.5rem",
                        fontSize: "0.85rem",
                        color: "#475569",
                      }}
                    >
                      <strong>Rating:</strong> ⭐ {company.average_rating.toFixed(1)} / 5.0
                      {company.total_reviews > 0 && (
                        <span> ({company.total_reviews} reviews)</span>
                      )}
                    </p>
                  )}
                  {company.city && company.country && (
                    <p
                      style={{
                        margin: "0",
                        fontSize: "0.85rem",
                        color: "#64748b",
                      }}
                    >
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

