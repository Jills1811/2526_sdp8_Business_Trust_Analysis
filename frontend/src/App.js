import React, { useEffect, useState } from "react";
import "./App.css";
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from "react-router-dom";
import { CompanySignupPage, CompanyLoginPage, CompanyHomePage } from "./CompanyAuth";
import { CustomerSignupPage, CustomerLoginPage, CustomerHomePage } from "./CustomerAuth";
import BusinessDashboard from "./BusinessDashboard";
import CompanyPublicDetail from "./CompanyPublicDetail";
import BusinessSearch from "./BusinessSearch";
import TopBusinesses from "./TopBusinesses";
import Recommendations from "./Recommendations";
import CompanyProfile from "./CompanyProfile";
import CompanyFeedback from "./CompanyFeedback";

function HomePage() {
  return (
    <div
      style={{
        minHeight: "calc(100vh - 64px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        background: "#f3f4f6",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <h1 style={{ margin: 0 }}>Business Trust Platform</h1>
      <p style={{ color: "#4b5563", margin: 0 }}>
        Continue as guest or access company features.
      </p>
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          marginTop: "0.5rem",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <Link to="/company/signup">
          <button className="btn btn-primary">Company Signup</button>
        </Link>
        <Link to="/company/login">
          <button className="btn btn-outline">Company Login</button>
        </Link>
        <Link to="/customer/signup">
          <button className="btn btn-primary" style={{ background: "#7c3aed" }}>
            Customer Signup
          </button>
        </Link>
        <Link to="/customer/login">
          <button
            className="btn btn-outline"
            style={{ borderColor: "#f59e0b", color: "#f59e0b" }}
          >
            Customer Login
          </button>
        </Link>
        <Link to="/dashboard">
          {/* <button
            className="btn btn-outline"
            style={{ borderColor: "#2563eb", color: "#2563eb" }}
          >
            Business Dashboard
          </button> */}
        </Link>
      </div>
    </div>
  );
}

function NavBar({ isLoggedIn, isCompanyLoggedIn, isCustomerLoggedIn, onLogout }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    onLogout();
    navigate("/");
  };

  return (
    <nav className="navbar">
      <div className="navbar__brand">
        <Link to="/">Business Trust</Link>
      </div>
      <div className="navbar__links">
        {isCustomerLoggedIn && (
          <>
            <Link to="/search">Search</Link>
            <Link to="/top">Top</Link>
            <Link to="/recommendations">Recommendations</Link>
          </>
        )}
        {isCompanyLoggedIn && (
          <>
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/company/profile">Profile</Link>
            <Link to="/company/feedback">Feedback</Link>
          </>
        )}
        {isLoggedIn && (
          <button className="btn btn-outline" onClick={handleLogout}>
            Log out
          </button>
        )}
      </div>
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

  return (
    <Router>
      <div className="app-shell">
        <NavBar isLoggedIn={isLoggedIn} isCompanyLoggedIn={isCompanyLoggedIn} isCustomerLoggedIn={isCustomerLoggedIn} onLogout={handleLogout} />
        <main className="app-main">
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
            <Route path="/customer/signup" element={<CustomerSignupPage />} />
            <Route path="/customer/login" element={<CustomerLoginPage />} />
            <Route path="/customer/home" element={<CustomerHomePage />} />
            <Route path="/dashboard" element={<BusinessDashboard />} />
            <Route path="/companies/:companyId" element={<CompanyPublicDetail />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
