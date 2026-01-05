import React, { useEffect, useState } from "react";
import { getCompanyToken } from "./CompanyAuth";

const BASE_URL = "http://localhost:8000";

const pageStyle = { minHeight: "100vh", background: "#f5f5f5", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif", padding: "2rem" };
const cardStyle = { background: "#ffffff", borderRadius: "0.75rem", padding: "1.25rem", boxShadow: "0 10px 30px rgba(15,23,42,0.08)" };

export default function CompanyProfile() {
  const [form, setForm] = useState({ name: "", description: "", category: "", email: "", phone: "", address: "", city: "", country: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  const token = getCompanyToken();

  useEffect(() => {
    const run = async () => {
      const res = await fetch(`${BASE_URL}/api/company/me/`, { headers: { Authorization: `Token ${token}` } });
      if (!res.ok) { setStatus({ type: "error", message: "Please log in as company." }); setLoading(false); return; }
      const data = await res.json();
      setForm({ name: data.name || "", description: data.description || "", category: data.category || "", email: data.email || "", phone: data.phone || "", address: data.address || "", city: data.city || "", country: data.country || "" });
      setLoading(false);
    };
    if (token) run(); else { setStatus({ type: "error", message: "Please log in as company." }); setLoading(false); }
  }, [token]);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true); setStatus(null);
    try {
      const res = await fetch(`${BASE_URL}/api/company/me/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Token ${token}` },
        body: JSON.stringify(form),
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
