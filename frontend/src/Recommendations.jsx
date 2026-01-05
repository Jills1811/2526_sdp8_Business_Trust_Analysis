import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

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
  padding: "1rem",
  boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
};

export default function Recommendations() {
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async (params) => {
    setLoading(true);
    const url = new URL(`${BASE_URL}/api/company/recommendations/`);
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v) url.searchParams.set(k, v);
    });
    try {
      const res = await fetch(url.toString());
      const json = await res.json();
      setItems(Array.isArray(json.recommendations) ? json.recommendations : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load({});
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    load({ category, q, city, country });
  };

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: "960px", margin: "0 auto" }}>
        <div style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Recommended Businesses</h2>
          <p style={{ color: "#4b5563" }}>Recommendations prioritize reputation score, then average rating. Filter by name, category, and location.</p>
          <form onSubmit={handleSubmit} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.5rem" }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name contains" style={{ padding: "0.6rem", border: "1px solid #d1d5db", borderRadius: "0.5rem" }} />
            <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" style={{ padding: "0.6rem", border: "1px solid #d1d5db", borderRadius: "0.5rem" }} />
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" style={{ padding: "0.6rem", border: "1px solid #d1d5db", borderRadius: "0.5rem" }} />
            <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Country" style={{ padding: "0.6rem", border: "1px solid #d1d5db", borderRadius: "0.5rem" }} />
            <div>
              <button type="submit" className="btn btn-primary">Update</button>
            </div>
          </form>

          <div style={{ marginTop: "1rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "0.75rem" }}>
            {loading && <p style={{ color: "#6b7280" }}>Loading...</p>}
            {!loading && items.map((c) => (
              <div key={c.id} style={{ ...cardStyle, boxShadow: "none", border: "1px solid #e5e7eb" }}>
                <p style={{ margin: 0, color: "#6b7280", fontSize: "0.85rem" }}>{c.category}</p>
                <h3 style={{ margin: "0.15rem 0 0.25rem" }}>{c.name}</h3>
                {c.city && c.country && (
                  <p style={{ margin: 0, color: "#4b5563" }}>📍 {c.city}, {c.country}</p>
                )}
                <p style={{ margin: "0.35rem 0 0", color: "#15803d", fontWeight: 600 }}>Reputation: {(c.reputation_score ?? 0).toFixed(1)} / 100</p>
                <p style={{ margin: 0, color: "#1d4ed8" }}>Rating: {(c.average_rating ?? 0).toFixed(1)} / 5.0</p>
                <Link to={`/companies/${c.id}`}><button className="btn btn-outline" style={{ marginTop: "0.5rem" }}>View</button></Link>
              </div>
            ))}
            {!loading && items.length === 0 && (
              <p style={{ color: "#6b7280" }}>No recommendations found.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
