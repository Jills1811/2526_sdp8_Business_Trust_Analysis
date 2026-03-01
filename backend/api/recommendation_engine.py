"""
ML-based recommendation engine using MongoDB data.

Strategy:
- User-user collaborative filtering: find users similar to the current user
  (by shared business interests, category preferences, location), then recommend
  businesses that those similar users liked but the current user has not seen.
- Signals: ratings, recently_viewed, search history (category/query), location.
- Blends similarity-based scores with content boost (category, location).
"""
from collections import defaultdict
import math


def _normalize(s):
    """Normalize string for matching (lower, strip)."""
    return (s or "").strip().lower()


def _cosine_sim(vec_a, vec_b):
    """Cosine similarity between two dicts treated as vectors. Returns 0 if either norm is 0."""
    if not vec_a or not vec_b:
        return 0.0
    dot = sum(vec_a.get(k, 0) * vec_b.get(k, 0) for k in set(vec_a) | set(vec_b))
    norm_a = math.sqrt(sum(v * v for v in vec_a.values()))
    norm_b = math.sqrt(sum(v * v for v in vec_b.values()))
    if norm_a <= 0 or norm_b <= 0:
        return 0.0
    return dot / (norm_a * norm_b)


def _jaccard(set_a, set_b):
    """Jaccard similarity between two sets."""
    if not set_a or not set_b:
        return 0.0
    inter = len(set_a & set_b)
    union = len(set_a | set_b)
    return inter / union if union else 0.0


def load_user_interest_vectors(
    ratings_collection,
    search_history_collection,
    customers_collection,
    companies_collection,
):
    """
    Build per-user interest data from MongoDB (ratings, views, search history).
    Returns:
      - user_business_weights: dict[user_id, dict[company_id, weight]]
      - user_category_weights: dict[user_id, dict[category, weight]]
      - user_locations: dict[user_id, location_str]
      - company_info: dict[company_id, {category, city, country}]
    """
    user_business_weights = defaultdict(lambda: defaultdict(float))
    user_category_weights = defaultdict(lambda: defaultdict(float))
    user_locations = {}
    company_info = {}

    # Companies: id -> category, city, country
    for doc in companies_collection.find({"is_active": True}):
        cid = doc.get("company_id") or str(doc.get("_id"))
        company_info[cid] = {
            "category": _normalize(doc.get("category", "")),
            "city": _normalize(doc.get("city", "")),
            "country": _normalize(doc.get("country", "")),
        }

    # Ratings: explicit interest (weight by rating 1-5 -> 0.2 to 1.0)
    for doc in ratings_collection.find():
        uid = str(doc.get("user_id", ""))
        cid = str(doc.get("company_id", ""))
        r = float(doc.get("rating", 0) or 0)
        if uid and cid and r >= 1:
            weight = min(1.0, r / 5.0)  # 1->0.2, 5->1.0
            user_business_weights[uid][cid] = max(
                user_business_weights[uid][cid], weight
            )
            cat = company_info.get(cid, {}).get("category", "")
            if cat:
                user_category_weights[uid][cat] = user_category_weights[uid].get(cat, 0) + weight

    # Recently viewed: implicit interest (weight 0.7)
    for doc in customers_collection.find():
        uid = str(doc.get("user_id", ""))
        if not uid:
            continue
        loc = (doc.get("location") or "").strip()
        if loc:
            user_locations[uid] = _normalize(loc)
        for cid in (doc.get("recently_viewed") or [])[:20]:
            cid = str(cid)
            user_business_weights[uid][cid] = max(
                user_business_weights[uid][cid], 0.7
            )
            cat = company_info.get(cid, {}).get("category", "")
            if cat:
                user_category_weights[uid][cat] = user_category_weights[uid].get(cat, 0) + 0.5

    # Search history: category interest (decay by recency)
    for idx, doc in enumerate(
        search_history_collection.find().sort("timestamp", -1).limit(5000)
    ):
        uid = str(doc.get("user_id", ""))
        if not uid:
            continue
        cat = _normalize(doc.get("category", ""))
        if cat:
            weight = 1.0 / (1.0 + idx * 0.01)  # slight decay
            user_category_weights[uid][cat] = (
                user_category_weights[uid].get(cat, 0) + weight
            )

    return (
        dict(user_business_weights),
        dict(user_category_weights),
        user_locations,
        company_info,
    )


