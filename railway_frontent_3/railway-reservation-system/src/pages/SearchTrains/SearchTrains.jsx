import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { trainService } from '../../services/trainService';
import { useNavigate } from 'react-router-dom';
import './SearchTrains.css';

const SearchTrains = () => {
  const [searchData, setSearchData] = useState({
    from_city: '',
    to_city: '',
    journey_date: ''
  });
  const [trains, setTrains] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  const { userType, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const popularRoutes = [
    { from: 'Mumbai', to: 'Delhi', route: 'Mumbai → Surat → Ahmedabad → Delhi' },
    { from: 'Delhi', to: 'Kolkata', route: 'Delhi → Lucknow → Patna → Kolkata' },
    { from: 'Delhi', to: 'Chandigarh', route: 'Delhi → Chandigarh' },
    { from: 'Mumbai', to: 'Kolkata', route: 'Mumbai → Nagpur → Kolkata' },
    { from: 'Mumbai', to: 'Chennai', route: 'Mumbai → Pune → Nagpur → Hyderabad → Chennai' },
    { from: 'Bengaluru', to: 'Hyderabad', route: 'Bengaluru → Hyderabad' },
    { from: 'Delhi', to: 'Jaipur', route: 'Delhi → Jaipur' },
    { from: 'Mumbai', to: 'Pune', route: 'Mumbai → Pune' },
    { from: 'Delhi', to: 'Varanasi', route: 'Delhi → Varanasi' },
    { from: 'Kolkata', to: 'Chennai', route: 'Kolkata → Bhubaneswar → Visakhapatnam → Chennai' }
  ];

  const handleChange = (e) => {
    setSearchData({
      ...searchData,
      [e.target.name]: e.target.value
    });
  };

  const handlePopularRouteClick = (from, to) => {
    setSearchData({
      from_city: from,
      to_city: to,
      journey_date: ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSearched(true);

    try {
      let response;
      if (userType === 'employee') {
        response = await trainService.searchTrainsEmployee(searchData);
      } else {
        response = await trainService.searchTrains(searchData);
      }

      if (response.success) {
        setTrains(response.data);
      } else {
        setError('No trains found for the selected route');
        setTrains([]);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to search trains');
      setTrains([]);
    } finally {
      setLoading(false);
    }
  };

 const handleBookNow = (train) => {
  if (!isAuthenticated) {
    alert('Please login to continue');
    navigate('/login');
    return;
  }

  // Both users and employees can book tickets
  navigate('/booking', { 
    state: { 
      train,
      journey_date: searchData.journey_date,
      source_station: train.from_station_id,
      dest_station: train.to_station_id
    } 
  });
};

  const formatDuration = (duration) => {
    return duration.startsWith('-') ? duration.substring(1) : duration;
  };

  return (
    <div className="search-container">
      <div className="container">
        <div className="search-header">
          <h1>Search Trains</h1>
          <p>Find and book your perfect train journey</p>
        </div>

        {/* Search Form */}
        <div className="search-card">
          <form onSubmit={handleSubmit} className="search-form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="from_city">From Station</label>
                <input
                  type="text"
                  id="from_city"
                  name="from_city"
                  value={searchData.from_city}
                  onChange={handleChange}
                  required
                  placeholder="Enter source city"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="to_city">To Station</label>
                <input
                  type="text"
                  id="to_city"
                  name="to_city"
                  value={searchData.to_city}
                  onChange={handleChange}
                  required
                  placeholder="Enter destination city"
                />
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="journey_date">Journey Date</label>
                <input
                  type="date"
                  id="journey_date"
                  name="journey_date"
                  value={searchData.journey_date}
                  onChange={handleChange}
                  required
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              
              <div className="form-group">
                <label className="invisible-label">Search</label>
                <button 
                  type="submit" 
                  className="btn btn-primary search-btn"
                  disabled={loading}
                >
                  {loading ? 'Searching...' : 'Search Trains'}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Popular Routes */}
        <div className="popular-routes-section">
          <h2>Popular Routes</h2>
          <div className="popular-routes-grid">
            {popularRoutes.map((route, index) => (
              <div 
                key={index}
                className="popular-route-card"
                onClick={() => handlePopularRouteClick(route.from, route.to)}
              >
                <div className="route-cities">
                  <span className="from-city">{route.from}</span>
                  <span className="route-arrow">→</span>
                  <span className="to-city">{route.to}</span>
                </div>
                <div className="route-details">{route.route}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Search Results */}
        {searched && (
          <div className="results-section">
            <h2>
              {trains.length > 0 
                ? `Found ${trains.length} train(s) from ${searchData.from_city} to ${searchData.to_city}`
                : `No trains found from ${searchData.from_city} to ${searchData.to_city}`
              }
            </h2>

            {error && <div className="error-message">{error}</div>}

            {trains.length > 0 && (
              <div className="trains-list">
                {trains.map((train, index) => (
                  <div key={index} className="train-card">
                    <div className="train-header">
                      <div className="train-info">
                        <h3 className="train-name">{train.train_name}</h3>
                        <span className="train-number">Train No: {train.train_no}</span>
                      </div>
                      <div className="train-duration">
                        <span className="duration">{formatDuration(train.duration)}</span>
                      </div>
                    </div>

                    <div className="train-details">
                      <div className="route-info">
                        <div className="station departure">
                          <div className="time">{train.departure}</div>
                          <div className="station-name">{train.from_station}</div>
                          <div className="city">{train.from_city}</div>
                        </div>
                        
                        <div className="journey-line">
                          <div className="line"></div>
                          <div className="distance">{train.distance_km} km</div>
                        </div>
                        
                        <div className="station arrival">
                          <div className="time">{train.arrival}</div>
                          <div className="station-name">{train.to_station}</div>
                          <div className="city">{train.to_city}</div>
                        </div>
                      </div>

                      <div className="train-meta">
                        <div className="meta-item">
                          <span className="meta-label">Intermediate Stops:</span>
                          <span className="meta-value">{train.intermediate_stops}</span>
                        </div>
                        <div className="meta-item">
                          <span className="meta-label">Running Days:</span>
                          <span className="meta-value">{train.running_days}</span>
                        </div>
                        <div className="meta-item">
                          <span className="meta-label">Available Classes:</span>
                          <span className="meta-value classes">{train.available_classes}</span>
                        </div>
                      </div>
                    </div>

                    <div className="train-actions">
                      <button 
                        className="btn btn-primary book-btn"
                        onClick={() => handleBookNow(train)}
                      >
                        {isAuthenticated && userType === 'user' ? 'Book Now' : 
                         isAuthenticated && userType === 'employee' ? 'View Details' : 
                         'Login to Book'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchTrains;