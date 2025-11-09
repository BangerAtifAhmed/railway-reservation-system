import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { trainService } from '../../services/trainService';
import './BookingHistory.css';

const BookingHistory = () => {
  const navigate = useNavigate();
  const { userType, user } = useAuth();
  const ticketRefs = useRef({});
  
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [printingTicket, setPrintingTicket] = useState(null);
  const [cancellingTicket, setCancellingTicket] = useState(null);
  const [cancellationMessage, setCancellationMessage] = useState('');

  useEffect(() => {
    fetchBookingHistory();
  }, []);

  const fetchBookingHistory = async () => {
    try {
      setLoading(true);
      setError('');

      let response;
      if (userType === 'employee') {
        response = await trainService.getBookingHistoryEmployee();
      } else {
        response = await trainService.getBookingHistory();
      }

      console.log('API Response:', response); // Debug log

      if (response.success && response.data.bookings && response.data.bookings.length > 0) {
        const sortedBookings = response.data.bookings.sort((a, b) => {
          return new Date(b.booking_time) - new Date(a.booking_time);
        });
        setBookings(sortedBookings);
      } else {
        setBookings([]);
      }
    } catch (err) {
      console.error('Booking history error:', err);
      setError('Failed to fetch booking history. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Cancel Ticket Function
  const cancelTicket = async (booking) => {
    const pnrNo = booking.pnr_no;
    if (!pnrNo) {
      setError('PNR number not found for this booking');
      return;
    }

    if (!window.confirm('Are you sure you want to cancel this ticket? This action cannot be undone.')) {
      return;
    }

    try {
      setCancellingTicket(pnrNo);
      setError('');
      setCancellationMessage('');

      let response;
      if (userType === 'employee') {
        response = await trainService.cancelEmployeeTicket(pnrNo);
      } else {
        response = await trainService.cancelUserTicket(pnrNo);
      }

      if (response.success) {
        setCancellationMessage(response.message);
        // Refresh the booking history to show updated status
        await fetchBookingHistory();
        
        // Show success message for 5 seconds
        setTimeout(() => {
          setCancellationMessage('');
        }, 5000);
      } else {
        setError(response.message || 'Failed to cancel ticket');
      }
    } catch (err) {
      console.error('Ticket cancellation error:', err);
      setError('Failed to cancel ticket. Please try again.');
    } finally {
      setCancellingTicket(null);
    }
  };

  // Print Ticket Function
  const printTicket = (bookingId) => {
    const ticketElement = ticketRefs.current[bookingId];
    if (!ticketElement) return;

    setPrintingTicket(bookingId);
    
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    const printContent = ticketElement.innerHTML;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Railway Ticket</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
              color: #333;
            }
            .print-ticket {
              border: 2px solid #000;
              padding: 20px;
              max-width: 700px;
              margin: 0 auto;
              background: white;
            }
            .ticket-header {
              text-align: center;
              border-bottom: 2px solid #000;
              padding-bottom: 15px;
              margin-bottom: 20px;
            }
            .ticket-header h1 {
              color: #2c5aa0;
              margin: 0;
              font-size: 24px;
            }
            .ticket-section {
              margin-bottom: 20px;
              padding-bottom: 15px;
              border-bottom: 1px dashed #ccc;
            }
            .ticket-section h3 {
              color: #2c5aa0;
              margin-bottom: 10px;
              font-size: 16px;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 15px;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 8px;
            }
            .label {
              font-weight: bold;
              color: #555;
            }
            .value {
              color: #000;
            }
            .pnr-display {
              background: #f0f8ff;
              padding: 15px;
              text-align: center;
              border: 1px dashed #2c5aa0;
              margin: 15px 0;
            }
            .pnr-number {
              font-size: 24px;
              font-weight: bold;
              color: #2c5aa0;
            }
            .status-badge {
              display: inline-block;
              padding: 5px 10px;
              background: #28a745;
              color: white;
              border-radius: 4px;
              font-weight: bold;
            }
            .cancelled {
              background: #dc3545;
            }
            .waiting {
              background: #ffc107;
              color: #000;
            }
            .fare-amount {
              font-size: 20px;
              font-weight: bold;
              color: #28a745;
            }
            .instructions {
              background: #fff3cd;
              padding: 15px;
              border: 1px solid #ffeaa7;
              margin-top: 20px;
              font-size: 12px;
            }
            @media print {
              body { margin: 0; }
              .print-ticket { border: none; padding: 10px; }
            }
          </style>
        </head>
        <body>
          <div class="print-ticket">
            ${printContent}
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(() => window.close(), 500);
            };
          </script>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    setTimeout(() => setPrintingTicket(null), 2000);
  };

  const getBookingStatus = (booking) => {
    if (userType === 'employee') {
      const bookingStatus = booking.status?.booking_status?.toLowerCase();
      const ticketStatus = booking.status?.ticket_status?.toLowerCase();
      
      if (bookingStatus === 'cancelled' || ticketStatus === 'cancelled') {
        return 'cancelled';
      }
      return 'confirmed';
    } else {
      const ticketStatus = booking.status?.ticket_status?.toLowerCase();
      const bookingAction = booking.booking_action?.toLowerCase();
      
      if (ticketStatus === 'cancelled' || bookingAction === 'cancelled') {
        return 'cancelled';
      }
      if (ticketStatus === 'waiting' || ticketStatus === 'waiting list') {
        return 'waiting';
      }
      return 'confirmed';
    }
  };

  const canCancelTicket = (booking) => {
    const status = getBookingStatus(booking);
    // Can only cancel confirmed tickets (not already cancelled or waiting list)
    return status === 'confirmed';
  };

  const getStats = () => {
    const total = bookings.length;
    const confirmed = bookings.filter(booking => 
      getBookingStatus(booking) === 'confirmed'
    ).length;
    const cancelled = bookings.filter(booking => 
      getBookingStatus(booking) === 'cancelled'
    ).length;
    const waiting = bookings.filter(booking => 
      getBookingStatus(booking) === 'waiting'
    ).length;

    return { total, confirmed, cancelled, waiting };
  };

  const filteredBookings = bookings.filter(booking => {
    if (filter === 'all') return true;
    return getBookingStatus(booking) === filter;
  });

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return 'Invalid Date';
    }
  };

  const formatTime = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Invalid Time';
    }
  };

  const formatJourneyDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return 'Invalid Date';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed': return '#28a745';
      case 'cancelled': return '#dc3545';
      case 'waiting': return '#ffc107';
      default: return '#6c757d';
    }
  };

  const getStatusText = (booking) => {
    const status = getBookingStatus(booking);
    switch (status) {
      case 'confirmed': return 'Confirmed';
      case 'cancelled': return 'Cancelled';
      case 'waiting': return 'Waiting List';
      default: return 'Unknown';
    }
  };

  const stats = getStats();

  if (loading) {
    return (
      <div className="booking-history-container">
        <div className="container">
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading your booking history...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="booking-history-container">
        <div className="container">
          <div className="error-state">
            <h2>Unable to Load History</h2>
            <p>{error}</p>
            <div className="action-buttons">
              <button onClick={fetchBookingHistory} className="btn btn-secondary">
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

  return (
    <div className="booking-history-container">
      <div className="container">
        <div className="booking-history-header">
          <div className="header-content">
            <h1>Booking History</h1>
            <p>View all your past and current bookings</p>
            {userType === 'employee' && (
              <div className="employee-badge">
                Employee Booking History
              </div>
            )}
          </div>
          <button onClick={() => navigate('/search')} className="btn btn-primary">
            Book New Ticket
          </button>
        </div>

        {/* Success Message */}
        {cancellationMessage && (
          <div className="success-message">
            <p>✅ {cancellationMessage}</p>
          </div>
        )}

        {/* Statistics Cards */}
        {bookings.length > 0 && (
          <div className="stats-section">
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-number">{stats.total}</div>
                <div className="stat-label">Total Bookings</div>
              </div>
              <div className="stat-card confirmed">
                <div className="stat-number">{stats.confirmed}</div>
                <div className="stat-label">Confirmed</div>
              </div>
              <div className="stat-card cancelled">
                <div className="stat-number">{stats.cancelled}</div>
                <div className="stat-label">Cancelled</div>
              </div>
              <div className="stat-card waiting">
                <div className="stat-number">{stats.waiting}</div>
                <div className="stat-label">Waiting List</div>
              </div>
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        {bookings.length > 0 && (
          <div className="filter-section">
            <div className="filter-tabs">
              <button 
                className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                All Bookings ({bookings.length})
              </button>
              <button 
                className={`filter-tab ${filter === 'confirmed' ? 'active' : ''}`}
                onClick={() => setFilter('confirmed')}
              >
                Confirmed ({stats.confirmed})
              </button>
              <button 
                className={`filter-tab ${filter === 'cancelled' ? 'active' : ''}`}
                onClick={() => setFilter('cancelled')}
              >
                Cancelled ({stats.cancelled})
              </button>
              <button 
                className={`filter-tab ${filter === 'waiting' ? 'active' : ''}`}
                onClick={() => setFilter('waiting')}
              >
                Waiting List ({stats.waiting})
              </button>
            </div>
          </div>
        )}

        {/* Bookings List */}
        <div className="bookings-section">
          {bookings.length === 0 ? (
            <div className="no-bookings-state">
              <div className="no-bookings-icon">📝</div>
              <h2>No Bookings Found</h2>
              <p>You haven't made any bookings yet. Start your journey by booking your first ticket!</p>
              <button onClick={() => navigate('/search')} className="btn btn-primary">
                Book Your First Ticket
              </button>
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="no-filtered-bookings">
              <h3>No bookings match your filter</h3>
              <p>Try selecting a different filter to see your bookings.</p>
            </div>
          ) : (
            <div className="bookings-list">
              {filteredBookings.map((booking, index) => {
                const bookingId = booking.booking_id || booking.history_id || index;
                const isConfirmed = getBookingStatus(booking) === 'confirmed';
                const statusColor = getStatusColor(getBookingStatus(booking));
                const canCancel = canCancelTicket(booking);
                
                return (
                  <div key={bookingId} className="booking-card">
                    {/* Hidden ticket content for printing */}
                    <div 
                      ref={el => ticketRefs.current[bookingId] = el}
                      className="ticket-print-content"
                      style={{ display: 'none' }}
                    >
                      <div className="ticket-header">
                        <h1>Indian Railways</h1>
                        <div>E-Ticket</div>
                      </div>
                      
                      <div className="pnr-display">
                        <div>PNR Number</div>
                        <div className="pnr-number">{booking.pnr_no}</div>
                      </div>

                      <div className="ticket-section">
                        <h3>Passenger Details</h3>
                        <div className="info-grid">
                          <div className="info-row">
                            <span className="label">Name:</span>
                            <span className="value">{booking.passenger_info?.passenger_name || booking.passenger_name}</span>
                          </div>
                        </div>
                      </div>

                      <div className="ticket-section">
                        <h3>Journey Details</h3>
                        <div className="info-grid">
                          <div className="info-row">
                            <span className="label">Train No:</span>
                            <span className="value">{booking.passenger_info?.train_no || booking.train_no}</span>
                          </div>
                          <div className="info-row">
                            <span className="label">Class:</span>
                            <span className="value">{booking.travel_info?.class_name || booking.seat_info?.class_name}</span>
                          </div>
                          <div className="info-row">
                            <span className="label">Route:</span>
                            <span className="value">{booking.passenger_info?.route || `${booking.journey?.from_station} → ${booking.journey?.to_station}`}</span>
                          </div>
                          <div className="info-row">
                            <span className="label">Journey Date:</span>
                            <span className="value">{formatJourneyDate(booking.passenger_info?.journey_date || booking.journey?.journey_date)}</span>
                          </div>
                        </div>
                      </div>

                      {booking.seat_info && (
                        <div className="ticket-section">
                          <h3>Seat Allocation</h3>
                          <div className="info-grid">
                            <div className="info-row">
                              <span className="label">Coach:</span>
                              <span className="value">{booking.seat_info.coach_no}</span>
                            </div>
                            <div className="info-row">
                              <span className="label">Berth:</span>
                              <span className="value">{booking.seat_info.berth_no}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="ticket-section">
                        <h3>Booking Information</h3>
                        <div className="info-grid">
                          <div className="info-row">
                            <span className="label">Status:</span>
                            <span className={`status-badge ${getBookingStatus(booking) === 'cancelled' ? 'cancelled' : getBookingStatus(booking) === 'waiting' ? 'waiting' : ''}`}>
                              {getStatusText(booking)}
                            </span>
                          </div>
                          <div className="info-row">
                            <span className="label">Booked On:</span>
                            <span className="value">{formatDate(booking.booking_time)}</span>
                          </div>
                          {userType !== 'employee' && (
                            <div className="info-row">
                              <span className="label">Fare:</span>
                              <span className="value fare-amount">₹{booking.travel_info?.fare || booking.financial?.fare}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="instructions">
                        <strong>Instructions:</strong><br/>
                        • Please carry a valid ID proof<br/>
                        • Arrive at station 30 minutes before departure<br/>
                        • This is an e-ticket, no printout required
                      </div>
                    </div>

                    {/* Visible booking card */}
                    <div className="booking-header">
                      <div className="booking-main-info">
                        <div className="pnr-section">
                          <span className="pnr-label">PNR</span>
                          <span className="pnr-number">{booking.pnr_no}</span>
                        </div>
                        <div 
                          className="booking-action"
                          style={{ color: statusColor }}
                        >
                          {booking.booking_action?.toUpperCase() || 'BOOKED'}
                        </div>
                      </div>
                      <div className="booking-time">
                        {formatDate(booking.booking_time)} at {formatTime(booking.booking_time)}
                      </div>
                    </div>

                    <div className="booking-details">
                      <div className="passenger-journey">
                        <div className="passenger-info">
                          <h4>{booking.passenger_info?.passenger_name || booking.passenger_name}</h4>
                          {userType === 'employee' && booking.is_dependent && (
                            <span className="dependent-badge">Dependent</span>
                          )}
                        </div>
                        <div className="journey-info">
                          <div className="route">
                            {booking.passenger_info?.route || `${booking.journey?.from_station} → ${booking.journey?.to_station}`}
                          </div>
                          <div className="train-number">
                            Train: {booking.passenger_info?.train_no || booking.train_no}
                          </div>
                        </div>
                      </div>

                      <div className="booking-meta">
                        <div className="journey-date">
                          <strong>Journey:</strong> {formatJourneyDate(booking.passenger_info?.journey_date || booking.journey?.journey_date)}
                        </div>
                        <div className="class-info">
                          <strong>Class:</strong> {booking.travel_info?.class_name || booking.seat_info?.class_name}
                        </div>
                        {booking.seat_info && (
                          <div className="seat-info">
                            <strong>Seat:</strong> Coach {booking.seat_info.coach_no}, Berth {booking.seat_info.berth_no}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="booking-footer">
                      <div className="status-section">
                        <div 
                          className="status-badge"
                          style={{ 
                            backgroundColor: statusColor + '20', 
                            color: statusColor 
                          }}
                        >
                          {getStatusText(booking)}
                        </div>
                      </div>

                      <div className="fare-actions">
                        <div className="fare-section">
                          {userType !== 'employee' ? (
                            <div className="fare-amount">
                              ₹{booking.travel_info?.fare || booking.financial?.fare}
                            </div>
                          ) : (
                            <div className="employee-fare">
                              Free Travel
                            </div>
                          )}
                        </div>
                        
                        <div className="ticket-actions">
                          {canCancel && (
                            <button 
                              onClick={() => cancelTicket(booking)}
                              disabled={cancellingTicket === booking.pnr_no}
                              className="btn btn-danger btn-sm cancel-btn"
                            >
                              {cancellingTicket === booking.pnr_no ? '⏳ Cancelling...' : '❌ Cancel Ticket'}
                            </button>
                          )}
                          {isConfirmed && (
                            <button 
                              onClick={() => printTicket(bookingId)}
                              disabled={printingTicket === bookingId}
                              className="btn btn-outline btn-sm print-btn"
                            >
                              {printingTicket === bookingId ? '🖨️ Printing...' : '🖨️ Print Ticket'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {booking.booking_details && (
                      <div className="booking-description">
                        {booking.booking_details}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Refresh Button */}
        {bookings.length > 0 && (
          <div className="refresh-section">
            <button onClick={fetchBookingHistory} className="btn btn-outline">
              ↻ Refresh History
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingHistory;