import React from "react";
import { Routes, Route } from "react-router-dom";
import LandingPage from "./pages/auth/LandingPage.jsx";

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      {/* Add more routes later: /login, /dashboard, etc. */}
    </Routes>
  );
}

export default App;
