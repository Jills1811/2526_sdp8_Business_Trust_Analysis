import React, { useEffect, useState } from "react";
import { getCompanyToken } from "./CompanyAuth";

const BASE_URL = "http://localhost:8000";

const pageStyle = { minHeight: "100vh", background: "#f5f5f5", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif", padding: "2rem" };
const cardStyle = { background: "#ffffff", borderRadius: "0.75rem", padding: "1.25rem", boxShadow: "0 10px 30px rgba(15,23,42,0.08)" };

export default function CompanyFeedback() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const token = getCompanyToken();

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/company/me/feedback/`, { headers: { Authorization: `Token ${token}` } });
        const json = await res.json();
        if (!res.ok) throw new Error(json.detail || "Failed to load feedback");
        setData(json);
      } catch (e) {
        setError(e.message);
      }
    };
    if (token) run(); else setError("Please log in as company.");
  }, [token]);

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: "960px", margin: "0 auto" }}>
        <div style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Customer Feedback</h2>
          {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
          {!data && !error && <p style={{ color: "#6b7280" }}>Loading...</p>}
          {data && (
            <>
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                <div style={{ padding: "0.9rem 1.1rem", borderRadius: "0.75rem", background: "#ecfdf3" }}>
                  <p style={{ margin: 0, color: "#166534" }}>Reputation score</p>
                  <p style={{ margin: "0.2rem 0 0", fontSize: "1.3rem", fontWeight: 700, color: "#166534" }}>{data.reputation_score.toFixed(1)} / 100</p>
                </div>
                <div style={{ padding: "0.9rem 1.1rem", borderRadius: "0.75rem", background: "#f0f4ff" }}>
                  <p style={{ margin: 0, color: "#1d4ed8" }}>Average rating</p>
                  <p style={{ margin: "0.2rem 0 0", fontSize: "1.3rem", fontWeight: 700, color: "#1d4ed8" }}>{data.average_rating.toFixed(1)} / 5.0</p>
                </div>
                <div style={{ padding: "0.9rem 1.1rem", borderRadius: "0.75rem", background: "#fff7ed" }}>
                  <p style={{ margin: 0, color: "#9a3412" }}>Total reviews</p>
                  <p style={{ margin: "0.2rem 0 0", fontSize: "1.3rem", fontWeight: 700, color: "#9a3412" }}>{data.total_reviews}</p>
                </div>
              </div>

              <div style={{ marginTop: "1.25rem" }}>
                <h3 style={{ margin: 0 }}>Ratings</h3>
                <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1rem" }}>
                  {data.feedback.ratings.length === 0 && <li style={{ color: "#6b7280" }}>No ratings yet.</li>}
                  {data.feedback.ratings.map((r, idx) => (
                    <li key={idx} style={{ marginBottom: "0.25rem" }}>⭐ {r.rating}</li>
                  ))}
                </ul>
              </div>

              <div style={{ marginTop: "1rem" }}>
                <h3 style={{ margin: 0 }}>Comments</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginTop: "0.5rem" }}>
                  {data.feedback.comments.length === 0 && <p style={{ color: "#6b7280", margin: 0 }}>No comments yet.</p>}
                  {data.feedback.comments.map((c, idx) => (
                    <div key={idx} style={{ padding: "0.75rem", borderRadius: "0.6rem", background: "#f8fafc", border: "1px solid #e5e7eb" }}>
                      <p style={{ margin: 0 }}>{c.comment}</p>
                      <p style={{ margin: "0.3rem 0 0", color: c.sentiment >= 0 ? "#15803d" : "#b91c1c", fontSize: "0.85rem" }}>Sentiment: {c.sentiment.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
