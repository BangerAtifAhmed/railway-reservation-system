// src/pages/EmployeeDependents/EmployeeDependents.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { trainService } from '../../services/trainService';
import './EmployeeDependents.css';

const EmployeeDependents = () => {
  const { user } = useAuth();
  const [dependents, setDependents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDependents();
  }, []);

  const fetchDependents = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await trainService.getEmployeeDependents();
      
      if (response.success) {
        setDependents(response.data);
      } else {
        setError('Failed to load dependents list');
      }
    } catch (err) {
      setError('Failed to fetch dependents. Please try again.');
      console.error('Dependents fetch error:', err);
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
      return 'Unknown';
    }
  };

  const getRelationText = (relation) => {
    const relations = {
      'spouse': 'Spouse',
      'child': 'Child',
      'parent': 'Parent',
      'sibling': 'Sibling'
    };
    return relations[relation] || relation;
  };

  const getGenderIcon = (gender) => {
    return gender === 'female' ? '👩' : '👨';
  };

  if (loading) {
    return (
      <div className="employee-dependents-container">
        <div className="container">
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading your dependents...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="employee-dependents-container">
        <div className="container">
          <div className="error-state">
            <h2>Unable to Load Dependents</h2>
            <p>{error}</p>
            <button onClick={fetchDependents} className="btn btn-primary">
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="employee-dependents-container">
      <div className="container">
        <div className="dependents-header">
          <h1>My Dependents</h1>
          <p>Manage your dependent family members for travel benefits</p>
        </div>

        <div className="dependents-content">
          {/* Summary Card */}
          <div className="summary-card">
            <div className="summary-content">
              <div className="summary-item">
                <div className="summary-number">{dependents.length}</div>
                <div className="summary-label">Total Dependents</div>
              </div>
              <div className="summary-item">
                <div className="summary-number">
                  {dependents.filter(d => d.relation === 'child').length}
                </div>
                <div className="summary-label">Children</div>
              </div>
              <div className="summary-item">
                <div className="summary-number">
                  {dependents.filter(d => d.relation === 'spouse').length}
                </div>
                <div className="summary-label">Spouse</div>
              </div>
            </div>
          </div>

          {/* Dependents List */}
          <div className="dependents-section">
            <h2>Dependent Family Members</h2>
            
            {dependents.length === 0 ? (
              <div className="no-dependents">
                <div className="no-dependents-icon">👨‍👩‍👧‍👦</div>
                <h3>No Dependents Added</h3>
                <p>You haven't added any dependents yet. Add family members to enjoy travel benefits.</p>
              </div>
            ) : (
              <div className="dependents-grid">
                {dependents.map((dependent) => (
                  <div key={dependent.dependent_id} className="dependent-card">
                    <div className="dependent-header">
                      <div className="dependent-avatar">
                        <span className="avatar-icon">{getGenderIcon(dependent.gender)}</span>
                      </div>
                      <div className="dependent-info">
                        <h3>{dependent.f_name} {dependent.l_name}</h3>
                        <div className="dependent-relation">
                          {getRelationText(dependent.relation)}
                        </div>
                      </div>
                    </div>

                    <div className="dependent-details">
                      <div className="detail-row">
                        <span className="label">Dependent ID:</span>
                        <span className="value">{dependent.dependent_id}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Date of Birth:</span>
                        <span className="value">{formatDate(dependent.dob)}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Age:</span>
                        <span className="value">{calculateAge(dependent.dob)} years</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Gender:</span>
                        <span className="value capitalize">{dependent.gender}</span>
                      </div>
                    </div>

                    <div className="dependent-status">
                      <span className="status-badge active">Active</span>
                      <span className="travel-benefit">🎫 Free Travel Eligible</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Benefits Info */}
          <div className="benefits-info">
            <h3>Dependent Travel Benefits</h3>
            <div className="benefits-content">
              <div className="benefit-point">
                <span className="benefit-icon">✅</span>
                <span>All dependents enjoy free railway travel</span>
              </div>
              <div className="benefit-point">
                <span className="benefit-icon">✅</span>
                <span>Maximum 4 dependents allowed per employee</span>
              </div>
              <div className="benefit-point">
                <span className="benefit-icon">✅</span>
                <span>No booking fees for dependent tickets</span>
              </div>
              <div className="benefit-point">
                <span className="benefit-icon">✅</span>
                <span>Same travel privileges as employee</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeDependents;