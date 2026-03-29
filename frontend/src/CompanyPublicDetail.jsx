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
  const [ratingInput, setRatingInput] = useState("");
  const [postingRating, setPostingRating] = useState(false);
  const [postingComment, setPostingComment] = useState(false);
  const [ratingStatus, setRatingStatus] = useState(null);
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

  useEffect(() => {
    const token = getCustomerToken();
    if (!token || !companyId) return;
    const loadMyRating = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/company/${companyId}/rate/`, {
          headers: { Authorization: `Token ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.my_rating != null && !Number.isNaN(Number(data.my_rating))) {
          const v = Number(data.my_rating);
          setRatingInput(Number.isInteger(v) ? String(v) : String(v));
        }
      } catch {}
    };
    loadMyRating();
  }, [companyId]);

  const parseRating = () => {
    const ratingStr = ratingInput.trim();
    if (ratingStr === "") {
      return { error: "Enter a rating between 0 and 5 (e.g. 4.3)." };
    }
    const ratingNum = Number(ratingStr);
    if (Number.isNaN(ratingNum) || ratingNum < 0 || ratingNum > 5) {
      return { error: "Rating must be a number from 0 to 5." };
    }
    return { value: ratingNum };
  };

  const applyRateResponseToCompany = (rateData) => {
    if (!rateData?.company) return;
    setCompany((prev) =>
      prev
        ? {
            ...prev,
            average_rating: rateData.company.average_rating,
            rating: rateData.company.average_rating,
            total_reviews: rateData.company.total_reviews,
            reputation_score: rateData.company.reputation_score,
          }
        : prev
    );
  };

  const handleSubmitRating = async (e) => {
    e.preventDefault();
    setRatingStatus(null);
    const token = getCustomerToken();
    if (!token) {
      return setRatingStatus({ type: "error", message: "Login required to submit a rating." });
    }
    const parsed = parseRating();
    if (parsed.error) {
      return setRatingStatus({ type: "error", message: parsed.error });
    }

    setPostingRating(true);
    try {
      const rateRes = await fetch(`${BASE_URL}/api/company/${companyId}/rate/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${token}`,
        },
        body: JSON.stringify({ rating: parsed.value }),
      });
      if (!rateRes.ok) {
        const errBody = await rateRes.json().catch(() => ({}));
        throw new Error(errBody.detail || "Failed to save your rating.");
      }
      const rateData = await rateRes.json();
      applyRateResponseToCompany(rateData);
      setRatingStatus({ type: "success", message: "Rating saved." });
    } catch (err) {
      setRatingStatus({ type: "error", message: err.message });
    } finally {
      setPostingRating(false);
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    const token = getCustomerToken();

    if (!token)
      return setCommentStatus({ type: "error", message: "Login required to comment." });

    if (!newComment.trim())
      return setCommentStatus({ type: "error", message: "Comment cannot be empty." });

    setPostingComment(true);

    try {
      const res = await fetch(`${BASE_URL}/api/company/${companyId}/comments/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${token}`,
        },
        body: JSON.stringify({ comment: newComment }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.detail || "Failed to post comment");
      }

      setNewComment("");
      setCommentStatus({ type: "success", message: "Comment added successfully!" });

      const listRes = await fetch(`${BASE_URL}/api/company/${companyId}/comments/`);
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

                <form className="comment-box rating-form" onSubmit={handleSubmitRating}>
                  <label className="rating-field-label" htmlFor="review-rating-input">
                    Your rating (0–5, decimals allowed)
                  </label>
                  <div className="rating-submit-row">
                    <input
                      id="review-rating-input"
                      className="rating-text-input"
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="e.g. 4.3, 1.2, 5"
                      value={ratingInput}
                      onChange={(e) => setRatingInput(e.target.value)}
                      aria-describedby="review-rating-hint"
                    />
                    <button
                      type="submit"
                      className="btn-primary rating-submit-btn"
                      disabled={postingRating}
                    >
                      {postingRating ? "Saving..." : "Submit rating"}
                    </button>
                  </div>
                  <p id="review-rating-hint" className="rating-field-hint">
                    Enter a number from 0 to 5.
                  </p>
                  {ratingStatus && (
                    <p className={ratingStatus.type}>{ratingStatus.message}</p>
                  )}
                </form>

                <form className="comment-box" onSubmit={handleSubmitComment}>
                  <label className="rating-field-label" htmlFor="review-comment">
                    Your comment
                  </label>
                  <textarea
                    id="review-comment"
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