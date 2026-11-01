import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import apiClient from "../../js/apiClient.js";
import BASE_API from "../../js/resources/resourceAPI";
import { useAuth } from "../../js/AuthContext.jsx";

export default function AdminApprovalsPage() {
  const { user } = useAuth();
  const [pendingUsers, setPendingUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadPendingUsers = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const { data } = await apiClient.get(BASE_API.AUTH_PENDING_USERS);
      setPendingUsers(data.users);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load pending accounts.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === "admin") loadPendingUsers();
  }, [loadPendingUsers, user?.role]);

  if (user?.role !== "admin") return <Navigate to="/CA" replace />;

  const decide = async (pendingUser, status) => {
    setUpdatingUserId(pendingUser._id);
    setError("");
    setMessage("");
    try {
      await apiClient.post(BASE_API.AUTH_USER_APPROVAL(pendingUser._id), { status });
      setPendingUsers((users) => users.filter(({ _id }) => _id !== pendingUser._id));
      setMessage(`${pendingUser.email} ${status}.`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to update this account.");
    } finally {
      setUpdatingUserId("");
    }
  };

  return (
    <section className="admin-approvals">
      <h1>Account approvals</h1>
      <p>Review new accounts before they can access the crawler workspace.</p>
      {error && <p className="auth-message error" role="alert">{error}</p>}
      {message && <p className="auth-message success" role="status">{message}</p>}
      {isLoading ? (
        <p>Loading pending accounts...</p>
      ) : error ? (
        <button type="button" onClick={loadPendingUsers}>Retry loading accounts</button>
      ) : pendingUsers.length === 0 ? (
        <p>There are no accounts waiting for approval.</p>
      ) : (
        <ul className="approval-list">
          {pendingUsers.map((pendingUser) => (
            <li className="approval-item" key={pendingUser._id}>
              <div>
                <strong>{pendingUser.email}</strong>
                <span>Requested {new Date(pendingUser.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="approval-actions">
                <button
                  type="button"
                  disabled={Boolean(updatingUserId)}
                  onClick={() => decide(pendingUser, "approved")}
                >
                  {updatingUserId === pendingUser._id ? "Saving..." : "Approve"}
                </button>
                <button
                  type="button"
                  disabled={Boolean(updatingUserId)}
                  onClick={() => decide(pendingUser, "rejected")}
                >
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
