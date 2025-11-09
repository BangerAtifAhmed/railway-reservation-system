import React, { useState } from 'react';
import './Home.css';

const Home = () => {
  const [showProjectDetails, setShowProjectDetails] = useState(false);

  const toggleProjectDetails = () => {
    setShowProjectDetails(!showProjectDetails);
  };

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-bg"></div>
        <div className="container">
          <div className="hero-content">
            <div className="hero-text">
              <h1 className="hero-title fade-in-up">
                Journey with <span className="highlight">Confidence</span>
              </h1>
              <p className="hero-subtitle fade-in-up">
                Book your train tickets effortlessly. Experience the joy of seamless railway 
                reservations with real-time availability and instant confirmations.
              </p>
              <div className="hero-actions fade-in-up">
                <a href="/search" className="btn btn-primary">Book Now</a>
                <button onClick={toggleProjectDetails} className="btn btn-secondary">
                  {showProjectDetails ? 'Close Details' : 'Learn More'}
                </button>
              </div>
            </div>
            <div className="hero-image slide-in-left">
              <div className="train-illustration">
                <div className="train-container">
                  <div className="train-body">
                    {/* Engine */}
                    <div className="train-engine">
                      <div className="headlight"></div>
                      <div className="train-wheels">
                        <div className="wheel"></div>
                        <div className="wheel"></div>
                        <div className="wheel"></div>
                      </div>
                    </div>
                    
                    {/* Coaches */}
                    <div className="train-coach">
                      <div className="train-window"></div>
                      <div className="train-window"></div>
                      <div className="train-window"></div>
                      <div className="train-window"></div>
                      <div className="train-wheels">
                        <div className="wheel"></div>
                        <div className="wheel"></div>
                        <div className="wheel"></div>
                      </div>
                    </div>
                    
                    <div className="train-coach">
                      <div className="train-window"></div>
                      <div className="train-window"></div>
                      <div className="train-window"></div>
                      <div className="train-window"></div>
                      <div className="train-wheels">
                        <div className="wheel"></div>
                        <div className="wheel"></div>
                        <div className="wheel"></div>
                      </div>
                    </div>
                    
                    <div className="train-coach">
                      <div className="train-window"></div>
                      <div className="train-window"></div>
                      <div className="train-window"></div>
                      <div className="train-window"></div>
                      <div className="train-wheels">
                        <div className="wheel"></div>
                        <div className="wheel"></div>
                        <div className="wheel"></div>
                      </div>
                    </div>
                    
                    {/* Last Coach with different design */}
                    <div className="train-coach">
                      <div className="train-window"></div>
                      <div className="train-window"></div>
                      <div className="train-window"></div>
                      <div className="train-window"></div>
                      <div className="train-wheels">
                        <div className="wheel"></div>
                        <div className="wheel"></div>
                        <div className="wheel"></div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Speed Lines */}
                  <div className="speed-lines">
                    <div className="speed-line"></div>
                    <div className="speed-line"></div>
                    <div className="speed-line"></div>
                    <div className="speed-line"></div>
                  </div>
                  
                  <div className="tracks"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Project Details Section */}
      {showProjectDetails && (
        <section className="project-details-section">
          <div className="container">
            <div className="project-header">
              <h2>RailExpress - Project Details</h2>
              <p>Comprehensive Railway Reservation System</p>
            </div>
            
            <div className="project-overview">
              <h3>📋 Project Overview</h3>
              <p>
                RailExpress is a full-stack web application designed to revolutionize the railway 
                reservation experience. It provides a seamless platform for both regular users and 
                railway employees to book, manage, and track train tickets with advanced features 
                and real-time updates.
              </p>
            </div>

            <div className="project-features-grid">
              <div className="project-feature-category">
                <h4>🚀 Key Features</h4>
                <ul>
                  <li>✅ User & Employee Authentication System</li>
                  <li>✅ Real-time Train Search & Availability</li>
                  <li>✅ Multi-passenger Booking System</li>
                  <li>✅ PNR Status Tracking</li>
                  <li>✅ Booking History Management</li>
                  <li>✅ Ticket Cancellation & Refunds</li>
                  <li>✅ Employee Dependent Management</li>
                  <li>✅ Train Route Information</li>
                  <li>✅ Responsive Design</li>
                </ul>
              </div>

              <div className="project-feature-category">
                <h4>🛠️ Technical Stack</h4>
                <ul>
                  <li><strong>Frontend:</strong> React.js, CSS3, HTML5</li>
                  <li><strong>Backend:</strong> Node.js, Express.js</li>
                  <li><strong>Database:</strong> MySQL</li>
                  <li><strong>Authentication:</strong> JWT Tokens</li>
                  <li><strong>HTTP Client:</strong> Axios</li>
                  <li><strong>Routing:</strong> React Router</li>
                  <li><strong>State Management:</strong> React Context API</li>
                </ul>
              </div>
            </div>

            <div className="user-types-section">
              <h3>👥 User Types & Capabilities</h3>
              <div className="user-types-grid">
                <div className="user-type-card">
                  <h5>Regular Users</h5>
                  <ul>
                    <li>🔐 User Registration & Login</li>
                    <li>🎫 Book Train Tickets</li>
                    <li>📊 View Booking History</li>
                    <li>📋 Check PNR Status</li>
                    <li>❌ Cancel Tickets</li>
                    <li>👤 User Profile Management</li>
                  </ul>
                </div>
                
                <div className="user-type-card">
                  <h5>Railway Employees</h5>
                  <ul>
                    <li>🔐 Employee Login</li>
                    <li>🎫 Free Ticket Booking</li>
                    <li>👨‍👩‍👧‍👦 Dependent Management</li>
                    <li>📊 View All Bookings</li>
                    <li>📋 Check PNR Status</li>
                    <li>❌ Cancel Tickets</li>
                    <li>🚂 Train Route Access</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="api-endpoints-section">
              <h3>🔗 API Endpoints</h3>
              <div className="endpoints-grid">
                <div className="endpoint-category">
                  <h6>Authentication</h6>
                  <ul>
                    <li><code>POST /api/users/register</code> - User registration</li>
                    <li><code>POST /api/users/login</code> - User login</li>
                    <li><code>POST /api/employees/login</code> - Employee login</li>
                  </ul>
                </div>
                
                <div className="endpoint-category">
                  <h6>Train Operations</h6>
                  <ul>
                    <li><code>GET /api/trains/search</code> - Search trains</li>
                    <li><code>GET /api/trains/availability/check</code> - Check availability</li>
                    <li><code>GET /api/trains/:trainNo/route</code> - Get train route</li>
                  </ul>
                </div>
                
                <div className="endpoint-category">
                  <h6>Booking Management</h6>
                  <ul>
                    <li><code>POST /api/bookings/book</code> - Book ticket</li>
                    <li><code>GET /api/bookings/history</code> - Booking history</li>
                    <li><code>GET /api/bookings/:pnr</code> - Get ticket by PNR</li>
                    <li><code>POST /api/bookings/cancel</code> - Cancel ticket</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="project-stats">
              <h3>📈 Project Statistics</h3>
              <div className="stats-cards">
                <div className="project-stat-card">
                  <div className="stat-icon">📄</div>
                  <div className="stat-number">15+</div>
                  <div className="stat-label">Components</div>
                </div>
                <div className="project-stat-card">
                  <div className="stat-icon">🎯</div>
                  <div className="stat-number">20+</div>
                  <div className="stat-label">API Endpoints</div>
                </div>
                <div className="project-stat-card">
                  <div className="stat-icon">🎨</div>
                  <div className="stat-number">5+</div>
                  <div className="stat-label">CSS Files</div>
                </div>
                <div className="project-stat-card">
                  <div className="stat-icon">⚡</div>
                  <div className="stat-number">100%</div>
                  <div className="stat-label">Responsive</div>
                </div>
              </div>
            </div>

            <div className="future-enhancements">
              <h3>🚀 Future Enhancements</h3>
              <ul>
                <li>🔔 Real-time notifications for ticket status</li>
                <li>💳 Multiple payment gateway integration</li>
                <li>📱 Progressive Web App (PWA) support</li>
                <li>🌍 Multi-language support</li>
                <li>📊 Advanced analytics dashboard</li>
                <li>🤖 AI-powered seat recommendations</li>
                <li>📅 Journey planner with multiple routes</li>
              </ul>
            </div>

            <div className="project-footer">
              <p>
                <strong>RailExpress</strong> - Built with modern web technologies to provide 
                the best railway reservation experience. This project demonstrates full-stack 
                development capabilities with React.js, Node.js, and MySQL.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Features Section */}
      <section className="features-section">
        <div className="container">
          <div className="section-header">
            <h2>Why Choose RailExpress?</h2>
            <p>Experience the future of railway reservations</p>
          </div>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>Instant Booking</h3>
              <p>Book your tickets in seconds with our streamlined process</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔍</div>
              <h3>Real-time Availability</h3>
              <p>Get live seat availability and instant confirmation</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🛡️</div>
              <h3>Secure Payments</h3>
              <p>Your transactions are protected with bank-level security</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📱</div>
              <h3>Mobile Friendly</h3>
              <p>Book tickets on any device, anywhere, anytime</p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="stats-section">
        <div className="container">
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-number">50K+</div>
              <div className="stat-label">Happy Travelers</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">100+</div>
              <div className="stat-label">Destinations</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">24/7</div>
              <div className="stat-label">Customer Support</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">99.9%</div>
              <div className="stat-label">Uptime</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;