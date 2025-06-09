import React, { useState } from "react";
import Login from "./Login";
import Journal from "./Journal";
import BackgroundCat from "./BackgroundCat";

function App() {
  const [user, setUser] = useState(null);
  
  const handleLogin = (username) => {
    setUser(username);
  };
  
  const handleLogout = () => {
    setUser(null);
  };
  
  return (
    <div>
      {user ? (
        <Journal user={user} onLogout={handleLogout} />
      ) : (
        <Login onLogin={handleLogin} />
      )}
      <BackgroundCat />
    </div>
  );
}

export default App;