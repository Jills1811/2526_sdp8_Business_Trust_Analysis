import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

function safeStr(v) {
  if (v == null) return "";
  return String(v)
    .split("")
    .filter((ch) => {
      const c = ch.codePointAt(0);
      return (c >= 32 && c !== 127) || c === 9 || c === 10 || c === 13;
    })
    .join("");
}

function fmtDate(v) {
  if (!v) return "—";
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString();
  } catch {
    return "—";
  }
}

function slugFilename(name) {
  const base = safeStr(name || "business")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return base || "business";
}

/**
 * Builds and triggers download of a PDF report for the logged-in company.
 * @param {object} params
 * @param {object|null} params.company — from GET /api/company/me/
 * @param {object|null} params.feedbackData — from GET /api/company/me/feedback/
 */
export function downloadBusinessReportPdf({ company, feedbackData }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = margin;

  const title = "Business Trust — Analytics Report";
  doc.setFontSize(16);
  doc.setFont(undefined, "bold");
  doc.text(title, margin, y);
  y += 8;

  doc.setFontSize(9);
  doc.setFont(undefined, "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
  y += 10;
  doc.setTextColor(0, 0, 0);

  const fb = feedbackData?.feedback;
  const ratings = fb?.ratings ?? [];
  const comments = fb?.comments ?? [];
  const repScore =
    feedbackData?.reputation_score ?? company?.reputation_score ?? 0;
  const avgFromFeedback = feedbackData?.company?.average_rating;
  const totalFromFeedback = feedbackData?.company?.total_reviews;

  // —— Business info ——
  doc.setFontSize(12);
  doc.setFont(undefined, "bold");
  doc.text("Business profile", margin, y);
  y += 6;
  doc.setFontSize(10);
  doc.setFont(undefined, "normal");

  const profileRows = [
    ["Business name", safeStr(company?.name) || "—"],
    ["Category", safeStr(company?.category) || "—"],
    ["Email", safeStr(company?.email) || "—"],
    ["Phone", safeStr(company?.phone) || "—"],
    ["Address", safeStr(company?.address) || "—"],
    [
      "Location",
      [company?.city, company?.country].filter(Boolean).join(", ") || "—",
    ],
    ["Description", safeStr(company?.description) || "—"],
  ];

  autoTable(doc, {
    startY: y,
    head: [["Field", "Value"]],
    body: profileRows,
    theme: "striped",
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 42 },
      1: { cellWidth: pageW - margin * 2 - 42 },
    },
  });
  y = doc.lastAutoTable.finalY + 8;

  // —— Summary metrics ——
  if (y > 250) {
    doc.addPage();
    y = margin;
  }
  doc.setFontSize(12);
  doc.setFont(undefined, "bold");
  doc.text("Summary metrics", margin, y);
  y += 6;

  const avgRating =
    avgFromFeedback != null
      ? Number(avgFromFeedback)
      : Number(company?.average_rating ?? 0);
  const totalRatings =
    totalFromFeedback != null
      ? Number(totalFromFeedback)
      : Number(company?.total_reviews ?? 0);

  const summaryRows = [
    ["Trust / reputation score", `${Number(repScore).toFixed(1)} / 100`],
    ["Average rating", `${avgRating.toFixed(2)} / 5.0`],
    ["Total ratings ", String(totalRatings)],
    // ["New ratings in data (rows below)", String(ratings.length)],
    ["Total customer comments ", String(comments.length)],
  ];

  autoTable(doc, {
    startY: y,
    head: [["Metric", "Value"]],
    body: summaryRows,
    theme: "striped",
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 75 },
      1: { cellWidth: pageW - margin * 2 - 75 },
    },
  });
  y = doc.lastAutoTable.finalY + 10;

  // —— Ratings table ——
  if (y > 230) {
    doc.addPage();
    y = margin;
  }
  doc.setFontSize(12);
  doc.setFont(undefined, "bold");
  doc.text("Individual ratings", margin, y);
  y += 6;

  if (ratings.length === 0) {
    doc.setFontSize(10);
    doc.setFont(undefined, "italic");
    doc.text("No individual ratings recorded.", margin, y);
    y += 10;
  } else {
    const ratingBody = ratings.map((r, i) => [
      String(i + 1),
      safeStr(r.user_id).slice(0, 24) + (safeStr(r.user_id).length > 24 ? "…" : ""),
      typeof r.rating === "number" ? r.rating.toFixed(2) : safeStr(r.rating),
      fmtDate(r.created_at),
    ]);
    autoTable(doc, {
      startY: y,
      head: [["#", "Customer ID", "Rating", "Date"]],
      body: ratingBody,
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [37, 99, 235] },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // —— Comments / reviews ——
  if (y > 200) {
    doc.addPage();
    y = margin;
  }
  doc.setFontSize(12);
  doc.setFont(undefined, "bold");
  doc.text("Customer comments & reviews", margin, y);
  y += 6;

  if (comments.length === 0) {
    doc.setFontSize(10);
    doc.setFont(undefined, "italic");
    doc.text("No comments yet.", margin, y);
  } else {
    const commentBody = comments.map((c, i) => {
      const text = safeStr(c.comment || "");
      const short =
        text.length > 500 ? `${text.slice(0, 497)}...` : text;
      const sent =
        typeof c.sentiment === "number"
          ? c.sentiment.toFixed(2)
          : "—";
      const name =
        safeStr(
          (c.customer_name && String(c.customer_name).trim()) || "Anonymous"
        ).slice(0, 36) || "Anonymous";
      return [
        String(i + 1),
        name,
        short,
        sent,
        fmtDate(c.created_at),
      ];
    });
    autoTable(doc, {
      startY: y,
      head: [["#", "Customer", "Comment", "Sentiment*", "Date"]],
      body: commentBody,
      theme: "striped",
      styles: { fontSize: 7, cellPadding: 1.5 },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 32 },
        2: { cellWidth: pageW - margin * 2 - 10 - 32 - 22 - 38 },
        3: { cellWidth: 22 },
        4: { cellWidth: 38 },
      },
      headStyles: { fillColor: [37, 99, 235] },
    });
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text(
      "*Sentiment is a simple keyword-based score from the server (not ML).",
      margin,
      doc.lastAutoTable.finalY + 5
    );
  }

  const fname = `${slugFilename(company?.name)}-report-${Date.now()}.pdf`;
  doc.save(fname);
}
