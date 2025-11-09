import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { trainService } from '../../services/trainService';
import './PassengerDetails.css';

const PassengerDetails = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, userType } = useAuth();

  const { train, selectedClass, journey_date, source_station, dest_station } = location.state || {};

  const [passenger, setPassenger] = useState({
    name: '',
    age: '',
    gender: '',
    berth_preference: '',
    id_proof: 'Aadhar',
    id_number: ''
  });

  // Employee-specific fields
  const [isDependent, setIsDependent] = useState(false);
  const [dependentId, setDependentId] = useState('');

  const [contactDetails, setContactDetails] = useState({
    email: user?.email || '',
    mobile: '',
    emergency_contact: ''
  });

  const [paymentMode, setPaymentMode] = useState('upi');
  const [loading, setLoading] = useState(false);

  if (!train || !selectedClass) {
    return (
      <div className="passenger-container">
        <div className="container">
          <div className="error-state">
            <h2>Invalid Booking Session</h2>
            <p>Please go back and select a train and class to book.</p>
            <button onClick={() => navigate('/search')} className="btn btn-primary">
              Back to Search
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handlePassengerChange = (field, value) => {
    setPassenger({
      ...passenger,
      [field]: value
    });
  };

  const handleContactChange = (field, value) => {
    setContactDetails({
      ...contactDetails,
      [field]: value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Validate passenger details
    if (!passenger.name || !passenger.age || !passenger.gender) {
      alert('Please fill all passenger details');
      setLoading(false);
      return;
    }

    if (!contactDetails.email || !contactDetails.mobile) {
      alert('Please fill all contact details');
      setLoading(false);
      return;
    }

    // Validate dependent ID if isDependent is true
    if (userType === 'employee' && isDependent && !dependentId) {
      alert('Please enter Dependent ID for dependent booking');
      setLoading(false);
      return;
    }

    try {
      console.log('🎫 Starting single passenger booking...');
      
      let response;
      if (userType === 'employee') {
        console.log('👨‍💼 Using employee booking API...');
        
        const employeeBookingData = {
          train_no: train.train_no,
          source_station: source_station,
          dest_station: dest_station,
          class_id: selectedClass.class_id,
          journey_date: journey_date,
          passenger_name: passenger.name,
          passenger_age: parseInt(passenger.age),
          passenger_gender: passenger.gender,
          preferred_seat_type: passenger.berth_preference || '',
          is_dependent: isDependent,
          dependent_id: isDependent ? dependentId : ''
        };

        console.log('📤 Employee API payload:', employeeBookingData);
        response = await trainService.bookTicketEmployee(employeeBookingData);
      } else {
        console.log('👤 Using user booking API...');
        
        const userBookingData = {
          train_no: train.train_no,
          source_station: source_station,
          dest_station: dest_station,
          class_id: selectedClass.class_id,
          journey_date: journey_date,
          passenger_name: passenger.name,
          passenger_age: parseInt(passenger.age),
          passenger_gender: passenger.gender,
          payment_mode: paymentMode
        };

        console.log('📤 User API payload:', userBookingData);
        response = await trainService.bookTicket(userBookingData);
      }

      console.log('✅ Booking response:', response);

      if (response.success) {
        console.log('🎉 Booking successful!');
        navigate('/booking-confirmation', { 
          state: { 
            booking: response.data,
            train,
            selectedClass,
            passenger,
            fare: selectedClass.fare,
            userType: userType,
            isDependent: isDependent
          } 
        });
      } else {
        console.log('❌ Booking failed in response');
        alert(response.message || 'Booking failed. Please try again.');
      }

    } catch (error) {
      console.error('💥 Booking error caught:', error);
      
      if (error.response) {
        console.error('📡 Server error response:', error.response.data);
        alert(`Booking failed: ${error.response.data?.message || 'Server error'}`);
      } else if (error.request) {
        console.error('📡 No response received');
        alert('Booking failed: No response from server. Please check your connection.');
      } else {
        console.error('💥 Other error:', error.message);
        alert(`Booking failed: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const totalFare = userType === 'employee' ? 0 : selectedClass.fare;

  return (
    <div className="passenger-container">
      <div className="container">
        <div className="passenger-header">
          <h1>Passenger Details</h1>
          <p>Enter passenger information to complete your booking</p>
          {userType === 'employee' && (
            <div className="employee-badge">
              Employee Booking - Free Travel
            </div>
          )}
        </div>

        <div className="booking-summary-card">
          <div className="summary-header">
            <h3>Booking Summary</h3>
            <div className="total-fare">
              {userType === 'employee' ? (
                <>
                  <span style={{ textDecoration: 'line-through', color: 'var(--text-light)', marginRight: '10px' }}>
                    ₹{selectedClass.fare}
                  </span>
                  <span style={{ color: 'var(--success)', fontWeight: '700' }}>FREE</span>
                </>
              ) : (
                `₹${totalFare}`
              )}
            </div>
          </div>
          
          <div className="train-info">
            <div className="train-name">{train.train_name}</div>
            <div className="route">
              {train.from_station} → {train.to_station}
            </div>
            <div className="journey-details">
              <span>{journey_date}</span>
              <span>•</span>
              <span>{selectedClass.class_name}</span>
              <span>•</span>
              <span>1 Passenger</span>
              {userType === 'employee' && isDependent && (
                <span style={{ color: 'var(--warning)' }}>• Dependent</span>
              )}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="passenger-form">
          <div className="passenger-section">
            <h3>Passenger Information</h3>
            <div className="passenger-card">
              <h4>Passenger 1</h4>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    value={passenger.name}
                    onChange={(e) => handlePassengerChange('name', e.target.value)}
                    required
                    placeholder="Enter full name"
                  />
                </div>

                <div className="form-group">
                  <label>Age *</label>
                  <input
                    type="number"
                    value={passenger.age}
                    onChange={(e) => handlePassengerChange('age', e.target.value)}
                    required
                    min="1"
                    max="120"
                    placeholder="Age"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Gender *</label>
                  <select
                    value={passenger.gender}
                    onChange={(e) => handlePassengerChange('gender', e.target.value)}
                    required
                  >
                    <option value="">Select Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Berth Preference</label>
                  <select
                    value={passenger.berth_preference}
                    onChange={(e) => handlePassengerChange('berth_preference', e.target.value)}
                  >
                    <option value="">No Preference</option>
                    <option value="Lower">Lower</option>
                    <option value="Middle">Middle</option>
                    <option value="Upper">Upper</option>
                    <option value="Side Lower">Side Lower</option>
                    <option value="Side Upper">Side Upper</option>
                  </select>
                </div>
              </div>

              {/* Employee-specific fields */}
              {userType === 'employee' && (
                <div className="employee-fields">
                  <div className="form-row">
                    <div className="form-group">
                      <label>Is this a dependent booking?</label>
                      <div className="checkbox-group">
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={isDependent}
                            onChange={(e) => setIsDependent(e.target.checked)}
                          />
                          <span className="checkmark"></span>
                          Yes, this is for a dependent
                        </label>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Dependent ID {isDependent && '*'}</label>
                      <input
                        type="text"
                        value={dependentId}
                        onChange={(e) => setDependentId(e.target.value)}
                        placeholder="Enter dependent ID"
                        disabled={!isDependent}
                        required={isDependent}
                      />
                      {isDependent && (
                        <small className="helper-text">
                          Enter the dependent ID (e.g., DEP001, DEP002, etc.)
                        </small>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {userType !== 'employee' && (
                <div className="form-row">
                  <div className="form-group">
                    <label>ID Proof</label>
                    <select
                      value={passenger.id_proof}
                      onChange={(e) => handlePassengerChange('id_proof', e.target.value)}
                    >
                      <option value="Aadhar">Aadhar Card</option>
                      <option value="PAN">PAN Card</option>
                      <option value="Driving">Driving License</option>
                      <option value="Passport">Passport</option>
                      <option value="Voter">Voter ID</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>ID Number</label>
                    <input
                      type="text"
                      value={passenger.id_number}
                      onChange={(e) => handlePassengerChange('id_number', e.target.value)}
                      placeholder="ID number"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="contact-section">
            <h3>Contact Information</h3>
            <div className="contact-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Email Address *</label>
                  <input
                    type="email"
                    value={contactDetails.email}
                    onChange={(e) => handleContactChange('email', e.target.value)}
                    required
                    placeholder="Enter email address"
                  />
                </div>

                <div className="form-group">
                  <label>Mobile Number *</label>
                  <input
                    type="tel"
                    value={contactDetails.mobile}
                    onChange={(e) => handleContactChange('mobile', e.target.value)}
                    required
                    placeholder="Enter mobile number"
                    pattern="[0-9]{10}"
                    maxLength="10"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Emergency Contact Number</label>
                <input
                  type="tel"
                  value={contactDetails.emergency_contact}
                  onChange={(e) => handleContactChange('emergency_contact', e.target.value)}
                  placeholder="Emergency contact number"
                  pattern="[0-9]{10}"
                  maxLength="10"
                />
              </div>
            </div>
          </div>

          {userType !== 'employee' && (
            <div className="payment-section">
              <h3>Payment Information</h3>
              <div className="payment-options">
                <div className="form-group">
                  <label>Payment Mode *</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    required
                  >
                    <option value="upi">UPI</option>
                    <option value="card">Credit/Debit Card</option>
                    <option value="netbanking">Net Banking</option>
                    <option value="wallet">Wallet</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="action-buttons">
            <button 
              type="button" 
              onClick={() => navigate('/booking', { state: location.state })}
              className="btn btn-secondary"
            >
              Back to Class Selection
            </button>
            
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Processing...' : userType === 'employee' ? 'Book Free Ticket' : `Pay ₹${totalFare}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PassengerDetails;