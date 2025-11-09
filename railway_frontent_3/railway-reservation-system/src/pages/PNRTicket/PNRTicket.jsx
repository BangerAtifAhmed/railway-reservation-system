import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { trainService } from '../../services/trainService';
import './PNRTicket.css';

const PNRTicket = () => {
  const { userType } = useAuth();
  const [pnr, setPnr] = useState('');
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [printing, setPrinting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancellationMessage, setCancellationMessage] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!pnr.trim()) {
      setError('Please enter a PNR number');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setTicket(null);
      setCancellationMessage('');

      let response;
      if (userType === 'employee') {
        response = await trainService.getTicketByPNREmployee(pnr.trim());
      } else {
        response = await trainService.getTicketByPNR(pnr.trim());
      }

      console.log('PNR API Response:', response); // Debug log

      if (response.success) {
        setTicket(response.data);
      } else {
        setError(response.message || 'Ticket not found');
      }
    } catch (err) {
      console.error('PNR search error:', err);
      setError('Failed to fetch ticket details. Please check the PNR number.');
    } finally {
      setLoading(false);
    }
  };

  // Cancel Ticket Function
  const cancelTicket = async () => {
    if (!ticket || !ticket.pnr_no) {
      setError('No ticket found to cancel');
      return;
    }

    if (!window.confirm('Are you sure you want to cancel this ticket? This action cannot be undone.')) {
      return;
    }

    try {
      setCancelling(true);
      setError('');
      setCancellationMessage('');

      let response;
      if (userType === 'employee') {
        response = await trainService.cancelEmployeeTicket(ticket.pnr_no);
      } else {
        response = await trainService.cancelUserTicket(ticket.pnr_no);
      }

      if (response.success) {
        setCancellationMessage(response.message);
        // Refresh ticket data
        await handleSearch({ preventDefault: () => {} });
        
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
      setCancelling(false);
    }
  };

  // Helper function to normalize data for both user and employee responses
  const getTicketData = () => {
    if (!ticket) return null;

    if (userType === 'employee') {
      // Normalize employee response
      const statusText = ticket.status === 'cancelled' ? '❌ CANCELLED' : 
                        ticket.status === 'confirmed' ? '✅ CONFIRMED' : 
                        '🟡 UNKNOWN';
      
      const statusDescription = ticket.status === 'cancelled' ? 
        `Ticket was cancelled on ${formatDate(ticket.cancellation_time)}. Refund: ₹${ticket.refund_amount}` :
        'Ticket is confirmed and ready for travel';

      return {
        pnr_no: ticket.pnr_no,
        passenger_name: ticket.passenger_name,
        train_no: ticket.train_no,
        journey: {
          from_station: ticket.from_station_name,
          to_station: ticket.to_station_name,
          journey_date: ticket.date_time,
          class: {
            class_name: ticket.class_name
          }
        },
        status: {
          overall: statusText,
          description: statusDescription,
          ticket_status: ticket.status,
          allocation_status: ticket.allocation_status,
          payment_status: 'success'
        },
        seat_allocation: ticket.berth_no ? {
          coach_no: ticket.coach_no,
          berth_no: ticket.berth_no,
          berth_type: ticket.seat_type,
          berth_id: ticket.berth_id
        } : null,
        payment: {
          amount: ticket.fare,
          payment_mode: 'free_travel',
          payment_status: 'success'
        },
        timeline: {
          booking_time: ticket.booking_time,
          cancellation_time: ticket.cancellation_time
        },
        financial: {
          fare_paid: ticket.fare,
          refund_amount: ticket.refund_amount
        },
        employee_info: {
          employee_id: ticket.employee_id,
          is_dependent: !ticket.user_id // If no user_id, it's a dependent
        }
      };
    } else {
      // User response structure (unchanged)
      return {
        pnr_no: ticket.pnr_no,
        passenger_name: ticket.passenger_name,
        train_no: ticket.train_no,
        journey: ticket.journey || {
          from_station: ticket.passenger_info?.route?.split('→')[0]?.trim(),
          to_station: ticket.passenger_info?.route?.split('→')[1]?.trim(),
          journey_date: ticket.passenger_info?.journey_date || ticket.journey_date,
          class: ticket.journey?.class || {
            class_name: ticket.travel_info?.class_name || ticket.seat_info?.class_name
          }
        },
        status: ticket.status || {
          overall: ticket.booking_status === 'cancelled' ? '❌ CANCELLED' : '✅ CONFIRMED',
          description: ticket.booking_details,
          ticket_status: ticket.booking_status,
          allocation_status: ticket.allocation_status,
          payment_status: ticket.payment_status
        },
        seat_allocation: ticket.seat_allocation || ticket.seat_info,
        payment: ticket.payment || {
          amount: ticket.financial?.fare || ticket.travel_info?.fare,
          payment_mode: ticket.travel_info?.payment_mode,
          payment_status: 'success'
        },
        timeline: ticket.timeline || {
          booking_time: ticket.booking_time
        },
        financial: ticket.financial || {
          fare_paid: ticket.travel_info?.fare,
          refund_amount: null
        }
      };
    }
  };

  const printTicket = () => {
    const ticketData = getTicketData();
    if (!ticketData) return;

    setPrinting(true);
    const printContent = document.getElementById('ticket-print-content').innerHTML;
    
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Railway Ticket - ${ticketData.pnr_no}</title>
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
            .employee-badge {
              background: #6f42c1;
              color: white;
              padding: 3px 8px;
              border-radius: 4px;
              font-size: 12px;
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
    setTimeout(() => setPrinting(false), 2000);
  };

  const formatDate = (dateString) => {
    try {
      if (!dateString) return 'Not available';
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

  const formatTime = (dateString) => {
    try {
      if (!dateString) return 'Not available';
      const date = new Date(dateString);
      return date.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Invalid Time';
    }
  };

  const getStatusColor = (status) => {
    const statusValue = status?.toLowerCase();
    switch (statusValue) {
      case 'confirmed': return '#28a745';
      case 'cancelled': return '#dc3545';
      case 'waiting': return '#ffc107';
      default: return '#6c757d';
    }
  };

  const canCancelTicket = (ticketData) => {
    const status = ticketData?.status?.ticket_status?.toLowerCase();
    // Can only cancel confirmed tickets (not already cancelled or waiting list)
    return status === 'confirmed';
  };

  const ticketData = getTicketData();
  const canCancel = ticketData && canCancelTicket(ticketData);

  return (
    <div className="pnr-ticket-container">
      <div className="container">
        <div className="pnr-header">
          <h1>Check Ticket Status</h1>
          <p>Enter your PNR number to view ticket details</p>
          {userType === 'employee' && (
            <div className="employee-badge">
              Employee PNR Lookup
            </div>
          )}
        </div>

        {/* Search Form */}
        <div className="search-section">
          <form onSubmit={handleSearch} className="pnr-search-form">
            <div className="input-group">
              <input
                type="text"
                placeholder="Enter PNR number..."
                value={pnr}
                onChange={(e) => setPnr(e.target.value.toUpperCase())}
                className="pnr-input"
                maxLength={10}
              />
              <button type="submit" disabled={loading} className="btn btn-primary">
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </form>
        </div>

        {/* Error Message */}
        {error && (
          <div className="error-message">
            <p>{error}</p>
          </div>
        )}

        {/* Success Message */}
        {cancellationMessage && (
          <div className="success-message">
            <p>✅ {cancellationMessage}</p>
          </div>
        )}

        {/* Ticket Details */}
        {ticketData && (
          <div className="ticket-details">
            <div className="ticket-actions">
              {canCancel && (
                <button 
                  onClick={cancelTicket}
                  disabled={cancelling}
                  className="btn btn-danger cancel-btn"
                >
                  {cancelling ? '⏳ Cancelling...' : '❌ Cancel Ticket'}
                </button>
              )}
              <button 
                onClick={printTicket}
                disabled={printing}
                className="btn btn-primary print-btn"
              >
                {printing ? '🖨️ Printing...' : '🖨️ Print Ticket'}
              </button>
            </div>

            <div className="ticket-card">
              {/* Hidden content for printing */}
              <div id="ticket-print-content" style={{ display: 'none' }}>
                <div className="ticket-header">
                  <h1>Indian Railways</h1>
                  <div>E-Ticket</div>
                </div>
                
                <div className="pnr-display">
                  <div>PNR Number</div>
                  <div className="pnr-number">{ticketData.pnr_no}</div>
                </div>

                <div className="ticket-section">
                  <h3>Passenger Details</h3>
                  <div className="info-grid">
                    <div className="info-row">
                      <span className="label">Name:</span>
                      <span className="value">{ticketData.passenger_name}</span>
                    </div>
                    {userType === 'employee' && ticketData.employee_info && (
                      <>
                        <div className="info-row">
                          <span className="label">Employee ID:</span>
                          <span className="value">{ticketData.employee_info.employee_id}</span>
                        </div>
                        <div className="info-row">
                          <span className="label">Passenger Type:</span>
                          <span className="value">
                            {ticketData.employee_info.is_dependent ? 'Dependent' : 'Employee'}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="ticket-section">
                  <h3>Journey Details</h3>
                  <div className="info-grid">
                    <div className="info-row">
                      <span className="label">Train No:</span>
                      <span className="value">{ticketData.train_no}</span>
                    </div>
                    <div className="info-row">
                      <span className="label">Class:</span>
                      <span className="value">{ticketData.journey?.class?.class_name}</span>
                    </div>
                    <div className="info-row">
                      <span className="label">From:</span>
                      <span className="value">{ticketData.journey?.from_station}</span>
                    </div>
                    <div className="info-row">
                      <span className="label">To:</span>
                      <span className="value">{ticketData.journey?.to_station}</span>
                    </div>
                    <div className="info-row">
                      <span className="label">Journey Date:</span>
                      <span className="value">{formatDate(ticketData.journey?.journey_date)}</span>
                    </div>
                  </div>
                </div>

                {ticketData.seat_allocation && (
                  <div className="ticket-section">
                    <h3>Seat Allocation</h3>
                    <div className="info-grid">
                      <div className="info-row">
                        <span className="label">Coach:</span>
                        <span className="value">{ticketData.seat_allocation.coach_no}</span>
                      </div>
                      <div className="info-row">
                        <span className="label">Berth:</span>
                        <span className="value">{ticketData.seat_allocation.berth_no}</span>
                      </div>
                      <div className="info-row">
                        <span className="label">Berth Type:</span>
                        <span className="value">{ticketData.seat_allocation.berth_type}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="ticket-section">
                  <h3>Status Information</h3>
                  <div className="info-grid">
                    <div className="info-row">
                      <span className="label">Status:</span>
                      <span className={`status-badge ${ticketData.status?.ticket_status === 'cancelled' ? 'cancelled' : ticketData.status?.ticket_status === 'waiting' ? 'waiting' : ''}`}>
                        {ticketData.status?.overall}
                      </span>
                    </div>
                    <div className="info-row">
                      <span className="label">Booked On:</span>
                      <span className="value">{formatDate(ticketData.timeline?.booking_time)}</span>
                    </div>
                  </div>
                </div>

                <div className="instructions">
                  <strong>Instructions:</strong><br/>
                  • Please carry a valid ID proof during journey<br/>
                  • Arrive at station 30 minutes before departure<br/>
                  • This is an e-ticket, no printout required
                </div>
              </div>

              {/* Visible ticket content */}
              <div className="ticket-content">
                <div className="ticket-header-section">
                  <h2>Ticket Details</h2>
                  <div className="pnr-badge">{ticketData.pnr_no}</div>
                </div>

                <div className="status-section">
                  <div 
                    className="status-badge-large"
                    style={{ 
                      backgroundColor: getStatusColor(ticketData.status?.ticket_status) + '20',
                      color: getStatusColor(ticketData.status?.ticket_status)
                    }}
                  >
                    {ticketData.status?.overall || 'Status Unknown'}
                  </div>
                  {ticketData.status?.description && (
                    <p className="status-description">{ticketData.status.description}</p>
                  )}
                </div>

                <div className="details-grid">
                  <div className="detail-section">
                    <h3>Passenger Information</h3>
                    <div className="detail-item">
                      <span className="label">Name:</span>
                      <span className="value">{ticketData.passenger_name}</span>
                    </div>
                    {userType === 'employee' && ticketData.employee_info && (
                      <>
                        <div className="detail-item">
                          <span className="label">Employee ID:</span>
                          <span className="value">{ticketData.employee_info.employee_id}</span>
                        </div>
                        <div className="detail-item">
                          <span className="label">Passenger Type:</span>
                          <span className="value">
                            {ticketData.employee_info.is_dependent ? 'Dependent' : 'Employee'}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="detail-section">
                    <h3>Journey Information</h3>
                    <div className="detail-item">
                      <span className="label">Train No:</span>
                      <span className="value">{ticketData.train_no}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Route:</span>
                      <span className="value">{ticketData.journey?.from_station} → {ticketData.journey?.to_station}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Journey Date:</span>
                      <span className="value">{formatDate(ticketData.journey?.journey_date)}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Class:</span>
                      <span className="value">{ticketData.journey?.class?.class_name}</span>
                    </div>
                  </div>

                  {ticketData.seat_allocation && (
                    <div className="detail-section">
                      <h3>Seat Allocation</h3>
                      <div className="detail-item">
                        <span className="label">Coach:</span>
                        <span className="value">{ticketData.seat_allocation.coach_no}</span>
                      </div>
                      <div className="detail-item">
                        <span className="label">Berth:</span>
                        <span className="value">{ticketData.seat_allocation.berth_no}</span>
                      </div>
                      <div className="detail-item">
                        <span className="label">Berth Type:</span>
                        <span className="value">{ticketData.seat_allocation.berth_type}</span>
                      </div>
                    </div>
                  )}

                  <div className="detail-section">
                    <h3>Payment Information</h3>
                    <div className="detail-item">
                      <span className="label">Fare:</span>
                      <span className="value">
                        {userType === 'employee' ? 'FREE TRAVEL' : `₹${ticketData.payment?.amount || ticketData.financial?.fare_paid}`}
                      </span>
                    </div>
                    {ticketData.financial?.refund_amount && ticketData.financial.refund_amount !== '0.00' && (
                      <div className="detail-item">
                        <span className="label">Refund Amount:</span>
                        <span className="value">₹{ticketData.financial.refund_amount}</span>
                      </div>
                    )}
                    <div className="detail-item">
                      <span className="label">Payment Mode:</span>
                      <span className="value">
                        {userType === 'employee' ? 'FREE TRAVEL' : (ticketData.payment?.payment_mode?.toUpperCase() || 'UPI')}
                      </span>
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Timeline</h3>
                    <div className="detail-item">
                      <span className="label">Booked On:</span>
                      <span className="value">{formatDate(ticketData.timeline?.booking_time)} at {formatTime(ticketData.timeline?.booking_time)}</span>
                    </div>
                    {ticketData.timeline?.cancellation_time && (
                      <div className="detail-item">
                        <span className="label">Cancelled On:</span>
                        <span className="value">{formatDate(ticketData.timeline.cancellation_time)} at {formatTime(ticketData.timeline.cancellation_time)}</span>
                      </div>
                    )}
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

export default PNRTicket;