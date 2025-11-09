import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { trainService } from '../../services/trainService';
import './Navbar.css';

const Navbar = () => {
  const { user, isAuthenticated, logout, userType } = useAuth();
  const [quotaInfo, setQuotaInfo] = useState(null);
  const [showQuota, setShowQuota] = useState(false);

  useEffect(() => {
    if (isAuthenticated && userType === 'employee') {
      fetchQuotaInfo();
    }
  }, [isAuthenticated, userType]);

  const fetchQuotaInfo = async () => {
    try {
      const response = await trainService.getEmployeeQuotaInfo();
      if (response.success) {
        setQuotaInfo(response.data);
      }
    } catch (error) {
      console.error('Error fetching quota info:', error);
    }
  };

  const handleLogout = () => {
    logout();
  };

  const toggleQuotaDisplay = () => {
    setShowQuota(!showQuota);
  };

  const getQuotaPercentage = () => {
    if (!quotaInfo) return 0;
    return (quotaInfo.quota_used / quotaInfo.max_quota) * 100;
  };

  const getQuotaColor = () => {
    const percentage = getQuotaPercentage();
    if (percentage >= 90) return '#dc3545'; // Red
    if (percentage >= 75) return '#ffc107'; // Yellow
    return '#28a745'; // Green
  };

  return (
    <nav className="navbar">
      <div className="nav-container">
        <div className="nav-logo">
          <span className="logo-icon">🚆</span>
          <Link to="/" className="logo-text">RailExpress</Link>
        </div>
        
        <div className="nav-menu">
          <Link to="/" className="nav-link">Home</Link>
          <Link to="/search" className="nav-link">Book Tickets</Link>
          {isAuthenticated && (
            <Link to="/booking-history" className="nav-link">My Bookings</Link>
          )}
          <Link to="/pnr-ticket" className="nav-link">Check PNR Status</Link>
          <Link to="/train-routes" className="nav-link">🚂 Train Routes</Link>
          
          {isAuthenticated && userType === 'employee' && (
            <>
              <Link to="/employee/dashboard" className="nav-link">Dashboard</Link>
              <Link to="/employee/dependents" className="nav-link">My Dependents</Link>
            </>
          )}
        </div>
        
        <div className="nav-actions">
          {isAuthenticated ? (
            <div className="user-menu">
              <span className="user-greeting">
                Hello, {user?.name || user?.emp_name || 'User'}
                {userType === 'employee' && (
                  <span className="user-badge"> (Employee)</span>
                )}
              </span>
              
              {/* Employee Quota Info - Moved to separate container */}
              {userType === 'employee' && quotaInfo && (
                <div className="quota-info-container">
                  <button 
                    className="quota-toggle-btn"
                    onClick={toggleQuotaDisplay}
                    title="Click to view quota details"
                  >
                    <div className="quota-badge">
                      <span className="quota-text">
                        {quotaInfo.quota_remaining}/{quotaInfo.max_quota}
                      </span>
                      <span className="quota-label">Tickets</span>
                    </div>
                  </button>
                  
                  {showQuota && (
                    <div className="quota-details-dropdown">
                      <div className="quota-header">
                        <h4>Monthly Ticket Quota</h4>
                        <button 
                          className="close-quota"
                          onClick={() => setShowQuota(false)}
                        >
                          ×
                        </button>
                      </div>
                      
                      <div className="quota-progress">
                        <div className="progress-bar">
                          <div 
                            className="progress-fill"
                            style={{
                              width: `${getQuotaPercentage()}%`,
                              backgroundColor: getQuotaColor()
                            }}
                          ></div>
                        </div>
                        <div className="progress-text">
                          {quotaInfo.quota_used} used • {quotaInfo.quota_remaining} remaining
                        </div>
                      </div>
                      
                      <div className="quota-stats">
                        <div className="quota-stat">
                          <span className="stat-label">Used:</span>
                          <span className="stat-value used">{quotaInfo.quota_used}</span>
                        </div>
                        <div className="quota-stat">
                          <span className="stat-label">Remaining:</span>
                          <span className="stat-value remaining">{quotaInfo.quota_remaining}</span>
                        </div>
                        <div className="quota-stat">
                          <span className="stat-label">Total:</span>
                          <span className="stat-value total">{quotaInfo.max_quota}</span>
                        </div>
                      </div>
                      
                      <div className="quota-reset-info">
                        <span className="reset-label">Resets on:</span>
                        <span className="reset-date">
                          {new Date(quotaInfo.reset_date).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                      
                      <div className="quota-actions">
                        <button 
                          className="btn-refresh"
                          onClick={fetchQuotaInfo}
                        >
                          ↻ Refresh
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              <button className="nav-btn logout-btn" onClick={handleLogout}>
                Logout
              </button>
            </div>
          ) : (
            <>
              <Link to="/login" className="nav-btn login-btn">
                Login
              </Link>
              <Link to="/register" className="nav-btn signup-btn">
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;