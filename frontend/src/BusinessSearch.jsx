import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getCustomerToken } from "./CustomerAuth";

const BASE_URL = "http://localhost:8000";

const pageStyle = {
  minHeight: "100vh",
  background: "linear-gradient(135deg, #f8fafc, #eef2ff)",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  padding: "2rem",
};

const containerStyle = {
  maxWidth: "1200px",
  margin: "0 auto",
};

const cardStyle = {
  background: "#ffffff",
  borderRadius: "16px",
  padding: "1.75rem",
  boxShadow: "0 15px 35px rgba(15,23,42,0.08)",
};

const inputStyle = {
  padding: "0.8rem",
  borderRadius: "10px",
  border: "2px solid #e5e7eb",
  fontSize: "0.95rem",
  transition: "all 0.3s ease",
};

export default function BusinessSearch() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const search = async (params) => {
    setLoading(true);
    const url = new URL(`${BASE_URL}/api/company/search/`);
    Object.entries(params).forEach(([k, v]) => {
      if (v) url.searchParams.set(k, v);
    });
    try {
      const token = getCustomerToken();
      const headers = token ? { Authorization: `Token ${token}` } : {};
      const res = await fetch(url.toString(), { headers });
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setResults(Array.isArray(data.results) ? data.results : []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    search({ q, category, city, country });
  };

  useEffect(() => {
    search({});
  }, []);

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <div style={cardStyle}>
          <h2 style={{ margin: 0, fontSize: "1.9rem", fontWeight: 800, color: "#111827" }}>
            🔍 Smart Business Search
          </h2>

          <p style={{ color: "#4b5563", marginTop: "6px", maxWidth: "680px" }}>
            Discover reliable businesses using AI-powered trust and reputation analysis.
          </p>

          <form
            onSubmit={handleSubmit}
            style={{
              marginTop: "1.75rem",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "0.75rem",
            }}
          >
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Business name" style={inputStyle} />
            <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" style={inputStyle} />
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" style={inputStyle} />
            <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Country" style={inputStyle} />

            <button
              type="submit"
              className="btn btn-primary"
              style={{
                width: "100%",
                padding: "0.85rem",
                fontWeight: 600,
                borderRadius: "10px",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Searching..." : "Search"}
            </button>
          </form>

          <div
            style={{
              marginTop: "2.5rem",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "1.5rem",
            }}
          >
            {loading && (
              <p style={{ gridColumn: "1/-1", textAlign: "center", color: "#6b7280" }}>
                🔄 Finding best matches...
              </p>
            )}

            {!loading &&
              results.map((c, i) => (
                <div
                  key={c.id}
                  style={{
                    background: "#fff",
                    borderRadius: "14px",
                    padding: "1.3rem",
                    border: "1px solid #e5e7eb",
                    transition: "all 0.35s ease",
                    boxShadow: "0 6px 18px rgba(15,23,42,0.06)",
                    cursor: "pointer",
                    animation: `fadeUp 0.4s ease ${i * 0.06}s both`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-6px) scale(1.01)";
                    e.currentTarget.style.boxShadow = "0 18px 35px rgba(15,23,42,0.14)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "none";
                    e.currentTarget.style.boxShadow = "0 6px 18px rgba(15,23,42,0.06)";
                  }}
                >
                  <p style={{ margin: 0, color: "#6366f1", fontWeight: 600, fontSize: "0.85rem" }}>
                    {c.category}
                  </p>

                  <h3 style={{ margin: "6px 0 4px", fontSize: "1.2rem", color: "#111827" }}>
                    {c.name}
                  </h3>

                  {c.city && c.country && (
                    <p style={{ margin: 0, color: "#6b7280", fontSize: "0.9rem" }}>
                      📍 {c.city}, {c.country}
                    </p>
                  )}

                  <div style={{ marginTop: "12px", display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#1d4ed8", fontWeight: 700 }}>
                      ⭐ {(c.average_rating ?? 0).toFixed(1)}
                    </span>
                    <span style={{ color: "#15803d", fontWeight: 600 }}>
                      🛡 {(c.reputation_score ?? 0).toFixed(1)}
                    </span>
                  </div>

                  <Link to={`/companies/${c.id}`} style={{ textDecoration: "none" }}>
                    <button
                      className="btn btn-outline"
                      style={{
                        width: "100%",
                        marginTop: "14px",
                        fontWeight: 600,
                        borderRadius: "10px",
                      }}
                    >
                      View Details →
                    </button>
                  </Link>
                </div>
              ))}

            {!loading && results.length === 0 && (
              <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "2.5rem" }}>
                <p style={{ fontSize: "3rem" }}>😕</p>
                <p style={{ color: "#6b7280", fontSize: "1.1rem" }}>
                  No businesses found
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}