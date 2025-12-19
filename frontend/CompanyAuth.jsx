import React, { useState } from "react";

const BASE_URL = "http://localhost:8000"; // change if your backend runs elsewhere

function saveToken(token) {
  localStorage.setItem("companyToken", token);
}

export function getCompanyToken() {
  return localStorage.getItem("companyToken");
}

async function apiRequest(path, body) {
  // 🔹 Remove empty-string fields (important for DRF serializers)
  const cleanedBody =
    body && typeof body === "object"
      ? Object.fromEntries(
          Object.entries(body).filter(
            ([_, value]) => value !== ""
          )
        )
      : body;

  let res;
  let data;

  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cleanedBody),
    });

    // 🔹 Safely parse JSON (even on errors)
    data = await res.json();
  } catch (networkError) {
    console.error("Network / parsing error:", networkError);
    throw new Error("Unable to connect to server. Please try again.");
  }

  // 🔴 Handle backend validation / auth errors
  if (!res.ok) {
    let errorMessage = "Request failed";

    if (typeof data === "string") {
      errorMessage = data;
    } else if (typeof data === "object") {
      // DRF validation errors come as { field: [msg] }
      errorMessage = Object.entries(data)
        .map(([field, messages]) => {
          if (Array.isArray(messages)) {
            return `${field}: ${messages.join(" ")}`;
          }
          return `${field}: ${messages}`;
        })
        .join("\n");
    }

    console.error("API error response:", data);
    throw new Error(errorMessage);
  }

  return data;
}


export default function CompanyAuth() {
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

  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });

  const [signupStatus, setSignupStatus] = useState(null); // { type: 'success'|'error', message: string }
  const [loginStatus, setLoginStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSignupChange = (e) => {
    const { name, value } = e.target;
    setSignupForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleLoginChange = (e) => {
    const { name, value } = e.target;
    setLoginForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSignupStatus(null);

    try {
      const cleanedForm = Object.fromEntries(
        Object.entries(signupForm).filter(
          ([_, value]) => value !== ""
        )
      );
      
      const data = await apiRequest("/api/company/signup/", cleanedForm);
      
      saveToken(data.token);
      setSignupStatus({
        type: "success",
        message: "Signup successful. Token saved in localStorage.",
      });
      console.log("Company signup response:", data);
    } catch (err) {
      setSignupStatus({
        type: "error",
        message: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setLoginStatus(null);

    try {
      const data = await apiRequest("/api/company/login/", loginForm);
      saveToken(data.token);
      setLoginStatus({
        type: "success",
        message: "Login successful. Token saved in localStorage.",
      });
      console.log("Company login response:", data);
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
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        gap: "2rem",
        padding: "2rem",
        background: "#f5f5f5",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* Signup Card */}
      <div
        style={{
          background: "#ffffff",
          padding: "1.5rem",
          borderRadius: "0.75rem",
          boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
          maxWidth: "420px",
          width: "100%",
        }}
      >
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

      {/* Login Card */}
      <div
        style={{
          background: "#ffffff",
          padding: "1.5rem",
          borderRadius: "0.75rem",
          boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
          maxWidth: "360px",
          width: "100%",
        }}
      >
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