def get_similar_users(
    current_user_id,
    user_business_weights,
    user_category_weights,
    user_locations,
    top_k=50,
):
    """
    Find users most similar to current_user_id using:
    - Overlap in businesses (ratings + views)
    - Overlap in category preferences
    - Same location (bonus)
    Returns list of (user_id, similarity_score).
    """
    current_user_id = str(current_user_id)
    if current_user_id not in user_business_weights and current_user_id not in user_category_weights:
        return []

    cur_business = set(user_business_weights.get(current_user_id, {}).keys())
    cur_categories = user_category_weights.get(current_user_id, {})
    cur_location = user_locations.get(current_user_id, "")

    # Build combined category vector for cosine
    cur_cat_vec = dict(cur_categories)

    scores = []
    for uid, weights in user_business_weights.items():
        if uid == current_user_id:
            continue
        other_business = set(weights.keys())
        other_categories = user_category_weights.get(uid, {})

        # Business overlap (Jaccard) – strong signal
        jaccard_b = _jaccard(cur_business, other_business)
        # Category similarity (cosine)
        other_cat_vec = dict(other_categories)
        cat_sim = _cosine_sim(cur_cat_vec, other_cat_vec)
        # Location match bonus
        other_loc = user_locations.get(uid, "")
        loc_bonus = 0.2 if (cur_location and other_loc and (cur_location in other_loc or other_loc in cur_location)) else 0.0

        # Combined similarity
        sim = 0.01 * jaccard_b + 0.4 * cat_sim + loc_bonus
        if sim > 0:
            scores.append((uid, sim))

    scores.sort(key=lambda x: x[1], reverse=True)
    return scores[:top_k]


def recommend_businesses_ml(
    current_user_id,
    ratings_collection,
    search_history_collection,
    customers_collection,
    companies_collection,
    limit=10,
    candidate_company_ids=None,
    base_query=None,
):
    """
    ML recommendations for current_user_id:
    - Similar users liked these businesses; current user has not seen them.
    - Boost by category match (user's search/category interest) and location.

    If candidate_company_ids or base_query is provided, only recommend from that set.
    Returns list of dicts: [{"company_id": id, "score": float}, ...]
    """
    (
        user_business_weights,
        user_category_weights,
        user_locations,
        company_info,
    ) = load_user_interest_vectors(
        ratings_collection,
        search_history_collection,
        customers_collection,
        companies_collection,
    )

    current_user_id = str(current_user_id)
    seen_by_user = set(user_business_weights.get(current_user_id, {}).keys())
    user_cat_pref = user_category_weights.get(current_user_id, {})
    user_location = user_locations.get(current_user_id, "")

    similar = get_similar_users(
        current_user_id,
        user_business_weights,
        user_category_weights,
        user_locations,
        top_k=50,
    )

    # If no similar users, fall back to empty (caller can use reputation-based)
    if not similar:
        return []

    # Aggregate: for each business that similar users liked, sum similarity * interest
    business_scores = defaultdict(float)
    for other_uid, sim in similar:
        for cid, weight in user_business_weights.get(other_uid, {}).items():
            if cid in seen_by_user:
                continue
            business_scores[cid] += sim * weight

    # Filter by candidate set if provided
    if candidate_company_ids is not None:
        candidate_set = set(str(x) for x in candidate_company_ids)
        business_scores = {
            cid: s for cid, s in business_scores.items() if cid in candidate_set
        }

    # Content boost: category and location
    boosted = []
    for cid, base_score in business_scores.items():
        info = company_info.get(cid, {})
        cat = info.get("category", "")
        city = info.get("city", "")
        country = info.get("country", "")

        cat_boost = user_cat_pref.get(cat, 0.0) * 0.3  # up to 0.3
        loc_boost = 0.0
        if user_location:
            if city and (user_location in city or city in user_location):
                loc_boost = 0.2
            elif country and (user_location in country or country in user_location):
                loc_boost = 0.1

        total = base_score + cat_boost + loc_boost
        boosted.append({"company_id": cid, "score": total})

    boosted.sort(key=lambda x: x["score"], reverse=True)
    return boosted[:limit]
