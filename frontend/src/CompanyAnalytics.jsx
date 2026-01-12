import React from "react";

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
  maxWidth: "960px",
  margin: "0 auto",
};

export function CompanyRecommendationPage() {
  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Recommendations</h2>
        <p style={{ color: "#4b5563", marginTop: "0.5rem" }}>
          This area will show AI-driven recommendations for improving your
          business reputation based on recent reviews and ratings.
        </p>
        <p style={{ color: "#6b7280", marginTop: "0.75rem" }}>
          For now, use the dashboard insights and feedback section to understand
          what customers are saying about your business.
        </p>
      </div>
    </div>
  );
}

export function CompanyAnalyticsPage() {
  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Analytics</h2>
        <p style={{ color: "#4b5563", marginTop: "0.5rem" }}>
          Detailed analytics for your reviews, ratings, and reputation score
          will appear here.
        </p>
        <p style={{ color: "#6b7280", marginTop: "0.75rem" }}>
          Coming soon: trends over time, sentiment breakdown, and channel
          performance.
        </p>
      </div>
    </div>
  );
}

