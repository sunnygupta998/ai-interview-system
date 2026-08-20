import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { FiLogOut, FiUser, FiSettings, FiFileText, FiAward, FiPieChart, FiSun, FiMoon } from 'react-icons/fi';
import './Navbar.css';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const closeMenu = () => setIsMobileMenuOpen(false);

  if (!user) return null;

  return (
    <nav className="navbar" style={{ position: 'sticky', top: 0, zIndex: 1000 }}>
      <div className="navbar-container">
        <Link to="/" className="navbar-logo" onClick={closeMenu}>
          <span>AI</span> Interview
        </Link>
        
        <button className="mobile-menu-toggle" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? '✕' : '☰'}
        </button>

        <div className={`navbar-links ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
          {user.role === 'candidate' ? (
            <>
              <NavLink to="/candidate/dashboard" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} onClick={closeMenu}>
                <FiPieChart /> Dashboard
              </NavLink>
              <NavLink to="/candidate/upload" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} onClick={closeMenu}>
                <FiFileText /> Upload Resume
              </NavLink>
            </>
          ) : (
            <>
              <NavLink to="/admin/dashboard" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} onClick={closeMenu}>
                <FiPieChart /> Dashboard
              </NavLink>
              <NavLink to="/admin/results" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} onClick={closeMenu}>
                <FiAward /> Results
              </NavLink>
              <NavLink to="/admin/settings" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} onClick={closeMenu}>
                <FiSettings /> Settings
              </NavLink>
            </>
          )}
        </div>

        <div className="navbar-profile">
          <button onClick={toggleTheme} className="btn-theme-toggle" title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
            {theme === 'dark' ? <FiSun /> : <FiMoon />}
          </button>
          <div className="profile-info">
            <FiUser className="avatar-icon" />
            <div className="profile-details">
              <span className="profile-name">{user.name}</span>
              <span className="profile-role badge badge-info">{user.role}</span>
            </div>
          </div>
          <button onClick={handleLogout} className="btn-logout" title="Logout">
            <FiLogOut />
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
