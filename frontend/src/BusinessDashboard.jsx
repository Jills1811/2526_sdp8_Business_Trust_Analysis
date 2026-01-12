import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getCompanyToken } from "./CompanyAuth";

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
  const [company, setCompany] = useState(null);
  const [feedbackData, setFeedbackData] = useState(null);
  const [loadingFeedback, setLoadingFeedback] = useState(false);

  useEffect(() => {
    const token = getCompanyToken();
    const stored = localStorage.getItem("companyData");
    if (stored && !token) {
      try { setCompany(JSON.parse(stored)); } catch { setCompany(null); }
      return;
    }

    if (!token) {
      // Not logged in as company; keep null
      return;
    }

    // Fetch the latest company profile and feedback
    const run = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/company/me/", {
          headers: { Authorization: `Token ${token}` },
        });
        const data = await res.json();
        if (res.ok) {
          setCompany(data);
          localStorage.setItem("companyData", JSON.stringify(data));
        }

        // Fetch company feedback (ratings + comments) from backend
        setLoadingFeedback(true);
        try {
          const fbRes = await fetch(
            "http://localhost:8000/api/company/me/feedback/",
            {
              headers: { Authorization: `Token ${token}` },
            }
          );
          const fbData = await fbRes.json();
          if (fbRes.ok) {
            setFeedbackData(fbData);
          }
        } finally {
          setLoadingFeedback(false);
        }
      } catch {
        // ignore
      }
    };
    run();
  }, []);

  // Get reputation score from company data
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

  // Real review data from backend feedback endpoint
  const ratings = feedbackData?.feedback?.ratings ?? [];
  const comments = feedbackData?.feedback?.comments ?? [];

  // Helper for last 30 days
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const reviewsLast30Days = ratings.filter((r) => {
    if (!r.created_at) return false;
    const d = new Date(r.created_at);
    return !Number.isNaN(d.getTime()) && d >= thirtyDaysAgo;
  }).length;

  const reviewSignals =
    ratings.length === 0
      ? [
          {
            title: "New reviews (30d)",
            value: 0,
            accent: "#2563eb",
          },
          {
            title: "Avg rating",
            value: averageRating.toFixed(1),
            accent: "#10b981",
          },
        ]
      : [
          {
            title: "New reviews (30d)",
            value: reviewsLast30Days,
            accent: "#2563eb",
          },
          {
            title: "Avg rating",
            value: averageRating.toFixed(1),
            accent: "#10b981",
          },
        ];

  // Recommended actions based on real data
  const recommendedActions = (() => {
    const actions = [];
    if (totalReviews === 0) {
      actions.push({
        title: "Collect your first reviews",
        detail:
          "Share your review link with recent customers to start building trust.",
        priority: "High",
      });
    } else {
      const negativeComments = comments.filter(
        (c) => typeof c.sentiment === "number" && c.sentiment < 0
      );
      if (negativeComments.length > 0) {
        actions.push({
          title: "Reply to recent negative reviews",
          detail:
            "Address concerns publicly to show you listen and improve your service.",
          priority: "High",
        });
      }
      actions.push({
        title: "Thank happy customers",
        detail:
          "Reply to positive reviews to strengthen relationships and loyalty.",
        priority: "Medium",
      });
    }
    if (actions.length === 0) {
      actions.push({
        title: "Monitor new feedback",
        detail: "Keep an eye on fresh reviews to maintain a strong reputation.",
        priority: "Medium",
      });
    }
    return actions;
  })();

  const reputationFeed = comments.slice(0, 10).map((item) => {
    let label = "Review";
    if (typeof item.sentiment === "number") {
      if (item.sentiment > 0) label = "Positive review";
      else if (item.sentiment < 0) label = "Negative review";
    }
    let when = "";
    if (item.created_at) {
      const d = new Date(item.created_at);
      if (!Number.isNaN(d.getTime())) {
        when = d.toLocaleDateString();
      }
    }
    return {
      label,
      detail: item.comment || "No comment text",
      when: when || "Recently",
    };
  });

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <p style={{ margin: 0, color: "#6b7280", fontSize: "0.9rem" }}>Dashboard</p>
            <h1 style={{ margin: "0.1rem 0 0", color: "#111827" }}>{company?.name}</h1>
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


