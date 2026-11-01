import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import apiClient from "../../js/apiClient.js";
import BASE_API from "../../js/resources/resourceAPI";
import { useAuth } from "../../js/AuthContext.jsx";

const verificationRequests = new Map();

function verifyEmail(token) {
  if (!verificationRequests.has(token)) {
    const request = apiClient
      .post(BASE_API.AUTH_VERIFY_EMAIL, { token })
      .finally(() => verificationRequests.delete(token));
    verificationRequests.set(token, request);
  }
  return verificationRequests.get(token);
}

function AuthCard({ title, children }) {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand">SPIDER-MAN CRAWLER</div>
        <h1>{title}</h1>
        {children}
      </section>
    </main>
  );
}

function AuthMessage({ error, message }) {
  if (error) return <p className="auth-message error" role="alert">{error}</p>;
  if (message) return <p className="auth-message success" role="status">{message}</p>;
  return null;
}

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/CA" replace />;

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      await login({ email, password });
      navigate("/CA", { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard title="Sign in">
      <p className="auth-description">Sign in to manage your crawlers.</p>
      <form className="auth-form" onSubmit={submit}>
        <label htmlFor="login-email">Email</label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <AuthMessage error={error} message={message} />
        <button className="m-btn m-btn-primary btn-size-default" disabled={submitting}>
          {submitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <p className="auth-footer">Need an account? <Link to="/signup">Create one</Link></p>
    </AuthCard>
  );
}

export function SignupPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (searchParams.has("invite")) {
      window.history.replaceState(window.history.state, "", window.location.pathname);
    }
  }, [searchParams]);

  if (user) return <Navigate to="/CA" replace />;

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const { data } = await apiClient.post(BASE_API.AUTH_SIGNUP, {
        email,
        password,
      });
      setMessage(data.message);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to create account.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard title="Create an account">
      <p className="auth-description">Create an account. An administrator must approve it before you can sign in.</p>
      <form className="auth-form" onSubmit={submit}>
        <label htmlFor="signup-email">Email</label>
        <input
          id="signup-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <label htmlFor="signup-password">Password</label>
        <input
          id="signup-password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <span className="auth-hint">Use at least 12 characters.</span>
        <AuthMessage error={error} message={message} />
        <button className="m-btn m-btn-primary btn-size-default" disabled={submitting}>
          {submitting ? "Creating account..." : "Create account"}
        </button>
      </form>
      <p className="auth-footer">Already registered? <Link to="/login">Sign in</Link></p>
    </AuthCard>
  );
}

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const [message, setMessage] = useState("Verifying your email...");
  const [error, setError] = useState("");
  const token = searchParams.get("token");

  useEffect(() => {
    let active = true;
    if (!token) {
      setError("This verification link is missing its token.");
      setMessage("");
      return () => { active = false; };
    }
    window.history.replaceState(window.history.state, "", window.location.pathname);

    verifyEmail(token)
      .then(({ data }) => {
        if (active) setMessage(data.message);
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError.response?.data?.message || "Unable to verify this email.");
          setMessage("");
        }
      });
    return () => { active = false; };
  }, [token]);

  return (
    <AuthCard title="Email verification">
      <AuthMessage error={error} message={message} />
      <p className="auth-footer"><Link to="/login">Continue to sign in</Link></p>
    </AuthCard>
  );
}
