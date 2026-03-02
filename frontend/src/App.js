import React, { useEffect, useState } from "react";
import "./App.css";
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation } from "react-router-dom";
import { CompanySignupPage, CompanyLoginPage, CompanyHomePage } from "./CompanyAuth";
import { CustomerSignupPage, CustomerLoginPage, CustomerHomePage } from "./CustomerAuth";
import BusinessDashboard from "./BusinessDashboard";
import CompanyPublicDetail from "./CompanyPublicDetail";
import BusinessSearch from "./BusinessSearch";
import TopBusinesses from "./TopBusinesses";
import Recommendations from "./Recommendations";
import CompanyProfile from "./CompanyProfile";
import CompanyFeedback from "./CompanyFeedback";
import {
  CompanyRecommendationPage,
  CompanyAnalyticsPage,
} from "./CompanyAnalytics";
import CustomerProfile from "./CustomerProfile";
import LandingLogin from "./LandingLogin";

function HomePage() {
  return <LandingLogin />;
}

function NavBar({ isLoggedIn, isCompanyLoggedIn, isCustomerLoggedIn, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isLoginPage = location.pathname === "/";

  const handleLogout = () => {
    onLogout();
    navigate("/");
  };

  return (
    <nav className="navbar">
      <div className="navbar__brand">
        <Link
          to={
            isCompanyLoggedIn
              ? "/dashboard"
              : isCustomerLoggedIn
              ? "/customer/home"
              : "/"
          }
        >
          Business Trust
        </Link>
      </div>
      {!isLoginPage && (
        <div className="navbar__links">
          {isCustomerLoggedIn && (
            <>
              <Link to="/search">Search</Link>
              <Link to="/top">Top</Link>
              <Link to="/recommendations">Recommendations</Link>
              <Link to="/customer/profile">Profile</Link>
              {/* <Link to="" onClick={handleLogout}>logout</Link> */}
            </>
          )}
          {isCompanyLoggedIn && (
            <>
              <Link to="/dashboard">Dashboard</Link>
              <Link to="/company/profile">Profile</Link>
              <Link to="/company/feedback">Feedback/Review</Link>
              {/* <Link to="/company/recommendation">Recommendation</Link>
              <Link to="/company/analytics">Analytics</Link> */}
            </>
          )}
          {isLoggedIn && (
            <button className="btn btn-outline" onClick={handleLogout}>
              Log out
            </button>
          )}
        </div>
      )}
    </nav>
  );
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isCompanyLoggedIn, setIsCompanyLoggedIn] = useState(false);
  const [isCustomerLoggedIn, setIsCustomerLoggedIn] = useState(false);

  useEffect(() => {
    const checkAuth = () => {
      const hasCompany = !!localStorage.getItem("companyToken");
      const hasCustomer = !!localStorage.getItem("customerToken");
      setIsLoggedIn(hasCompany || hasCustomer);
      setIsCompanyLoggedIn(hasCompany);
      setIsCustomerLoggedIn(hasCustomer);
    };

    checkAuth();
    window.addEventListener("storage", checkAuth);
    window.addEventListener("auth-changed", checkAuth);
    return () => {
      window.removeEventListener("storage", checkAuth);
      window.removeEventListener("auth-changed", checkAuth);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("companyToken");
    localStorage.removeItem("customerToken");
    localStorage.removeItem("companyData");
    localStorage.removeItem("customerData");
    setIsLoggedIn(false);
  };

  const publicUrl = process.env.PUBLIC_URL || "";
  const appBgImage = isLoggedIn ? `${publicUrl}/i3.png` : `${publicUrl}/i1.webp`;
  const bgFixedClass = isLoggedIn ? " app-main__bg--fixed" : "";

  return (
    <Router>
      <div className="app-shell">
        <NavBar isLoggedIn={isLoggedIn} isCompanyLoggedIn={isCompanyLoggedIn} isCustomerLoggedIn={isCustomerLoggedIn} onLogout={handleLogout} />
        <main className="app-main">
          <div
            className={`app-main__bg${bgFixedClass}`}
            aria-hidden="true"
            style={{ backgroundImage: `url(${appBgImage})` }}
          />
          <div className="app-main__content">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<BusinessSearch />} />
            <Route path="/top" element={<TopBusinesses />} />
            <Route path="/recommendations" element={<Recommendations />} />
            <Route path="/company/signup" element={<CompanySignupPage />} />
            <Route path="/company/login" element={<CompanyLoginPage />} />
            <Route path="/company/home" element={<CompanyHomePage />} />
            <Route path="/company/profile" element={<CompanyProfile />} />
            <Route path="/company/feedback" element={<CompanyFeedback />} />
            <Route
              path="/company/recommendation"
              element={<CompanyRecommendationPage />}
            />
            <Route
              path="/company/analytics"
              element={<CompanyAnalyticsPage />}
            />
            <Route path="/customer/signup" element={<CustomerSignupPage />} />
            <Route path="/customer/login" element={<CustomerLoginPage />} />
            <Route path="/customer/home" element={<CustomerHomePage />} />
            <Route path="/customer/profile" element={<CustomerProfile />} />
            <Route path="/dashboard" element={<BusinessDashboard />} />
            <Route path="/companies/:companyId" element={<CompanyPublicDetail />} />
          </Routes>
          </div>
        </main>
      </div>
    </Router>
  );
}

export default App;
