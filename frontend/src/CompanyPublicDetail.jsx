import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getCustomerToken } from "./CustomerAuth";
import BusinessChatbot from "./BusinessChatbot";
import "./company.css";

const BASE_URL = "http://localhost:8000";

export default function CompanyPublicDetail() {
  const { companyId } = useParams();
  const navigate = useNavigate();

  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [commentStatus, setCommentStatus] = useState(null);

  useEffect(() => {
    const fetchCompany = async () => {
      try {
        const token = getCustomerToken();
        const res = await fetch(`${BASE_URL}/api/company/${companyId}/`, {
          headers: token ? { Authorization: `Token ${token}` } : {},
        });
        if (!res.ok) throw new Error("Failed to fetch company details");
        setCompany(await res.json());
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchCompany();
  }, [companyId]);

  useEffect(() => {
    const fetchComments = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/company/${companyId}/comments/`);
        const data = await res.json();
        setComments(data.comments || []);
      } catch {}
    };
    fetchComments();
  }, [companyId]);

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    const token = getCustomerToken();

    if (!token)
      return setCommentStatus({ type: "error", message: "Login required to comment." });

    if (!newComment.trim())
      return setCommentStatus({ type: "error", message: "Comment cannot be empty." });

    setPostingComment(true);

    try {
      const res = await fetch(
        `${BASE_URL}/api/company/${companyId}/comments/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Token ${token}`,
          },
          body: JSON.stringify({ comment: newComment }),
        }
      );

      if (!res.ok) throw new Error("Failed to post comment");

      setNewComment("");
      setCommentStatus({ type: "success", message: "Comment added successfully!" });

      const listRes = await fetch(
        `${BASE_URL}/api/company/${companyId}/comments/`
      );
      const listData = await listRes.json();
      setComments(listData.comments || []);
    } catch (err) {
      setCommentStatus({ type: "error", message: err.message });
    } finally {
      setPostingComment(false);
    }
  };

  return (
    <div className="company-wrapper">
      <div className="company-container">
        <button className="btn-outline back-btn" onClick={() => navigate(-1)}>
          ← Back
        </button>

        <div className="company-card">
          {loading && <p className="muted">Loading company details...</p>}
          {error && <p className="error">{error}</p>}

          {company && (
            <>
              <div className="company-header">
                <h1>{company.name}</h1>
                <span className="company-badge">{company.category}</span>
              </div>

              <p className="company-location">
                📍 {company.city}, {company.country}
              </p>

              <p className="company-desc">{company.description}</p>

              <div className="stat-grid">
                <div className="stat blue">
                  ⭐ {(company.average_rating ?? 0).toFixed(1)}
                  <span>Avg Rating</span>
                </div>

                <div className="stat green">
                  🛡 {(company.reputation_score ?? 0).toFixed(1)}
                  <span>Trust Score</span>
                </div>
              </div>

              <section className="company-section">
                <h3>Contact Information</h3>

                <div className="contact-grid">
                  <div className="contact-card">📧 {company.email || "N/A"}</div>
                  <div className="contact-card">📞 {company.phone || "N/A"}</div>
                  <div className="contact-card">🏢 {company.address || "N/A"}</div>
                </div>
              </section>

              <section className="company-section">
                <h3>Customer Reviews</h3>

                <form className="comment-box" onSubmit={handleSubmitComment}>
                  <textarea
                    placeholder="Write your experience about this business..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                  />
                  <button className="btn-primary" disabled={postingComment}>
                    {postingComment ? "Posting..." : "Add Review"}
                  </button>
                  {commentStatus && (
                    <p className={commentStatus.type}>
                      {commentStatus.message}
                    </p>
                  )}
                </form>

                <div className="comment-list">
                  {comments.map((c, i) => (
                    <div key={i} className="comment-item">
                      <p>{c.comment}</p>
                      <span>— {c.customer?.name || "Anonymous"}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="company-section">
                <h3>Live Business Chat</h3>
                <BusinessChatbot
                  companyId={companyId}
                  businessName={company.name}
                />
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}