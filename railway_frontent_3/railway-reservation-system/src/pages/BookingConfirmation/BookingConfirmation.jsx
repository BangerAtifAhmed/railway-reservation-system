import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { trainService } from '../../services/trainService';
import './BookingConfirmation.css';

const BookingConfirmation = () => {
  const navigate = useNavigate();
  const { userType, user } = useAuth();
  
  const [latestBooking, setLatestBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchLatestBooking();
  }, []);

  const fetchLatestBooking = async () => {
    try {
      setLoading(true);
      setError('');

      let response;
      if (userType === 'employee') {
        response = await trainService.getBookingHistoryEmployee();
      } else {
        response = await trainService.getBookingHistory();
      }

      if (response.success && response.data.bookings && response.data.bookings.length > 0) {
        // Sort bookings by booking_time in descending order (newest first)
        const sortedBookings = response.data.bookings.sort((a, b) => {
          return new Date(b.booking_time) - new Date(a.booking_time);
        });
        
        // Get the most recent booking (first after sorting)
        const mostRecentBooking = sortedBookings[0];
        setLatestBooking(mostRecentBooking);
      } else {
        setError('No booking history found');
      }
    } catch (err) {
      setError('Failed to fetch booking details. Please try again.');
      console.error('Booking confirmation error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
        return 'var(--success)';
      case 'cancelled':
        return 'var(--error)';
      case 'waiting':
        return 'var(--warning)';
      default:
        return 'var(--text-light)';
    }
  };

  const getStatusText = (status) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
        return 'Confirmed';
      case 'cancelled':
        return 'Cancelled';
      case 'waiting':
        return 'Waiting List';
      default:
        return status || 'Unknown';
    }
  };

  const handleViewAllBookings = () => {
    navigate('/booking-history');
  };

  const handleBookAnother = () => {
    navigate('/search');
  };

  if (loading) {
    return (
      <div className="booking-confirmation-container">
        <div className="container">
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading booking confirmation...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="booking-confirmation-container">
        <div className="container">
          <div className="error-state">
            <h2>Unable to Load Booking</h2>
            <p>{error}</p>
            <div className="action-buttons">
              <button onClick={fetchLatestBooking} className="btn btn-secondary">
                Try Again
              </button>
              <button onClick={() => navigate('/search')} className="btn btn-primary">
                Book New Ticket
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!latestBooking) {
    return (
      <div className="booking-confirmation-container">
        <div className="container">
          <div className="no-booking-state">
            <h2>No Booking Found</h2>
            <p>You haven't made any bookings yet.</p>
            <button onClick={() => navigate('/search')} className="btn btn-primary">
              Book Your First Ticket
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="booking-confirmation-container">
      <div className="container">
        <div className="confirmation-header">
          <div className="success-icon">✅</div>
          <h1>Booking Confirmed!</h1>
          <p>Your ticket has been successfully booked</p>
          {userType === 'employee' && (
            <div className="employee-badge">
              Employee Booking - Free Travel
            </div>
          )}
        </div>

        <div className="confirmation-card">
          {/* PNR and Status Section */}
          <div className="pnr-section">
            <div className="pnr-info">
              <h3>PNR Number</h3>
              <div className="pnr-number">{latestBooking.pnr_no}</div>
              <div className="booking-time">
                Booked on {formatDate(latestBooking.booking_time)} at {formatTime(latestBooking.booking_time)}
              </div>
            </div>
            <div className="status-badge" style={{ backgroundColor: getStatusColor(latestBooking.status?.ticket_status) + '20', color: getStatusColor(latestBooking.status?.ticket_status) }}>
              {getStatusText(latestBooking.status?.ticket_status)}
            </div>
          </div>

          {/* Passenger Information */}
          <div className="passenger-section">
            <h3>Passenger Details</h3>
            <div className="passenger-info">
              <div className="info-row">
                <span className="label">Passenger Name:</span>
                <span className="value">{latestBooking.passenger_info?.passenger_name || latestBooking.passenger_name}</span>
              </div>
              {userType === 'employee' && latestBooking.is_dependent && (
                <div className="info-row">
                  <span className="label">Relationship:</span>
                  <span className="value">Dependent</span>
                </div>
              )}
            </div>
          </div>

          {/* Journey Information */}
          <div className="journey-section">
            <h3>Journey Details</h3>
            <div className="journey-info">
              <div className="info-row">
                <span className="label">Train Number:</span>
                <span className="value">{latestBooking.passenger_info?.train_no || latestBooking.train_no}</span>
              </div>
              <div className="info-row">
                <span className="label">Route:</span>
                <span className="value">{latestBooking.passenger_info?.route || `${latestBooking.journey?.from_station} → ${latestBooking.journey?.to_station}`}</span>
              </div>
              <div className="info-row">
                <span className="label">Journey Date:</span>
                <span className="value">{formatDate(latestBooking.passenger_info?.journey_date || latestBooking.journey?.journey_date)}</span>
              </div>
            </div>
          </div>

          {/* Travel Class and Fare */}
          <div className="travel-section">
            <h3>Travel Information</h3>
            <div className="travel-info">
              <div className="info-row">
                <span className="label">Class:</span>
                <span className="value">{latestBooking.travel_info?.class_name || latestBooking.seat_info?.class_name}</span>
              </div>
              {latestBooking.seat_info && (
                <>
                  <div className="info-row">
                    <span className="label">Coach:</span>
                    <span className="value">{latestBooking.seat_info.coach_no}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Berth:</span>
                    <span className="value">{latestBooking.seat_info.berth_no} ({latestBooking.seat_info.berth_id})</span>
                  </div>
                </>
              )}
              {userType !== 'employee' && (
                <div className="info-row">
                  <span className="label">Fare Paid:</span>
                  <span className="value fare-amount">₹{latestBooking.travel_info?.fare || latestBooking.financial?.fare}</span>
                </div>
              )}
              {userType !== 'employee' && (
                <div className="info-row">
                  <span className="label">Payment Mode:</span>
                  <span className="value">{latestBooking.travel_info?.payment_mode || 'UPI'}</span>
                </div>
              )}
            </div>
          </div>

          {/* Booking Details */}
          <div className="details-section">
            <h3>Booking Summary</h3>
            <div className="booking-details">
              {latestBooking.booking_details}
            </div>
          </div>

          {/* Status Details */}
          <div className="status-section">
            <h3>Current Status</h3>
            <div className="status-grid">
              <div className="status-item">
                <span className="status-label">Ticket Status:</span>
                <span className="status-value" style={{ color: getStatusColor(latestBooking.status?.ticket_status) }}>
                  {getStatusText(latestBooking.status?.ticket_status)}
                </span>
              </div>
              <div className="status-item">
                <span className="status-label">Allocation:</span>
                <span className="status-value" style={{ color: getStatusColor(latestBooking.status?.allocation_status) }}>
                  {getStatusText(latestBooking.status?.allocation_status)}
                </span>
              </div>
              {latestBooking.status?.payment_status && (
                <div className="status-item">
                  <span className="status-label">Payment:</span>
                  <span className="status-value" style={{ color: getStatusColor(latestBooking.status?.payment_status) }}>
                    {getStatusText(latestBooking.status?.payment_status)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="action-section">
          <div className="action-buttons">
            <button onClick={handleBookAnother} className="btn btn-primary">
              Book Another Ticket
            </button>
            <button onClick={handleViewAllBookings} className="btn btn-secondary">
              View All Bookings
            </button>
            <button onClick={() => window.print()} className="btn btn-outline">
              Print Ticket
            </button>
          </div>
          
          <div className="confirmation-note">
            <p>📧 A confirmation has been sent to your registered email address</p>
            <p>📱 You can view all your bookings in the Booking History section</p>
            {userType === 'employee' && (
              <p>🎫 This is a free travel booking under employee privileges</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingConfirmation;