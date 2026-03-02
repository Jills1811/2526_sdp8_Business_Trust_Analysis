import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

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

export default function TopBusinesses() {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${BASE_URL}/api/company/top/?limit=5`);
        const json = await res.json();
        setData(json.top_by_category || {});
      } catch {
        setData({});
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const categories = Object.keys(data);

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <div style={cardStyle}>
          <h2 style={{ margin: 0, fontSize: "1.9rem", fontWeight: 800, color: "#111827" }}>
            🏆 Top Rated Businesses
          </h2>

          <p style={{ color: "#4b5563", marginTop: "6px", maxWidth: "700px" }}>
            Discover the best-performing businesses across categories based on ratings, trust & reputation analysis.
          </p>

          {loading && (
            <div style={{ padding: "3rem", textAlign: "center" }}>
              <p style={{ color: "#6b7280", fontSize: "1rem", marginBottom: "1rem" }}>
                🔄 Loading top companies...
              </p>
            </div>
          )}

          {!loading && categories.length === 0 && (
            <p style={{ color: "#6b7280" }}>No categories found.</p>
          )}

          {!loading &&
            categories.map((cat, index) => (
              <div key={cat} style={{ marginTop: index === 0 ? "2rem" : "3rem" }}>
                <h3
                  style={{
                    margin: "0 0 1.25rem",
                    color: "#1f2937",
                    fontSize: "1.6rem",
                    fontWeight: 800,
                  }}
                >
                  🏅 {cat}
                </h3>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                    gap: "1.5rem",
                  }}
                >
                  {(data[cat] || []).map((c, idx) => (
                    <div
                      key={c.id}
                      style={{
                        background: "#fff",
                        borderRadius: "14px",
                        padding: "1.25rem",
                        border: "1px solid #e5e7eb",
                        transition: "all 0.35s ease",
                        boxShadow: "0 6px 18px rgba(15,23,42,0.06)",
                        cursor: "pointer",
                        position: "relative",
                        overflow: "hidden",
                        animation: `fadeUp 0.4s ease ${idx * 0.06}s both`,
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
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          height: "4px",
                          background: "linear-gradient(90deg,#fbbf24,#f59e0b)",
                        }}
                      />

                      {idx === 0 && <span style={rankBadge("#fbbf24")}>🥇</span>}
                      {idx === 1 && <span style={rankBadge("#d1d5db")}>🥈</span>}
                      {idx === 2 && <span style={rankBadge("#f59e0b")}>🥉</span>}

                      <p style={{ margin: 0, color: "#6366f1", fontWeight: 600, fontSize: "0.85rem" }}>
                        {cat}
                      </p>

                      <h4 style={{ margin: "6px 0 4px", fontSize: "1.15rem", color: "#111827" }}>
                        {c.name}
                      </h4>

                      {c.city && c.country && (
                        <p style={{ margin: 0, color: "#6b7280", fontSize: "0.9rem" }}>
                          📍 {c.city}, {c.country}
                        </p>
                      )}

                      <div
                        style={{
                          marginTop: "12px",
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
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
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

const rankBadge = (bg) => ({
  position: "absolute",
  top: "12px",
  right: "12px",
  fontSize: "1.5rem",
  background: bg,
  borderRadius: "50%",
  padding: "4px 8px",
});