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
      <div style={{ maxWidth: "960px", margin: "0 auto" }}>
        <div style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Top Businesses by Category</h2>
          {loading && <p style={{ color: "#6b7280" }}>Loading...</p>}
          {!loading && categories.length === 0 && (
            <p style={{ color: "#6b7280" }}>No categories found.</p>
          )}
          {!loading && categories.map((cat) => (
            <div key={cat} style={{ marginTop: "1rem" }}>
              <h3 style={{ margin: "0 0 0.5rem" }}>{cat}</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "0.75rem" }}>
                {(data[cat] || []).map((c) => (
                  <div key={c.id} style={{ ...cardStyle, boxShadow: "none", border: "1px solid #e5e7eb" }}>
                    <h4 style={{ margin: 0 }}>{c.name}</h4>
                    {c.city && c.country && (
                      <p style={{ margin: 0, color: "#4b5563" }}>📍 {c.city}, {c.country}</p>
                    )}
                    <p style={{ margin: "0.35rem 0 0", color: "#1d4ed8", fontWeight: 600 }}>{(c.average_rating ?? 0).toFixed(1)} / 5.0</p>
                    <Link to={`/companies/${c.id}`}><button className="btn btn-outline" style={{ marginTop: "0.5rem" }}>View</button></Link>
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
