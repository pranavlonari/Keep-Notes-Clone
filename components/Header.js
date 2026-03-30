import React from "react";
import WbIridescentIcon from "@material-ui/icons/WbIridescent";
function Header({ userEmail, onLogout }) {
  return (
    <header>
      <h1>
        <WbIridescentIcon />
        Keep Notes Clone
      </h1>
      {userEmail ? (
        <div className="header-user">
          <span>{userEmail}</span>
          <button type="button" onClick={onLogout}>
            Logout
          </button>
        </div>
      ) : null}
    </header>
  );
}

export default Header;
