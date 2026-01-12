import React, { useEffect, useState } from "react";
import { getCompanyToken } from "./CompanyAuth";

const BASE_URL = "http://localhost:8000";

const pageStyle = { minHeight: "100vh", background: "#f5f5f5", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif", padding: "2rem" };
const cardStyle = { background: "#ffffff", borderRadius: "0.75rem", padding: "1.25rem", boxShadow: "0 10px 30px rgba(15,23,42,0.08)" };

export default function CompanyProfile() {
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    country: "",
    opening_time: "",
    closing_time: "",
  });
  const [services, setServices] = useState([]);
  const [newService, setNewService] = useState("");
  const [workingDays, setWorkingDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  const token = getCompanyToken();

  useEffect(() => {
    const run = async () => {
      const res = await fetch(`${BASE_URL}/api/company/me/`, { headers: { Authorization: `Token ${token}` } });
      if (!res.ok) { setStatus({ type: "error", message: "Please log in as company." }); setLoading(false); return; }
      const data = await res.json();
      setForm({
        name: data.name || "",
        description: data.description || "",
        category: data.category || "",
        email: data.email || "",
        phone: data.phone || "",
        address: data.address || "",
        city: data.city || "",
        country: data.country || "",
        opening_time: data.opening_time || "",
        closing_time: data.closing_time || "",
      });
      setServices(Array.isArray(data.services) ? data.services : []);
      setWorkingDays(Array.isArray(data.working_days) ? data.working_days : []);
      setLoading(false);
    };
    if (token) run(); else { setStatus({ type: "error", message: "Please log in as company." }); setLoading(false); }
  }, [token]);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleAddService = () => {
    const value = newService.trim();
    if (!value) return;
    setServices((prev) => [...prev, value]);
    setNewService("");
  };

  const handleRemoveService = (index) => {
    setServices((prev) => prev.filter((_, i) => i !== index));
  };

  const allDays = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
  const toggleDay = (day) => {
    setWorkingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true); setStatus(null);
    try {
      const payload = {
        ...form,
        services,
        working_days: workingDays,
      };
      const res = await fetch(`${BASE_URL}/api/company/me/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Token ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to save");
      setStatus({ type: "success", message: "Profile updated." });
      localStorage.setItem("companyData", JSON.stringify(data));
    } catch (err) {
      setStatus({ type: "error", message: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: "720px", margin: "0 auto" }}>
        <div style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Edit Business Profile</h2>
          {loading ? (
            <p style={{ color: "#6b7280" }}>Loading...</p>
          ) : (
            <form onSubmit={handleSave} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              {["name","category","email","phone","city","country"].map((f) => (
                <input key={f} name={f} value={form[f]} onChange={handleChange} placeholder={f[0].toUpperCase()+f.slice(1)} style={{ padding: "0.6rem", border: "1px solid #d1d5db", borderRadius: "0.5rem" }} />
              ))}
              <input name="address" value={form.address} onChange={handleChange} placeholder="Address" style={{ gridColumn: "1 / -1", padding: "0.6rem", border: "1px solid #d1d5db", borderRadius: "0.5rem" }} />
              <textarea name="description" value={form.description} onChange={handleChange} placeholder="Description" rows={4} style={{ gridColumn: "1 / -1", padding: "0.6rem", border: "1px solid #d1d5db", borderRadius: "0.5rem" }} />

              <div style={{ gridColumn: "1 / -1" }}>
                <h4 style={{ margin: "0.5rem 0" }}>Services</h4>
                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
                  <input
                    type="text"
                    value={newService}
                    onChange={(e) => setNewService(e.target.value)}
                    placeholder="Add a service (e.g., Home delivery)"
                    style={{ flex: 1, minWidth: "200px", padding: "0.5rem", border: "1px solid #d1d5db", borderRadius: "0.5rem" }}
                  />
                  <button type="button" onClick={handleAddService} className="btn btn-primary">
                    +
                  </button>
                </div>
                {services.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                    {services.map((svc, idx) => (
                      <span
                        key={idx}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "0.25rem 0.5rem",
                          borderRadius: "999px",
                          background: "#eff6ff",
                          border: "1px solid #bfdbfe",
                          fontSize: "0.85rem",
                        }}
                      >
                        {svc}
                        <button
                          type="button"
                          onClick={() => handleRemoveService(idx)}
                          style={{
                            marginLeft: "0.25rem",
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            fontWeight: "bold",
                          }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginTop: "0.5rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", color: "#374151", marginBottom: "0.25rem" }}>
                    Opening time
                  </label>
                  <input
                    type="time"
                    name="opening_time"
                    value={form.opening_time}
                    onChange={handleChange}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "0.5rem", border: "1px solid #d1d5db" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", color: "#374151", marginBottom: "0.25rem" }}>
                    Closing time
                  </label>
                  <input
                    type="time"
                    name="closing_time"
                    value={form.closing_time}
                    onChange={handleChange}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "0.5rem", border: "1px solid #d1d5db" }}
                  />
                </div>
              </div>

              <div style={{ gridColumn: "1 / -1", marginTop: "0.75rem" }}>
                <h4 style={{ margin: "0 0 0.25rem" }}>Working days</h4>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {allDays.map((day) => (
                    <label
                      key={day}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.25rem",
                        padding: "0.25rem 0.6rem",
                        borderRadius: "999px",
                        border: "1px solid #d1d5db",
                        background: workingDays.includes(day) ? "#eef2ff" : "white",
                        fontSize: "0.85rem",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={workingDays.includes(day)}
                        onChange={() => toggleDay(day)}
                      />
                      {day}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <button type="submit" disabled={saving} className="btn btn-primary">{saving?"Saving...":"Save changes"}</button>
              </div>
              {status && <p style={{ gridColumn: "1 / -1", color: status.type === "success" ? "#15803d":"#b91c1c" }}>{status.message}</p>}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
