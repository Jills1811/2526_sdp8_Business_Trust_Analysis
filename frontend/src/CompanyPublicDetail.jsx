import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getCustomerToken } from "./CustomerAuth";

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
  padding: "1.5rem",
  boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
};

export default function CompanyPublicDetail() {
  const { companyId } = useParams();
  const navigate = useNavigate();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [myRating, setMyRating] = useState(null);
  const [ratingInput, setRatingInput] = useState("5");
  const [ratingStatus, setRatingStatus] = useState(null);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [commentStatus, setCommentStatus] = useState(null);
  const [postingComment, setPostingComment] = useState(false);

  useEffect(() => {
    const fetchCompany = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${BASE_URL}/api/company/${companyId}/`);
        if (!res.ok) {
          throw new Error("Failed to fetch company details");
        }
        const data = await res.json();
        setCompany(data);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchCompany();
  }, [companyId]);

  useEffect(() => {
    // Fetch comments for this company
    const fetchComments = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/company/${companyId}/comments/`);
        if (!res.ok) return;
        const data = await res.json();
        setComments(Array.isArray(data.comments) ? data.comments : []);
      } catch {
        // ignore for now
      }
    };
    fetchComments();
  }, [companyId]);

  useEffect(() => {
    // If a customer is logged in, fetch their existing rating (if any)
    const token = getCustomerToken();
    if (!token) return;

    const fetchMyRating = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/company/${companyId}/rate/`, {
          headers: {
            Authorization: `Token ${token}`,
          },
        });
        if (!res.ok) {
          // Not fatal for the page; just ignore rating error
          return;
        }
        const data = await res.json();
        if (data.my_rating != null) {
          setMyRating(data.my_rating);
          setRatingInput(String(data.my_rating));
        }
      } catch {
        // ignore errors here
      }
    };

    fetchMyRating();
  }, [companyId]);

  const handleSubmitRating = async (e) => {
    e.preventDefault();
    const token = getCustomerToken();
    if (!token) {
      setRatingStatus({
        type: "error",
        message: "Please log in as a customer to rate this company.",
      });
      return;
    }

    if (myRating != null) {
      setRatingStatus({
        type: "error",
        message: "You have already rated this company.",
      });
      return;
    }

    setSubmittingRating(true);
    setRatingStatus(null);

    try {
      const res = await fetch(`${BASE_URL}/api/company/${companyId}/rate/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${token}`,
        },
        body: JSON.stringify({ rating: parseFloat(ratingInput) }),
      });

      const contentType = res.headers.get("content-type") || "";
      let data;
      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        if (!res.ok) {
          throw new Error(text.slice(0, 200) || "Failed to submit rating.");
        }
        // Try to parse just in case server still returned JSON with wrong header
        try {
          data = JSON.parse(text);
        } catch {
          data = {};
        }
      }

      if (!res.ok) {
        const message =
          typeof data === "string"
            ? data
            : data.detail || "Failed to submit rating.";
        throw new Error(message);
      }

      if (data.company) {
        setCompany(data.company);
      }
      if (data.my_rating != null) {
        setMyRating(data.my_rating);
      }

      setRatingStatus({
        type: "success",
        message: "Your rating has been saved.",
      });
    } catch (err) {
      setRatingStatus({
        type: "error",
        message: err.message,
      });
    } finally {
      setSubmittingRating(false);
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    setCommentStatus(null);
    const token = getCustomerToken();
    if (!token) {
      setCommentStatus({ type: "error", message: "Please log in as a customer to comment." });
      return;
    }
    const text = newComment.trim();
    if (!text) {
      setCommentStatus({ type: "error", message: "Comment cannot be empty." });
      return;
    }
    setPostingComment(true);
    try {
      const res = await fetch(`${BASE_URL}/api/company/${companyId}/comments/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${token}`,
        },
        body: JSON.stringify({ comment: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || "Failed to add comment.");
      }
      // Refresh comments
      const resList = await fetch(`${BASE_URL}/api/company/${companyId}/comments/`);
      const listData = await resList.json();
      setComments(Array.isArray(listData.comments) ? listData.comments : []);
      setNewComment("");
      setCommentStatus({ type: "success", message: "Comment added." });
    } catch (err) {
      setCommentStatus({ type: "error", message: err.message });
    } finally {
      setPostingComment(false);
    }
  };

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: "960px", margin: "0 auto" }}>
        <button
          className="btn btn-outline"
          onClick={() => navigate(-1)}
          style={{ marginBottom: "1rem" }}
        >
          Back
        </button>

        <div style={cardStyle}>
          {loading && <p style={{ color: "#6b7280" }}>Loading company...</p>}
          {error && (
            <p style={{ color: "#b91c1c" }}>
              Error loading company: {error}
            </p>
          )}
          {!loading && !error && company && (
            <>
              <h2 style={{ marginTop: 0, marginBottom: "0.25rem" }}>
                {company.name}
              </h2>
              <p style={{ marginTop: 0, color: "#6b7280" }}>
                {company.category || "Uncategorized"}
              </p>

              {company.city && company.country && (
                <p style={{ marginTop: "0.25rem", color: "#4b5563" }}>
                  📍 {company.city}, {company.country}
                </p>
              )}

              {company.description && (
                <p
                  style={{
                    marginTop: "0.75rem",
                    color: "#374151",
                    lineHeight: 1.6,
                  }}
                >
                  {company.description}
                </p>
              )}

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "1rem",
                  marginTop: "1.25rem",
                }}
              >
                <div
                  style={{
                    padding: "0.9rem 1.1rem",
                    borderRadius: "0.75rem",
                    background: "#f0f4ff",
                    minWidth: "180px",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      color: "#4b5563",
                      fontSize: "0.85rem",
                    }}
                  >
                    Average rating
                  </p>
                  <p
                    style={{
                      margin: "0.2rem 0 0",
                      fontSize: "1.3rem",
                      fontWeight: 700,
                      color: "#1d4ed8",
                    }}
                  >
                    {(company.average_rating ?? 0).toFixed(1)} / 5.0
                  </p>
                  <p
                    style={{
                      margin: "0.1rem 0 0",
                      color: "#6b7280",
                      fontSize: "0.8rem",
                    }}
                  >
                    {(company.total_reviews ?? 0)} reviews
                  </p>
                </div>

                <div
                  style={{
                    padding: "0.9rem 1.1rem",
                    borderRadius: "0.75rem",
                    background: "#ecfdf3",
                    minWidth: "180px",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      color: "#15803d",
                      fontSize: "0.85rem",
                    }}
                  >
                    Trust score
                  </p>
                  <p
                    style={{
                      margin: "0.2rem 0 0",
                      fontSize: "1.3rem",
                      fontWeight: 700,
                      color: "#166534",
                    }}
                  >
                    {(company.reputation_score ?? 0).toFixed(1)} / 100
                  </p>
                  <p
                    style={{
                      margin: "0.1rem 0 0",
                      color: "#166534",
                      fontSize: "0.8rem",
                    }}
                  >
                    Recommendation:{" "}
                    {(company.recommendation_score ?? 0).toFixed(1)} / 100
                  </p>
                </div>
              </div>

              <div style={{ marginTop: "1.5rem" }}>
                <h3 style={{ marginBottom: "0.5rem" }}>Your rating</h3>
                <p style={{ margin: 0, color: "#6b7280", fontSize: "0.9rem" }}>
                  Rate this company from 1.0 (poor) to 5.0 (excellent). Decimal values
                  like 4.5 are allowed. You can only rate once.
                </p>
                <form
                  onSubmit={handleSubmitRating}
                  style={{
                    marginTop: "0.75rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    flexWrap: "wrap",
                  }}
                >
                  <input
                    type="number"
                    min="1"
                    max="5"
                    step="0.1"
                    value={ratingInput}
                    onChange={(e) => setRatingInput(e.target.value)}
                    disabled={myRating != null || submittingRating}
                    style={{
                      padding: "0.4rem 0.6rem",
                      borderRadius: "0.4rem",
                      border: "1px solid #d1d5db",
                      fontSize: "0.9rem",
                      width: "5rem",
                    }}
                  />
                  <button
                    type="submit"
                    disabled={submittingRating}
                    style={{
                      padding: "0.45rem 0.9rem",
                      borderRadius: "0.5rem",
                      border: "none",
                      background: submittingRating ? "#9ca3af" : "#2563eb",
                      color: "white",
                      fontSize: "0.9rem",
                      fontWeight: 600,
                      cursor: submittingRating ? "default" : "pointer",
                    }}
                  >
                    {submittingRating ? "Saving..." : "Submit rating"}
                  </button>
                  {myRating != null && (
                    <span style={{ color: "#4b5563", fontSize: "0.85rem" }}>
                      Your current rating: <strong>{myRating}</strong>
                    </span>
                  )}
                </form>
                {ratingStatus && (
                  <p
                    style={{
                      marginTop: "0.4rem",
                      fontSize: "0.85rem",
                      color:
                        ratingStatus.type === "success" ? "#15803d" : "#b91c1c",
                    }}
                  >
                    {ratingStatus.message}
                  </p>
                )}
              </div>

              <div style={{ marginTop: "1.5rem" }}>
                <h3 style={{ marginBottom: "0.5rem" }}>Contact</h3>
                <p style={{ margin: 0, color: "#4b5563" }}>
                  <strong>Email:</strong> {company.email || "Not provided"}
                </p>
                <p style={{ margin: 0, color: "#4b5563" }}>
                  <strong>Phone:</strong> {company.phone || "Not provided"}
                </p>
                {company.address && (
                  <p style={{ margin: 0, color: "#4b5563" }}>
                    <strong>Address:</strong> {company.address}
                  </p>
                )}
              </div>

              <div style={{ marginTop: "1.5rem" }}>
                <h3 style={{ marginBottom: "0.5rem" }}>Comments</h3>
                <form onSubmit={handleSubmitComment} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Share your experience with this company"
                    rows={3}
                    style={{ padding: "0.6rem", border: "1px solid #d1d5db", borderRadius: "0.5rem" }}
                  />
                  <div>
                    <button
                      type="submit"
                      disabled={postingComment}
                      style={{
                        padding: "0.45rem 0.9rem",
                        borderRadius: "0.5rem",
                        border: "none",
                        background: postingComment ? "#9ca3af" : "#2563eb",
                        color: "white",
                        fontSize: "0.9rem",
                        fontWeight: 600,
                        cursor: postingComment ? "default" : "pointer",
                      }}
                    >
                      {postingComment ? "Posting..." : "Add comment"}
                    </button>
                  </div>
                  {commentStatus && (
                    <p style={{ color: commentStatus.type === "success" ? "#15803d" : "#b91c1c", margin: 0 }}>
                      {commentStatus.message}
                    </p>
                  )}
                </form>

                <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  {comments.length === 0 && (
                    <p style={{ color: "#6b7280", margin: 0 }}>No comments yet.</p>
                  )}
                  {comments.map((c, idx) => (
                    <div key={idx} style={{ padding: "0.75rem", borderRadius: "0.6rem", background: "#f8fafc", border: "1px solid #e5e7eb" }}>
                      <p style={{ margin: 0 }}>{c.comment}</p>
                      <p style={{ margin: "0.3rem 0 0", color: "#6b7280", fontSize: "0.85rem" }}>
                        — {c.customer?.name || "Anonymous"}
                      </p>
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


