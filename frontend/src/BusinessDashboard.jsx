import React from "react";
import { Link } from "react-router-dom";

const pageStyle = {
  minHeight: "100vh",
  background: "#f5f5f5",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  padding: "2rem",
};

const cardStyle = {
  background: "#ffffff",
  borderRadius: "0.75rem",
  padding: "1.25rem",
  boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "1rem",
  marginTop: "1rem",
};

export default function BusinessDashboard() {
  let company = null;
  try {
    const stored = localStorage.getItem("companyData");
    if (stored) {
      company = JSON.parse(stored);
    }
  } catch {
    company = null;
  }

  const trustScore = company?.reputation_score ?? 0;
  const recommendationScore = company?.recommendation_score ?? 0;
  const averageRating = company?.average_rating ?? 0;
  const totalReviews = company?.total_reviews ?? 0;
  const isVerified = company?.is_verified ?? false;

  const reputationBadges = [
    {
      label: "High Satisfaction",
      detail:
        totalReviews > 0
          ? `${averageRating.toFixed(1)} / 5.0 from ${totalReviews} reviews`
          : "No rating data yet",
    },
    {
      label: "Recommendation score",
      detail: `${recommendationScore.toFixed(1)} / 100`,
    },
    {
      label: "Verified Profile",
      detail: isVerified ? "Business identity verified" : "Not verified yet",
    },
  ];

  const recommendedActions = [
    {
      title: "Reply to 3 recent reviews",
      detail: "Improves trust score and visibility",
      priority: "High",
    },
    {
      title: "Complete profile details",
      detail: "Add photos, hours, and FAQ",
      priority: "Medium",
    },
    {
      title: "Ask happy customers for reviews",
      detail: "Share your review link with last week’s orders",
      priority: "Medium",
    },
  ];

  const reviewSignals = [
    { title: "New reviews (30d)", value: totalReviews > 0 ? totalReviews : 0, accent: "#2563eb" },
    { title: "Avg rating", value: averageRating.toFixed(1), accent: "#10b981" },
    { title: "Response rate", value: "0%", accent: "#f59e0b" },
    { title: "Response time", value: "0m", accent: "#ec4899" },
  ];

  const reputationFeed = [
    { label: "Review", detail: "Customer praised support speed.", when: "2h ago" },
    { label: "Action", detail: "You replied to Jane’s review.", when: "5h ago" },
    { label: "Insight", detail: "Peak inquiries on Fridays.", when: "1d ago" },
    { label: "Review", detail: "Mentioned packaging quality.", when: "2d ago" },
  ];

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <p style={{ margin: 0, color: "#6b7280", fontSize: "0.9rem" }}>Dashboard</p>
            <h1 style={{ margin: "0.1rem 0 0", color: "#111827" }}>Reputation & Recommendations</h1>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <Link to="/company/home">
              <button className="btn btn-outline">Back to company home</button>
            </Link>
            <button className="btn btn-primary">Generate report</button>
          </div>
        </header>

        <div style={grid}>
          <div style={{ ...cardStyle, borderLeft: "4px solid #2563eb" }}>
            <p style={{ margin: 0, color: "#6b7280" }}>Trust score</p>
            <h2 style={{ margin: "0.25rem 0 0.5rem" }}>{trustScore.toFixed(1)}/100</h2>
            <p style={{ margin: 0, color: "#10b981", fontWeight: 600 }}>
              Based on your reputation data
            </p>
          </div>

          <div style={{ ...cardStyle, borderLeft: "4px solid #10b981" }}>
            <p style={{ margin: 0, color: "#6b7280" }}>Reputation badges</p>
            <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1rem", color: "#111827" }}>
              {reputationBadges.map((badge) => (
                <li key={badge.label} style={{ marginBottom: "0.35rem" }}>
                  <strong>{badge.label}:</strong> {badge.detail}
                </li>
              ))}
            </ul>
          </div>

          <div style={{ ...cardStyle, borderLeft: "4px solid #f59e0b" }}>
            <p style={{ margin: 0, color: "#6b7280" }}>Review signals</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "0.5rem", marginTop: "0.5rem" }}>
              {reviewSignals.map((signal) => (
                <div key={signal.title} style={{ padding: "0.75rem", borderRadius: "0.6rem", background: "#f8fafc", border: `1px solid ${signal.accent}20` }}>
                  <p style={{ margin: 0, color: "#6b7280", fontSize: "0.85rem" }}>{signal.title}</p>
                  <p style={{ margin: "0.2rem 0 0", fontWeight: 700, color: signal.accent }}>{signal.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={grid}>
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Recommended actions</h3>
              <span style={{ color: "#6b7280", fontSize: "0.9rem" }}>Prioritize these</span>
            </div>
            <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              {recommendedActions.map((item) => (
                <div key={item.title} style={{ padding: "0.75rem", borderRadius: "0.6rem", border: "1px solid #e5e7eb", background: "#f9fafb" }}>
                  <p style={{ margin: "0 0 0.2rem", fontWeight: 600 }}>{item.title}</p>
                  <p style={{ margin: 0, color: "#4b5563" }}>{item.detail}</p>
                  <span style={{ marginTop: "0.35rem", display: "inline-block", background: "#fef3c7", color: "#92400e", borderRadius: "999px", padding: "0.15rem 0.6rem", fontSize: "0.8rem" }}>
                    {item.priority} priority
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Reputation feed</h3>
              <button className="btn btn-outline" style={{ padding: "0.35rem 0.75rem" }}>Mark all read</button>
            </div>
            <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {reputationFeed.map((item, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", padding: "0.75rem", borderRadius: "0.65rem", background: "#f8fafc", border: "1px solid #e5e7eb" }}>
                  <div>
                    <p style={{ margin: "0 0 0.25rem", fontWeight: 600 }}>{item.label}</p>
                    <p style={{ margin: 0, color: "#4b5563" }}>{item.detail}</p>
                  </div>
                  <span style={{ color: "#6b7280", fontSize: "0.85rem", whiteSpace: "nowrap" }}>{item.when}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
            <div>
              <h3 style={{ margin: 0 }}>Next step</h3>
              <p style={{ margin: "0.2rem 0 0", color: "#4b5563" }}>Send a follow-up to recent reviewers to boost trust by 5-8 pts.</p>
            </div>
            <button className="btn btn-primary">Send follow-up</button>
          </div>
        </div>
      </div>
    </div>
  );
}


