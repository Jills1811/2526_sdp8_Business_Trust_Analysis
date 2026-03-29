import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getCompanyToken } from "./CompanyAuth";
import { downloadBusinessReportPdf } from "./utils/businessReportPdf";

const pageStyle = {
  minHeight: "100vh",
  background: "radial-gradient(circle at top, #eef2ff, #f8fafc)",
  fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  padding: "2.5rem 1.5rem",
};

const cardStyle = {
  background: "rgba(255,255,255,0.95)",
  borderRadius: "1.1rem",
  padding: "1.4rem",
  boxShadow: "0 15px 40px rgba(15,23,42,0.12)",
  border: "1px solid rgba(99,102,241,0.12)",
  transition: "transform .2s ease, box-shadow .2s ease",
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "1.25rem",
  marginTop: "1.25rem",
};

export default function BusinessDashboard() {
  const [company, setCompany] = useState(null);
  const [feedbackData, setFeedbackData] = useState(null);
  const [reportGenerating, setReportGenerating] = useState(false);

  useEffect(() => {
    const token = getCompanyToken();
    const stored = localStorage.getItem("companyData");
    if (stored && !token) {
      try {
        setCompany(JSON.parse(stored));
      } catch {
        setCompany(null);
      }
      return;
    }

    if (!token) return;

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

        try {
          const fbRes = await fetch(
            "http://localhost:8000/api/company/me/feedback/",
            {
              headers: { Authorization: `Token ${token}` },
            }
          );
          const fbData = await fbRes.json();
          if (fbRes.ok) setFeedbackData(fbData);
        } catch {}
      } catch {}
    };
    run();
  }, []);

  const handleGenerateReport = async () => {
    const token = getCompanyToken();
    if (!token) {
      window.alert("Please log in as a company to generate a report.");
      return;
    }
    setReportGenerating(true);
    try {
      const [meRes, fbRes] = await Promise.all([
        fetch("http://localhost:8000/api/company/me/", {
          headers: { Authorization: `Token ${token}` },
        }),
        fetch("http://localhost:8000/api/company/me/feedback/", {
          headers: { Authorization: `Token ${token}` },
        }),
      ]);
      let co = company;
      let fb = feedbackData;
      if (meRes.ok) {
        co = await meRes.json();
        setCompany(co);
        localStorage.setItem("companyData", JSON.stringify(co));
      }
      if (fbRes.ok) {
        fb = await fbRes.json();
        setFeedbackData(fb);
      }
      if (!co || !co.name) {
        window.alert("Could not load business profile. Try again in a moment.");
        return;
      }
      downloadBusinessReportPdf({ company: co, feedbackData: fb });
    } catch (e) {
      window.alert(e?.message || "Could not generate the PDF report.");
    } finally {
      setReportGenerating(false);
    }
  };

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
          ? `${averageRating.toFixed(1)} / 5.0 from ${totalReviews} ratings`
          : "No rating data yet",
    },
    // {
    //   label: "Recommendation score",
    //   detail: `${recommendationScore.toFixed(1)} / 100`,
    // },
    // {
    //   label: "Verified Profile",
    //   detail: isVerified ? "Business identity verified" : "Not verified yet",
    // },
  ];

  const ratings = feedbackData?.feedback?.ratings ?? [];
  const comments = feedbackData?.feedback?.comments ?? [];

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const reviewsLast30Days = ratings.filter((r) => {
    if (!r.created_at) return false;
    const d = new Date(r.created_at);
    return !Number.isNaN(d.getTime()) && d >= thirtyDaysAgo;
  }).length;

  const reviewSignals = [
    {
      title: "New Ratings (30d)",
      value: reviewsLast30Days,
      accent: "#2563eb",
    },
    // {
    //   title: "Avg rating",
    //   value: averageRating.toFixed(1),
    //   accent: "#10b981",
    // },
  ];

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
    const authorName =
      (item.customer_name && String(item.customer_name).trim()) || "Anonymous";
    return {
      label,
      detail: item.comment || "No comment text",
      when: when || "Recently",
      authorName,
    };
  });

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: "1250px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.7rem" }}>
        
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", width: "100%" }}>
          <div
            style={{
              ...cardStyle,
              borderLeft: "5px solid #2563eb",
              flex: "1 1 auto",
              width: "100%",
              minWidth: "min(100%, 520px)",
              maxWidth: "720px",
              padding: "1.5rem 2.25rem",
              boxSizing: "border-box",
            }}
          >
            <p style={{ margin: 0, color: "#64748b", fontSize: "0.85rem", fontWeight: 600 }}>
              Business Analytics Dashboard
            </p>
            <h1
              style={{
                margin: "0.45rem 0 0",
                fontSize: "clamp(1.55rem, 3vw, 2.05rem)",
                fontWeight: 800,
                color: "#1d4ed8",
                letterSpacing: "-0.03em",
                lineHeight: 1.2,
              }}
            >
              {company?.name ?? "Loading…"}
            </h1>
          </div>
          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
            <Link to="/company/home">
              <button className="btn btn-outline">Back to home</button>
            </Link>
            <button
              type="button"
              className="btn btn-primary"
              disabled={reportGenerating}
              onClick={handleGenerateReport}
            >
              {reportGenerating ? "Generating…" : "Generate report"}
            </button>
          </div>
        </header>

        <div style={grid}>
          <StatCard title="Trust Score" value={`${trustScore.toFixed(1)} / 100`} accent="#2563eb" />
          {/* <StatCard title="Recommendation Score" value={`${recommendationScore.toFixed(1)} / 100`} accent="#10b981" /> */}
          <StatCard title="Average Rating" value={`${averageRating.toFixed(1)} / 5.0`} accent="#f59e0b" />
        </div>

        <div style={grid}>
          <Card title="Reputation Badges">
            <ul style={{ margin: 0, paddingLeft: "1.2rem", color: "#0f172a" }}>
              {reputationBadges.map((b) => (
                <li key={b.label} style={{ marginBottom: "0.45rem" }}>
                  <strong>{b.label}:</strong> {b.detail}
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Rating Signals">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "0.75rem" }}>
              {reviewSignals.map((s) => (
                <div key={s.title} style={{ padding: "0.9rem", borderRadius: "0.7rem", background: "#f8fafc", border: `1px solid ${s.accent}30` }}>
                  <p style={{ margin: 0, color: "#64748b", fontSize: "0.8rem" }}>{s.title}</p>
                  <p style={{ margin: "0.2rem 0 0", fontWeight: 800, color: s.accent }}>{s.value}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div style={grid}>
          {/* <Card title="Recommended Actions">
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {recommendedActions.map((a) => (
                <div key={a.title} style={{ padding: "0.85rem", borderRadius: "0.75rem", border: "1px solid #e5e7eb", background: "#f9fafb" }}>
                  <p style={{ margin: 0, fontWeight: 700 }}>{a.title}</p>
                  <p style={{ margin: "0.2rem 0 0", color: "#475569" }}>{a.detail}</p>
                  <span style={{ display: "inline-block", marginTop: "0.4rem", background: "#fef3c7", color: "#92400e", borderRadius: "999px", padding: "0.2rem 0.7rem", fontSize: "0.75rem", fontWeight: 700 }}>
                    {a.priority} priority
                  </span>
                </div>
              ))}
            </div>
          </Card> */}

          <Card title="Feedback">
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {reputationFeed.length === 0 && (
                <p style={{ margin: 0, color: "#64748b", fontSize: "0.9rem" }}>
                  No customer comments yet.
                </p>
              )}
              {reputationFeed.map((item, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem", padding: "0.8rem", borderRadius: "0.75rem", background: "#f8fafc", border: "1px solid #e5e7eb" }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: "0 0 0.15rem", fontWeight: 700 }}>{item.label}</p>
                    <p style={{ margin: "0 0 0.35rem", fontSize: "0.85rem", fontWeight: 600, color: "#4f46e5" }}>
                      {item.authorName}
                    </p>
                    <p style={{ margin: 0, color: "#475569" }}>{item.detail}</p>
                  </div>
                  <span style={{ fontSize: "0.8rem", color: "#64748b", flexShrink: 0 }}>{item.when}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
            <div>
              <h3 style={{ margin: 0 }}>Next Best Action</h3>
              <p style={{ margin: "0.2rem 0 0", color: "#475569" }}>
                Send follow-ups to recent customers and improve trust by 5–8 points.
              </p>
            </div>
            <button className="btn btn-primary">Send follow-up</button>
          </div>
        </Card> */}

      </div>
    </div>
  );
}

/* ---------------- UI Components ---------------- */

const StatCard = ({ title, value, accent }) => (
  <div style={{ ...cardStyle, borderLeft: `5px solid ${accent}` }}>
    <p style={{ margin: 0, color: "#64748b", fontSize: "0.85rem" }}>{title}</p>
    <p style={{ margin: "0.3rem 0 0", fontSize: "1.6rem", fontWeight: 800, color: accent }}>{value}</p>
  </div>
);

const Card = ({ title, children }) => (
  <div style={cardStyle}>
    {title && <h3 style={{ marginTop: 0, marginBottom: "0.75rem" }}>{title}</h3>}
    {children}
  </div>
);