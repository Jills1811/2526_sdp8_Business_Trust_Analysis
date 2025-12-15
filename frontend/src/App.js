import React, { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

const API_BASE = process.env.REACT_APP_API_BASE ?? 'http://127.0.0.1:8000/api';

function App() {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [companySubmitting, setCompanySubmitting] = useState(false);
  const [companySuccess, setCompanySuccess] = useState('');
  const [companyError, setCompanyError] = useState('');
  const featuredRef = useRef(null);
  const [companyForm, setCompanyForm] = useState({
    name: '',
    category: '',
    owner_id: '',
    email: '',
    phone: '',
    city: '',
    country: '',
    description: '',
  });

  const fallbackBusinesses = useMemo(
    () => [
      { id: 1, name: 'Aurora Coffee Co.', rating: 4.8, reviews: 1280 },
      { id: 2, name: 'Northwind Logistics', rating: 4.6, reviews: 940 },
      { id: 3, name: 'Brightside Health', rating: 4.9, reviews: 1523 },
    ],
    []
  );

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/company/`);
        if (!res.ok) throw new Error('Failed to fetch businesses');
        const data = await res.json();
        setBusinesses(Array.isArray(data) ? data : []);
      } catch (err) {
        // Keep fallback data if API is unavailable.
        console.warn('Business fetch skipped, using fallback:', err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const visibleBusinesses =
    businesses && businesses.length > 0 ? businesses : fallbackBusinesses;

  const handleGuestContinue = () => {
    if (featuredRef.current) {
      featuredRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleAuthAction = (type) => {
    // Replace with real navigation when routes exist.
    console.info(`Navigate to ${type} flow`);
  };

  const handleCompanyChange = (e) => {
    const { name, value } = e.target;
    setCompanyForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCompanySubmit = async (e) => {
    e.preventDefault();
    setCompanyError('');
    setCompanySuccess('');

    if (!companyForm.name || !companyForm.category || !companyForm.owner_id) {
      setCompanyError('Name, category, and owner ID are required.');
      return;
    }

    const payload = {
      ...companyForm,
      owner_id: Number(companyForm.owner_id),
    };

    setCompanySubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/company/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail?.detail || 'Unable to register company');
      }

      const created = await res.json();
      setCompanySuccess(`Company “${created.name}” registered successfully.`);
      setCompanyForm({
        name: '',
        category: '',
        owner_id: '',
        email: '',
        phone: '',
        city: '',
        country: '',
        description: '',
      });
      // Refresh visible companies so new one appears.
      setBusinesses((prev) => [created, ...(prev || [])]);
    } catch (err) {
      setCompanyError(err.message || 'Something went wrong.');
    } finally {
      setCompanySubmitting(false);
    }
  };

  return (
    <div className="page">
      <header className="hero">
        <div className="hero__content">
          <div className="pill">AI-Powered Reputation & Trust Analysis</div>
          <h1>
            Build trust with the businesses your users rely on.
            <span> Real insights. Actionable recommendations. Happier customers.</span>
          </h1>
          <p className="hero__subtitle">
            Analyze reviews, sentiment, and signals to showcase trustworthy partners,
            improve your marketplace, and give customers confidence with every click.
          </p>
          <div className="hero__actions">
            <button className="btn btn-primary" onClick={() => handleAuthAction('demo')}>
              Book a demo
            </button>
            <button className="btn btn-ghost" onClick={() => handleAuthAction('insights')}>
              View sample insights
            </button>
            <button className="btn btn-outline" onClick={handleGuestContinue}>
              Continue as guest
            </button>
          </div>
          <div className="hero__meta">
            <div>
              <strong>+32%</strong>
              <span>Higher conversion after trust scores</span>
            </div>
            <div>
              <strong>97%</strong>
              <span>Customer satisfaction with curated vendors</span>
            </div>
            <div>
              <strong>24h</strong>
              <span>Fresh data refresh cycle</span>
            </div>
          </div>
        </div>
        <div className="hero__card">
          <div className="card__header">
            <span className="dot red" />
            <span className="dot yellow" />
            <span className="dot green" />
          </div>
          <div className="card__body">
            <h3>Live trust snapshot</h3>
            <div className="score">
              <span className="score__label">Trust Score</span>
              <span className="score__value">92</span>
              <span className="score__change positive">+5.4%</span>
            </div>
            <div className="signals">
              <div>
                <p>Sentiment trend</p>
                <span className="tag positive">↑ Positive</span>
              </div>
              <div>
                <p>Review quality</p>
                <span className="tag neutral">Verified</span>
              </div>
              <div>
                <p>AI anomalies</p>
                <span className="tag warning">Low risk</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="section">
        <div className="section__header">
          <p className="eyebrow">Why it matters</p>
          <h2>Turn reputation signals into business growth.</h2>
          <p className="section__sub">
            Combine NLP, verified reviews, and behavioral signals to surface businesses
            your customers can trust—automatically.
          </p>
        </div>
        <div className="grid features">
          <div className="card feature">
            <h3>Sentiment intelligence</h3>
            <p>Distill thousands of reviews into concise, explainable insights.</p>
          </div>
          <div className="card feature">
            <h3>Trust scoring</h3>
            <p>Multi-signal scoring blends recency, volume, and authenticity checks.</p>
          </div>
          <div className="card feature">
            <h3>AI chat for every business</h3>
            <p>Let users ask questions and get grounded, source-linked answers.</p>
          </div>
          <div className="card feature">
            <h3>Personalized rankings</h3>
            <p>Recommend the right partner for each user’s intent and risk profile.</p>
          </div>
        </div>
      </section>

      <section className="section auth">
        <div className="section__header">
          <p className="eyebrow">Access the platform</p>
          <h2>Log in, create an account, or explore as a guest.</h2>
          <p className="section__sub">
            Users can browse trusted businesses without logging in. Register or sign in to
            personalize recommendations and manage your company profile.
          </p>
        </div>
        <div className="auth__grid">
          <div className="card auth__card">
            <div className="pill pill-muted">For users</div>
            <h3>Discover trusted businesses</h3>
            <p className="muted">
              Browse, compare, and chat with AI without an account. Sign up to save
              favorites and get tailored recommendations.
            </p>
            <div className="auth__actions">
              <button className="btn btn-primary" onClick={() => handleAuthAction('user-login')}>
                Login
              </button>
              <button className="btn btn-ghost" onClick={() => handleAuthAction('user-register')}>
                Register
              </button>
              <button className="btn btn-outline" onClick={handleGuestContinue}>
                Continue as guest
              </button>
            </div>
          </div>
          <div className="card auth__card">
            <div className="pill pill-muted">For companies</div>
            <h3>Showcase your trust signals</h3>
            <p className="muted">
              Claim your profile, monitor sentiment, and respond with AI. Register to earn
              badges, manage reviews, and boost conversion.
            </p>
            <div className="auth__actions">
              <button className="btn btn-primary" onClick={() => handleAuthAction('company-login')}>
                Company login
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => handleAuthAction('company-register')}
              >
                Register company
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section__header">
          <p className="eyebrow">Register your company</p>
          <h2>Tell us about your business to start earning trust signals.</h2>
          <p className="section__sub">
            Submit your company to monitor sentiment, manage reputation, and showcase verified
            trust metrics on the platform.
          </p>
        </div>
        <div className="card form-card">
          <form className="form" onSubmit={handleCompanySubmit}>
            <div className="form-row">
              <label>
                Company name *
                <input
                  name="name"
                  value={companyForm.name}
                  onChange={handleCompanyChange}
                  placeholder="Acme Corp"
                  required
                />
              </label>
              <label>
                Category *
                <input
                  name="category"
                  value={companyForm.category}
                  onChange={handleCompanyChange}
                  placeholder="Logistics, Fintech, Retail..."
                  required
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Owner ID *
                <input
                  name="owner_id"
                  value={companyForm.owner_id}
                  onChange={handleCompanyChange}
                  type="number"
                  min="1"
                  placeholder="Internal user ID"
                  required
                />
              </label>
              <label>
                Work email
                <input
                  name="email"
                  value={companyForm.email}
                  onChange={handleCompanyChange}
                  type="email"
                  placeholder="ops@acme.com"
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Phone
                <input
                  name="phone"
                  value={companyForm.phone}
                  onChange={handleCompanyChange}
                  placeholder="+1 555 0100"
                />
              </label>
              <label>
                City
                <input
                  name="city"
                  value={companyForm.city}
                  onChange={handleCompanyChange}
                  placeholder="San Francisco"
                />
              </label>
              <label>
                Country
                <input
                  name="country"
                  value={companyForm.country}
                  onChange={handleCompanyChange}
                  placeholder="United States"
                />
              </label>
            </div>
            <label>
              Description
              <textarea
                name="description"
                value={companyForm.description}
                onChange={handleCompanyChange}
                rows={3}
                placeholder="What you do, key offerings, and audience."
              />
            </label>
            {companyError && <div className="alert error">{companyError}</div>}
            {companySuccess && <div className="alert success">{companySuccess}</div>}
            <div className="form-actions">
              <button className="btn btn-primary" type="submit" disabled={companySubmitting}>
                {companySubmitting ? 'Submitting...' : 'Register company'}
              </button>
              <span className="muted">You can edit details later from your dashboard.</span>
            </div>
          </form>
        </div>
      </section>

      <section className="section">
        <div className="section__header">
          <p className="eyebrow">Featured businesses</p>
          <h2>High-trust partners your users will love.</h2>
          <p className="section__sub">
            {loading
              ? 'Syncing with your data...'
              : 'Pulled from your live API when available; showing sample data otherwise.'}
          </p>
        </div>
        <div className="grid businesses" ref={featuredRef}>
          {visibleBusinesses.map((b) => (
            <div className="card business" key={b.id || b.name}>
              <div className="business__header">
                <h3>{b.name}</h3>
                <span className="rating">{b.rating ?? '–'}</span>
              </div>
              <p className="muted">
                {b.reviews ? `${b.reviews.toLocaleString()} verified reviews` : 'Trusted partner'}
              </p>
              <div className="badges">
                <span className="tag positive">Great service</span>
                <span className="tag neutral">Fast response</span>
                <span className="tag warning">Low risk</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section highlight">
        <div className="section__header">
          <p className="eyebrow">How it works</p>
          <h2>From raw signals to credible decisions.</h2>
        </div>
        <div className="steps">
          <div className="step">
            <span className="step__number">01</span>
            <div>
              <h4>Connect your data</h4>
              <p>Ingest reviews, ratings, tickets, and operational signals via API.</p>
            </div>
          </div>
          <div className="step">
            <span className="step__number">02</span>
            <div>
              <h4>Score & detect risk</h4>
              <p>AI-powered scoring surfaces sentiment trends and anomalies.</p>
            </div>
          </div>
          <div className="step">
            <span className="step__number">03</span>
            <div>
              <h4>Deliver trust everywhere</h4>
              <p>Embed rankings, badges, and chat to boost conversion and retention.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section cta">
        <div>
          <p className="eyebrow">Ready to build trust?</p>
          <h2>Show your users the most reliable businesses—confidently.</h2>
          <p className="section__sub">
            Get a guided walkthrough of the platform and see your own data in minutes.
          </p>
        </div>
        <div className="cta__actions">
          <button className="btn btn-primary">Get started</button>
          <button className="btn btn-ghost">Talk to an expert</button>
        </div>
      </section>

      <footer className="footer">
        <div>
          <strong>Business Trust Analysis</strong>
          <p className="muted">AI-driven reputation, recommendations, and chat.</p>
        </div>
        <div className="footer__links">
          <a href="#product">Product</a>
          <a href="#security">Security</a>
          <a href="#contact">Contact</a>
        </div>
      </footer>
    </div>
  );
}

export default App;
