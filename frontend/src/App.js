import React from "react";
import "./App.css";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { CompanySignupPage, CompanyLoginPage, CompanyHomePage } from "./CompanyAuth";
import { CustomerSignupPage, CustomerLoginPage, CustomerHomePage } from "./CustomerAuth";

function HomePage() {
  return (
    <div
      style={{
        minHeight: "100vh",
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
      <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem", flexWrap: "wrap", justifyContent: "center" }}>
        <Link to="/company/signup">
          <button className="btn btn-primary">Company Signup</button>
        </Link>
        <Link to="/company/login">
          <button className="btn btn-outline">Company Login</button>
        </Link>
        <Link to="/customer/signup">
          <button className="btn btn-primary" style={{ background: "#7c3aed" }}>Customer Signup</button>
        </Link>
        <Link to="/customer/login">
          <button className="btn btn-outline" style={{ borderColor: "#f59e0b", color: "#f59e0b" }}>Customer Login</button>
        </Link>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/company/signup" element={<CompanySignupPage />} />
        <Route path="/company/login" element={<CompanyLoginPage />} />
        <Route path="/company/home" element={<CompanyHomePage />} />
        <Route path="/customer/signup" element={<CustomerSignupPage />} />
        <Route path="/customer/login" element={<CustomerLoginPage />} />
        <Route path="/customer/home" element={<CustomerHomePage />} />
      </Routes>
    </Router>
  );
}

export default App;
