import React, { useEffect, useState } from "react";
import { getCustomerToken } from "./CustomerAuth";

const BASE_URL = "http://localhost:8000";

const pageStyle = {
  minHeight: "100vh",
  background: "#f5f5f5",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  padding: "2rem",
};

const cardStyle = {
  background: "#ffffff",
  borderRadius: "0.75rem",
  padding: "1.5rem",
  boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
  maxWidth: "560px",
  margin: "0 auto",
};

export default function CustomerProfile() {
  const [form, setForm] = useState({
    email: "",
    first_name: "",
    last_name: "",
    location: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  const token = getCustomerToken();

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/customer/me/`, {
          headers: { Authorization: `Token ${token}` },
        });
        if (!res.ok) {
          setStatus({
            type: "error",
            message: "Please log in as a customer to view your profile.",
          });
          setLoading(false);
          return;
        }
        const data = await res.json();
        setForm({
          email: data.email || "",
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          location: data.location || "",
        });
        setLoading(false);
      } catch (err) {
        console.error("Error loading customer profile:", err);
        setStatus({
          type: "error",
          message: "Failed to load profile.",
        });
        setLoading(false);
      }
    };

    if (token) {
      run();
    } else {
      setStatus({
        type: "error",
        message: "Please log in as a customer to view your profile.",
      });
      setLoading(false);
    }
  }, [token]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatus(null);

    try {
      const payload = {
        first_name: form.first_name,
        last_name: form.last_name,
        location: form.location,
      };
      const res = await fetch(`${BASE_URL}/api/customer/me/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to save profile.");
      }

      // Persist basic customer data in localStorage for the home page
      const stored = {
        id: data.id,
        email: data.email,
        first_name: data.first_name,
        last_name: data.last_name,
        location: data.location,
      };
      localStorage.setItem("customerData", JSON.stringify(stored));

      setStatus({ type: "success", message: "Profile updated successfully." });
    } catch (err) {
      console.error("Error saving customer profile:", err);
      setStatus({ type: "error", message: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h2 style={{ marginTop: 0, marginBottom: "0.75rem" }}>Your Profile</h2>
        <p style={{ marginTop: 0, marginBottom: "1rem", color: "#6b7280" }}>
          Update your basic details and preferred location. This will be used to personalize recommendations.
        </p>

        {loading ? (
          <p style={{ color: "#6b7280" }}>Loading profile...</p>
        ) : (
          <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.25rem",
                  fontSize: "0.85rem",
                  color: "#374151",
                }}
              >
                Email (read-only)
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                disabled
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.375rem",
                  border: "1px solid #d1d5db",
                  background: "#f9fafb",
                  color: "#6b7280",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: "140px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.25rem",
                    fontSize: "0.85rem",
                    color: "#374151",
                  }}
                >
                  First name
                </label>
                <input
                  type="text"
                  name="first_name"
                  value={form.first_name}
                  onChange={handleChange}
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "0.375rem",
                    border: "1px solid #d1d5db",
                  }}
                />
              </div>
              <div style={{ flex: 1, minWidth: "140px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.25rem",
                    fontSize: "0.85rem",
                    color: "#374151",
                  }}
                >
                  Last name
                </label>
                <input
                  type="text"
                  name="last_name"
                  value={form.last_name}
                  onChange={handleChange}
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "0.375rem",
                    border: "1px solid #d1d5db",
                  }}
                />
              </div>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.25rem",
                  fontSize: "0.85rem",
                  color: "#374151",
                }}
              >
                Location (city / area)
              </label>
              <input
                type="text"
                name="location"
                value={form.location}
                onChange={handleChange}
                placeholder="e.g., Anand, Gujarat"
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.375rem",
                  border: "1px solid #d1d5db",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary"
              style={{ alignSelf: "flex-start", marginTop: "0.5rem" }}
            >
              {saving ? "Saving..." : "Save changes"}
            </button>

            {status && (
              <p
                style={{
                  margin: 0,
                  marginTop: "0.5rem",
                  fontSize: "0.9rem",
                  color: status.type === "success" ? "#15803d" : "#b91c1c",
                }}
              >
                {status.message}
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

