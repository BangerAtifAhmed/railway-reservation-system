// src/pages/EmployeeDashboard/EmployeeDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { trainService } from '../../services/trainService';
import './EmployeeDashboard.css';

const EmployeeDashboard = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await trainService.getEmployeeProfile();
      
      if (response.success) {
        setProfile(response.data);
      } else {
        setError('Failed to load profile');
      }
    } catch (err) {
      setError('Failed to fetch profile details. Please try again.');
      console.error('Profile fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return 'Invalid Date';
    }
  };

  const formatSalary = (salary) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(salary);
  };

  const getDesignationText = (designation) => {
    const designations = {
      'station_master': 'Station Master',
      'ticket_checker': 'Ticket Checker',
      'train_operator': 'Train Operator',
      'admin_staff': 'Administrative Staff'
    };
    return designations[designation] || designation;
  };

  if (loading) {
    return (
      <div className="employee-dashboard-container">
        <div className="container">
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading your profile...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="employee-dashboard-container">
        <div className="container">
          <div className="error-state">
            <h2>Unable to Load Profile</h2>
            <p>{error}</p>
            <button onClick={fetchProfile} className="btn btn-primary">
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="employee-dashboard-container">
      <div className="container">
        <div className="dashboard-header">
          <h1>Employee Dashboard</h1>
          <p>Welcome back to your railway portal</p>
        </div>

        {profile && (
          <div className="dashboard-content">
            {/* Profile Card */}
            <div className="profile-card">
              <div className="profile-header">
                <div className="profile-avatar">
                  <span className="avatar-icon">👨‍💼</span>
                </div>
                <div className="profile-info">
                  <h2>{profile.emp_name}</h2>
                  <p className="employee-id">Employee ID: {profile.employee_id}</p>
                  <div className="designation-badge">
                    {getDesignationText(profile.designation)}
                  </div>
                </div>
              </div>

              <div className="profile-details">
                <div className="details-grid">
                  <div className="detail-item">
                    <span className="label">Email:</span>
                    <span className="value">{profile.email}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Phone:</span>
                    <span className="value">{profile.phone_no}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Hire Date:</span>
                    <span className="value">{formatDate(profile.hire_date)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Salary:</span>
                    <span className="value salary">{formatSalary(profile.salary)}</span>
                  </div>
                  {profile.supervisor_name && (
                    <div className="detail-item">
                      <span className="label">Supervisor:</span>
                      <span className="value">{profile.supervisor_name}</span>
                    </div>
                  )}
                  <div className="detail-item">
                    <span className="label">Dependents:</span>
                    <span className="value dependent-count">{profile.dependent_count}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="stats-section">
              <h3>Quick Statistics</h3>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon">👥</div>
                  <div className="stat-content">
                    <div className="stat-number">{profile.dependent_count}</div>
                    <div className="stat-label">Dependents</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">📅</div>
                  <div className="stat-content">
                    <div className="stat-number">
                      {new Date().getFullYear() - new Date(profile.hire_date).getFullYear()}
                    </div>
                    <div className="stat-label">Years of Service</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">🎫</div>
                  <div className="stat-content">
                    <div className="stat-number">Free</div>
                    <div className="stat-label">Travel Privileges</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Benefits Section */}
            <div className="benefits-section">
              <h3>Employee Benefits</h3>
              <div className="benefits-list">
                <div className="benefit-item">
                  <span className="benefit-icon">🎫</span>
                  <div className="benefit-content">
                    <h4>Free Railway Travel</h4>
                    <p>Unlimited free travel for you and your dependents</p>
                  </div>
                </div>
                <div className="benefit-item">
                  <span className="benefit-icon">👨‍👩‍👧‍👦</span>
                  <div className="benefit-content">
                    <h4>Dependent Privileges</h4>
                    <p>Up to 4 dependents can enjoy free travel benefits</p>
                  </div>
                </div>
                <div className="benefit-item">
                  <span className="benefit-icon">💰</span>
                  <div className="benefit-content">
                    <h4>Competitive Salary</h4>
                    <p>Attractive compensation package with regular increments</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeDashboard;