import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { trainService } from '../../services/trainService';
import './Booking.css';

const Booking = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, userType, user } = useAuth();
  
  const [train, setTrain] = useState(null);
  const [availability, setAvailability] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const trainData = location.state?.train;
    if (!trainData) {
      navigate('/search');
      return;
    }

    setTrain(trainData);
    fetchAvailability(trainData);
  }, [location, navigate, isAuthenticated, userType]);

  const getJourneyDate = () => {
    // Ensure we always have a valid journey date
    const journeyDate = location.state?.journey_date || new Date().toISOString().split('T')[0];
    console.log('📅 Using journey date:', journeyDate);
    return journeyDate;
  };

  const fetchAvailability = async (trainData) => {
    try {
      setLoading(true);
      setError('');

      const journeyDate = getJourneyDate();
      
      const availabilityData = {
        train_no: trainData.train_no,
        source_station: trainData.from_station_id,
        dest_station: trainData.to_station_id,
        journey_date: journeyDate
      };

      console.log('🚀 Fetching availability with:', availabilityData);

      let response;
      if (userType === 'employee') {
        response = await trainService.checkAvailabilityEmployee(availabilityData);
      } else {
        response = await trainService.checkAvailability(availabilityData);
      }

      if (response.success) {
        setAvailability(response.data);
      } else {
        setError('No availability data found for this train');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to check availability. Please try again.');
      console.error('Availability check error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClassSelect = (classItem) => {
    setSelectedClass(classItem);
  };

  const handleProceedToPassenger = () => {
    if (!selectedClass) {
      alert('Please select a class to continue');
      return;
    }
    
    const journeyDate = getJourneyDate();
    
    console.log('🚀 Navigating to passenger details with:', {
      journey_date: journeyDate,
      train: train.train_no,
      class: selectedClass.class_name,
      userType: userType
    });

    navigate('/passenger-details', { 
      state: { 
        train, 
        selectedClass,
        journey_date: journeyDate,
        source_station: location.state?.source_station || train.from_station_id,
        dest_station: location.state?.dest_station || train.to_station_id,
        userType: userType
      } 
    });
  };

  const getAvailabilityStatus = (availableBerths) => {
    if (availableBerths === 0) return 'Waiting List';
    if (availableBerths < 10) return 'Limited';
    return 'Available';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Available': return 'var(--success)';
      case 'Limited': return 'var(--warning)';
      case 'Waiting List': return 'var(--error)';
      default: return 'var(--text-light)';
    }
  };

  const formatDuration = (duration) => {
    if (duration.includes(':')) {
      return duration;
    }
    const hours = Math.floor(parseInt(duration) / 60);
    const minutes = parseInt(duration) % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  if (!train) {
    return (
      <div className="booking-container">
        <div className="container">
          <div className="error-state">
            <h2>No train selected</h2>
            <p>Please go back and select a train to book.</p>
            <button onClick={() => navigate('/search')} className="btn btn-primary">
              Back to Search
            </button>
          </div>
        </div>
      </div>
    );
  }

  const journeyDate = getJourneyDate();

  return (
    <div className="booking-container">
      <div className="container">
        <div className="booking-header">
          <h1>Book Your Journey</h1>
          <p>Select your preferred class and proceed to booking</p>
          {userType === 'employee' && (
            <div className="employee-badge">
              Employee Booking
            </div>
          )}
        </div>

        <div className="train-summary-card">
          <div className="train-basic-info">
            <div>
              <h3>{train.train_name}</h3>
              <span className="train-number">Train No: {train.train_no}</span>
            </div>
            <div className="journey-date">
              <strong>Journey Date:</strong> {journeyDate}
            </div>
          </div>
          
          <div className="route-info">
            <div className="station-info">
              <div className="station departure">
                <div className="time">{train.departure}</div>
                <div className="station-name">{train.from_station}</div>
                <div className="city">{train.from_city}</div>
                <div className="station-id">Station ID: {train.from_station_id}</div>
              </div>
              
              <div className="journey-details">
                <div className="duration">{formatDuration(train.duration)}</div>
                <div className="distance">{train.distance_km} km</div>
                {train.intermediate_stations && (
                  <div className="intermediate-stations">
                    <strong>Via:</strong> {train.intermediate_stations}
                  </div>
                )}
              </div>
              
              <div className="station arrival">
                <div className="time">{train.arrival}</div>
                <div className="station-name">{train.to_station}</div>
                <div className="city">{train.to_city}</div>
                <div className="station-id">Station ID: {train.to_station_id}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="class-selection-section">
          <div className="section-header">
            <h2>Select Travel Class</h2>
            <div className="single-passenger-note">
              <span>🎫 Single passenger booking only</span>
            </div>
          </div>

          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>Checking seat availability...</p>
            </div>
          ) : error ? (
            <div className="error-message">
              <h3>Unable to Load Availability</h3>
              <p>{error}</p>
              <button onClick={() => fetchAvailability(train)} className="btn btn-secondary">
                Try Again
              </button>
            </div>
          ) : availability && availability.length > 0 ? (
            <div className="classes-grid">
              {availability.map((classItem, index) => (
                <div 
                  key={index}
                  className={`class-card selectable ${
                    selectedClass?.class_id === classItem.class_id ? 'selected' : ''
                  }`}
                  onClick={() => handleClassSelect(classItem)}
                >
                  <div className="class-header">
                    <h4 className="class-name">{classItem.class_name}</h4>
                    <div 
                      className="availability-status"
                      style={{ 
                        color: getStatusColor(getAvailabilityStatus(classItem.available_berths)),
                        backgroundColor: getStatusColor(getAvailabilityStatus(classItem.available_berths)) + '20'
                      }}
                    >
                      {getAvailabilityStatus(classItem.available_berths)}
                    </div>
                  </div>

                  <div className="class-details">
                    <div className="fare-details">
                      <div className="fare">₹{classItem.fare}</div>
                      <div className="per-person">per person</div>
                    </div>
                    <div className="availability-details">
                      <span className="available-berths">
                        {classItem.available_berths} berths available
                      </span>
                    </div>
                  </div>

                  {userType === 'employee' && (
                    <div className="employee-details">
                      <h5>Booking Statistics</h5>
                      <div className="booking-stats">
                        <div className="stat-item">
                          <span className="stat-label">Confirmed:</span>
                          <span className="stat-value">{classItem.confirmed_bookings_today}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">RAC:</span>
                          <span className="stat-value">{classItem.rac_bookings_today}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">Waiting List:</span>
                          <span className="stat-value">{classItem.waiting_list_today}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="berth-breakdown">
                    <h5>Berth Availability</h5>
                    <div className="berth-grid">
                      <div className="berth-type">
                        <span>Lower:</span>
                        <span className="berth-count">{classItem.lower_berths}</span>
                      </div>
                      <div className="berth-type">
                        <span>Middle:</span>
                        <span className="berth-count">{classItem.middle_berths}</span>
                      </div>
                      <div className="berth-type">
                        <span>Upper:</span>
                        <span className="berth-count">{classItem.upper_berths}</span>
                      </div>
                      {classItem.side_lower_berths > 0 && (
                        <div className="berth-type">
                          <span>Side Lower:</span>
                          <span className="berth-count">{classItem.side_lower_berths}</span>
                        </div>
                      )}
                      {classItem.side_upper_berths > 0 && (
                        <div className="berth-type">
                          <span>Side Upper:</span>
                          <span className="berth-count">{classItem.side_upper_berths}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-availability">
              <h3>No Classes Available</h3>
              <p>There are no available classes for this train on the selected date.</p>
              <button onClick={() => navigate('/search')} className="btn btn-primary">
                Search Other Trains
              </button>
            </div>
          )}
        </div>

        {selectedClass && (
          <div className="selected-class-summary">
            <div className="summary-content">
              <div className="selected-class-info">
                <h4>Selected: {selectedClass.class_name}</h4>
                <div className="fare-summary">
                  <span className="fare">₹{selectedClass.fare}</span>
                  <span className="per-person">for 1 passenger</span>
                </div>
                {userType === 'employee' && (
                  <div className="employee-note">
                    <small>🎫 Employee Booking - Free Travel</small>
                  </div>
                )}
              </div>
              
              <button 
                onClick={handleProceedToPassenger}
                className="btn btn-primary proceed-btn"
              >
                {userType === 'employee' ? 'Book Free Ticket' : `Pay ₹${selectedClass.fare}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Booking;