import React, { useState } from "react";

const USERS = {
  user1: "7hdxq2ma",
  user2: "n9q1zw2s",
  user3: "fmp38tkv",
  user4: "8y2aclm4",
  user5: "jd2k09qh",
  user6: "v1mw8xg0",
  user7: "43sn9vmc",
  user8: "e71r2wpq",
  user9: "wvjxy1zn",
  user10: "zhc28qrx",
  user11: "9kafj4mc",
  user12: "u8cx92rw",
  user13: "rm1txe57",
  user14: "b5gwzm41",
  user15: "70qnayhc",
  user16: "hxv9e30b",
  user17: "1vfx8qrk",
  user18: "dz48mwy1",
  user19: "4seu7bxp",
  user20: "tcgw9e3m",
};

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (USERS[username] && USERS[username] === password) {
      setError("");
      onLogin(username);
    } else {
      setError("Invalid username or password");
    }
  };

  return (
    <div
      style={{
        maxWidth: 400,
        margin: "5rem auto",
        padding: "1rem",
        fontFamily: "sans-serif",
      }}
    >
      <h2 style={{ textAlign: "center" }}>Login</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Username:
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            style={{
              width: "100%",
              padding: "0.5rem",
              marginTop: 6,
              marginBottom: 12,
            }}
          />
        </label>
        <label>
          Password:
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            style={{
              width: "100%",
              padding: "0.5rem",
              marginTop: 6,
              marginBottom: 12,
            }}
          />
        </label>
        <button
          type="submit"
          style={{
            width: "100%",
            padding: "0.75rem",
            backgroundColor: "#4CAF50",
            color: "white",
            border: "none",
            fontSize: "1rem",
            cursor: "pointer",
            borderRadius: 6,
          }}
        >
          Login
        </button>
        {error && (
          <p style={{ color: "red", marginTop: "1rem", textAlign: "center" }}>
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
