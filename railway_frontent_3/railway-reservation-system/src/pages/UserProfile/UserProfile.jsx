// src/pages/UserProfile/UserProfile.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { trainService } from '../../services/trainService';
import './UserProfile.css';

const UserProfile = () => {
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

      const response = await trainService.getUserProfile();
      
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
      return 'Not specified';
    }
  };

  const calculateAge = (dob) => {
    try {
      const birthDate = new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    } catch {
      return profile?.age || 'Not specified';
    }
  };

  if (loading) {
    return (
      <div className="user-profile-container">
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
      <div className="user-profile-container">
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
    <div className="user-profile-container">
      <div className="container">
        <div className="profile-header">
          <h1>My Profile</h1>
          <p>Manage your personal information and preferences</p>
        </div>

        {profile && (
          <div className="profile-content">
            {/* Profile Card */}
            <div className="profile-card">
              <div className="profile-header-section">
                <div className="profile-avatar">
                  <span className="avatar-icon">👤</span>
                </div>
                <div className="profile-info">
                  <h2>{profile.name}</h2>
                  <p className="username">@{profile.user_name}</p>
                  <div className="user-id">User ID: {profile.user_id}</div>
                </div>
              </div>

              <div className="profile-details">
                <div className="details-grid">
                  <div className="detail-section">
                    <h3>Personal Information</h3>
                    <div className="detail-item">
                      <span className="label">Email:</span>
                      <span className="value">{profile.email}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Mobile:</span>
                      <span className="value">{profile.mobile_no}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Date of Birth:</span>
                      <span className="value">{formatDate(profile.dob)}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Age:</span>
                      <span className="value">{calculateAge(profile.dob)} years</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Gender:</span>
                      <span className="value capitalize">{profile.gender}</span>
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Address Information</h3>
                    <div className="detail-item">
                      <span className="label">Address:</span>
                      <span className="value">{profile.address}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">City:</span>
                      <span className="value">{profile.city}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">State:</span>
                      <span className="value">{profile.state}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">PIN Code:</span>
                      <span className="value">{profile.pin_code}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Account Stats */}
            <div className="stats-section">
              <h3>Account Overview</h3>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon">🎫</div>
                  <div className="stat-content">
                    <div className="stat-number">All</div>
                    <div className="stat-label">Booking Access</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">💰</div>
                  <div className="stat-content">
                    <div className="stat-number">UPI/Card</div>
                    <div className="stat-label">Payment Methods</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">🔒</div>
                  <div className="stat-content">
                    <div className="stat-number">Secure</div>
                    <div className="stat-label">Account Protected</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="actions-section">
              <h3>Quick Actions</h3>
              <div className="actions-grid">
                <button className="action-btn">
                  <span className="action-icon">✏️</span>
                  <span className="action-text">Edit Profile</span>
                </button>
                <button className="action-btn">
                  <span className="action-icon">🔐</span>
                  <span className="action-text">Change Password</span>
                </button>
                <button className="action-btn">
                  <span className="action-icon">📧</span>
                  <span className="action-text">Email Preferences</span>
                </button>
                <button className="action-btn">
                  <span className="action-icon">📱</span>
                  <span className="action-text">App Settings</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfile;