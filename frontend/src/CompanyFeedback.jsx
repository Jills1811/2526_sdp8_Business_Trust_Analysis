import React, { useEffect, useState } from "react";
import { getCompanyToken } from "./CompanyAuth";

const BASE_URL = "http://localhost:8000";

export default function CompanyFeedback() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const token = getCompanyToken();

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/company/me/feedback/`, {
          headers: { Authorization: `Token ${token}` },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.detail || "Failed to load feedback");
        setData(json);
      } catch (e) {
        setError(e.message);
      }
    };
    if (token) run();
    else setError("Please log in as company.");
  }, [token]);

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "2.5rem 1.5rem",
        background: "radial-gradient(circle at top, #eef2ff, #f8fafc)",
        fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <div
          style={{
            background: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(14px)",
            borderRadius: "1.25rem",
            padding: "2.3rem",
            boxShadow: "0 25px 60px rgba(15,23,42,0.15)",
            border: "1px solid rgba(99,102,241,0.12)",
          }}
        >
          <h2
            style={{
              marginTop: 0,
              marginBottom: "1.2rem",
              fontSize: "1.7rem",
              fontWeight: 800,
              color: "#0f172a",
            }}
          >
            Customer Feedback & Reputation
          </h2>

          {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
          {!data && !error && <p style={{ color: "#6b7280" }}>Loading...</p>}

          {data && (
            <>
              {/* Stats */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
                  gap: "1.25rem",
                  marginBottom: "2.2rem",
                }}
              >
                <StatCard
                  title="Reputation Score"
                  value={`${(data.reputation_score ?? 0).toFixed(1)} / 100`}
                  color="#16a34a"
                  bg="#ecfdf5"
                />

                <StatCard
                  title="Average Rating"
                  value={`${(data.company?.average_rating ?? 0).toFixed(1)} / 5.0`}
                  color="#2563eb"
                  bg="#eef2ff"
                />

                <StatCard
                  title="Total Reviews"
                  value={data.company?.total_reviews ?? 0}
                  color="#ea580c"
                  bg="#fff7ed"
                />
              </div>

              {/* Ratings */}
              <Section title="Ratings">
                {data.feedback.ratings.length === 0 ? (
                  <p style={{ color: "#6b7280", margin: 0 }}>
                    No ratings yet.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
                    {data.feedback.ratings.map((r, idx) => (
                      <span
                        key={idx}
                        style={{
                          padding: "0.45rem 0.9rem",
                          borderRadius: "999px",
                          background: "#f1f5f9",
                          fontSize: "0.85rem",
                          fontWeight: 600,
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        ⭐ {r.rating}
                      </span>
                    ))}
                  </div>
                )}
              </Section>

              {/* Comments */}
              <Section title="Customer Comments">
                {data.feedback.comments.length === 0 ? (
                  <p style={{ color: "#6b7280", margin: 0 }}>
                    No comments yet.
                  </p>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.85rem",
                    }}
                  >
                    {data.feedback.comments.map((c, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: "1rem",
                          borderRadius: "0.9rem",
                          background: "linear-gradient(180deg,#ffffff,#f8fafc)",
                          border: "1px solid #e5e7eb",
                          boxShadow: "0 6px 16px rgba(15,23,42,0.06)",
                        }}
                      >
                        <p
                          style={{
                            margin: "0 0 0.35rem",
                            fontSize: "0.82rem",
                            fontWeight: 700,
                            color: "#4f46e5",
                          }}
                        >
                          {(c.customer_name && String(c.customer_name).trim()) ||
                            "Anonymous"}
                        </p>
                        <p style={{ margin: 0, fontSize: "0.95rem" }}>
                          {c.comment}
                        </p>

                        <p
                          style={{
                            margin: "0.4rem 0 0",
                            fontSize: "0.8rem",
                            fontWeight: 600,
                            color:
                              (c.sentiment ?? 0) >= 0 ? "#15803d" : "#b91c1c",
                          }}
                        >
                          Sentiment Score: {(c.sentiment ?? 0).toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Components ---------------- */

const StatCard = ({ title, value, color, bg }) => (
  <div
    style={{
      background: bg,
      padding: "1.3rem",
      borderRadius: "1.1rem",
      border: "1px solid rgba(0,0,0,0.05)",
      transition: "transform .2s ease, box-shadow .2s ease",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = "translateY(-6px) scale(1.02)";
      e.currentTarget.style.boxShadow =
        "0 15px 30px rgba(15,23,42,0.15)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = "none";
      e.currentTarget.style.boxShadow = "none";
    }}
  >
    <p style={{ margin: 0, fontSize: "0.8rem", fontWeight: 700, color }}>
      {title}
    </p>
    <p
      style={{
        margin: "0.35rem 0 0",
        fontSize: "1.5rem",
        fontWeight: 800,
        color,
      }}
    >
      {value}
    </p>
  </div>
);

const Section = ({ title, children }) => (
  <div style={{ marginTop: "2rem" }}>
    <h3
      style={{
        marginBottom: "0.75rem",
        fontSize: "1.25rem",
        fontWeight: 700,
        color: "#0f172a",
      }}
    >
      {title}
    </h3>
    {children}
  </div>
);