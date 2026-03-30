import React, { useState } from "react";
import API_BASE_URL from "./config";

function AuthForm({ onAuthSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!formData.email || !formData.password) {
      setError("Email and password are required.");
      return;
    }

    setLoading(true);
    try {
      const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Authentication failed.");
      }

      onAuthSuccess(data);
    } catch (submitError) {
      setError(submitError.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <h2>{isRegister ? "Create account" : "Sign in"}</h2>
      <input
        type="email"
        name="email"
        placeholder="Email"
        value={formData.email}
        onChange={handleChange}
      />
      <input
        type="password"
        name="password"
        placeholder="Password"
        value={formData.password}
        onChange={handleChange}
      />
      <button type="submit" disabled={loading}>
        {loading ? "Please wait..." : isRegister ? "Register" : "Login"}
      </button>
      {error ? <p className="error-message">{error}</p> : null}
      <p className="auth-switch">
        {isRegister ? "Already have an account?" : "Need an account?"}
        <button
          type="button"
          className="auth-toggle"
          onClick={() => {
            setIsRegister((previous) => !previous);
            setError("");
          }}
        >
          {isRegister ? "Sign in" : "Register"}
        </button>
      </p>
    </form>
  );
}

export default AuthForm;
