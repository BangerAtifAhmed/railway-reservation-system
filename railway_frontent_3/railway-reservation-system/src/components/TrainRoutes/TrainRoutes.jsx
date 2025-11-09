import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { trainService } from '../../services/trainService';
import './TrainRoutes.css';

const TrainRoutes = () => {
  const { userType } = useAuth();
  const [trainNo, setTrainNo] = useState('');
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Popular trains data
  const popularTrains = [
    { number: '12301', name: 'Rajdhani Express', color: 'blue', speed: '1.20' },
    { number: '12302', name: 'Rajdhani Express', color: 'red', speed: '1.20' },
    { number: '12303', name: 'Shatabdi Express', color: 'red', speed: '1.10' },
    { number: '12304', name: 'Duronto Express', color: 'green', speed: '1.15' },
    { number: '12305', name: 'Express', color: 'blue', speed: '1.00' },
    { number: '12306', name: 'Superfast', color: 'yellow', speed: '1.05' },
    { number: '12307', name: 'Garib Rath', color: 'orange', speed: '0.80' },
    { number: '12308', name: 'Passenger', color: 'grey', speed: '0.90' },
    { number: '12309', name: 'Vande Bharat', color: 'white', speed: '1.30' },
    { number: '12310', name: 'Express', color: 'blue', speed: '1.00' }
  ];

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!trainNo.trim()) {
      setError('Please enter a train number');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setRoute(null);

      let response;
      if (userType === 'employee') {
        response = await trainService.getTrainRouteEmployee(trainNo.trim());
      } else {
        response = await trainService.getTrainRoute(trainNo.trim());
      }

      if (response.success) {
        setRoute(response.data);
      } else {
        setError(response.message || 'Train route not found');
      }
    } catch (err) {
      console.error('Train route search error:', err);
      setError('Failed to fetch train route. Please check the train number.');
    } finally {
      setLoading(false);
    }
  };

  const handlePopularTrainClick = (trainNumber) => {
    setTrainNo(trainNumber);
    // Auto-search when popular train is clicked
    setTimeout(() => {
      const fakeEvent = { preventDefault: () => {} };
      handleSearch(fakeEvent);
    }, 100);
  };

 // In your TrainRoutes component, replace the getSpeedColor function with:
const getSpeedClass = (speed) => {
  const speedValue = parseFloat(speed);
  if (speedValue >= 1.20) return 'speed-high';
  if (speedValue >= 1.10) return 'speed-medium-high';
  if (speedValue >= 1.00) return 'speed-medium';
  return 'speed-low';
};



  const formatTime = (time) => {
    if (!time) return '--:--';
    return time;
  };

  return (
    <div className="train-routes-container">
      <div className="container">
        <div className="train-routes-header">
          <h1>Train Routes & Schedules</h1>
          <p>Enter train number to view complete route and schedule</p>
          {userType === 'employee' && (
            <div className="employee-badge">
              Employee Route Lookup
            </div>
          )}
        </div>

        {/* Search Form */}
        <div className="search-section">
          <form onSubmit={handleSearch} className="train-search-form">
            <div className="input-group">
              <input
                type="text"
                placeholder="Enter train number (e.g., 12301)..."
                value={trainNo}
                onChange={(e) => setTrainNo(e.target.value)}
                className="train-input"
                maxLength={5}
              />
              <button type="submit" disabled={loading} className="btn btn-primary">
                {loading ? 'Searching...' : 'Find Route'}
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

        {/* Popular Trains Section */}
        <div className="popular-trains-section">
          <h3>Popular Trains</h3>
          <p>Click on any train to view its route</p>
          <div className="popular-trains-grid">
            {popularTrains.map((train) => (
              <div
                key={train.number}
                className="popular-train-card"
                onClick={() => handlePopularTrainClick(train.number)}
                style={{ cursor: 'pointer' }}
              >
                <div className="train-number">{train.number}</div>
                <div className="train-name">{train.name}</div>
                <div className="train-meta">
                <span className={`speed-badge ${getSpeedClass(train.speed)}`}>
                 Speed: {train.speed}x
                </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Route Details */}
        {route && route.length > 0 && (
          <div className="route-details">
            <div className="route-header">
              <h2>Train {trainNo} Route</h2>
              <div className="route-summary">
                <span className="route-stations">
                  {route[0]?.station_name} → {route[route.length - 1]?.station_name}
                </span>
                <span className="total-stops">{route.length} stations</span>
              </div>
            </div>

            <div className="route-timeline">
              {route.map((stop, index) => (
                <div key={stop.stop_number} className="route-stop">
                  <div className="stop-marker">
                    <div className={`marker-dot ${stop.station_type.toLowerCase()}`}>
                      {stop.station_type === 'START' && '🚂'}
                      {stop.station_type === 'END' && '🏁'}
                      {stop.station_type === 'STOP' && '⏺️'}
                    </div>
                    {index < route.length - 1 && <div className="connection-line"></div>}
                  </div>
                  
                  <div className="stop-details">
                    <div className="stop-header">
                      <div className="station-info">
                        <h4 className="station-name">{stop.station_name}</h4>
                        <div className="station-location">
                          {stop.city}, {stop.state}
                        </div>
                      </div>
                      <div className="stop-number">Stop #{stop.stop_number}</div>
                    </div>

                    <div className="stop-timing">
                      <div className="timing-info">
                        <div className="timing-item">
                          <span className="label">Arrival:</span>
                          <span className="value">{formatTime(stop.arrival)}</span>
                        </div>
                        <div className="timing-item">
                          <span className="label">Departure:</span>
                          <span className="value">{formatTime(stop.departure)}</span>
                        </div>
                        <div className="timing-item">
                          <span className="label">Halt Time:</span>
                          <span className="value">{stop.halt_time}</span>
                        </div>
                      </div>
                      
                      <div className="distance-info">
                        <div className="timing-item">
                          <span className="label">Distance:</span>
                          <span className="value">{stop.distance_from_start}</span>
                        </div>
                        <div className="timing-item">
                          <span className="label">Day:</span>
                          <span className="value">{stop.journey_day}</span>
                        </div>
                      </div>
                    </div>

                    <div className="station-type-badge">
                      <span className={`type-badge ${stop.station_type.toLowerCase()}`}>
                        {stop.station_type}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Route Summary */}
            <div className="route-summary-card">
              <h4>Journey Summary</h4>
              <div className="summary-grid">
                <div className="summary-item">
                  <span className="summary-label">Total Distance:</span>
                  <span className="summary-value">
                    {route[route.length - 1]?.distance_from_start}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Total Stops:</span>
                  <span className="summary-value">{route.length - 2} intermediate stops</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Journey Duration:</span>
                  <span className="summary-value">
                    {route[0]?.departure} to {route[route.length - 1]?.arrival}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Route Type:</span>
                  <span className="summary-value">
                    {route[0]?.station_name} → {route[route.length - 1]?.station_name}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrainRoutes;