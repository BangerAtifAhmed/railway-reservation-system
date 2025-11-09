import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Navbar from './components/Navbar/Navbar';
import Home from './pages/Home/Home';
import UserLogin from './pages/Auth/UserLogin';
import EmployeeLogin from './pages/Auth/EmployeeLogin';
import Register from './pages/Auth/Register';
import SearchTrains from './pages/SearchTrains/searchTrains';
import Booking from './pages/Booking/Booking';
import PassengerDetails from './pages/PassengerDetails/PassengerDetails';
import BookingConfirmation from './pages/BookingConfirmation/BookingConfirmation';
import BookingHistory from './pages/BookingHistory.css/BookingHistory';
import PNRTicket from './pages/PNRTicket/PNRTicket';
import EmployeeDashboard from './pages/EmployeeDashboard/EmployeeDashboard';
import EmployeeDependents from './pages/EmployeeDependents/EmployeeDependents';
import UserProfile from './pages/UserProfile/UserProfile';
// In your App.js or routing configuration
import TrainRoutes from './components/TrainRoutes/TrainRoutes';

// Add this route
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app">
          <Navbar />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<UserLogin />} />
              <Route path="/employee-login" element={<EmployeeLogin />} />
              <Route path="/register" element={<Register />} />
              <Route path="/search" element={<SearchTrains />} />
              <Route path="/booking" element={<Booking />} />
              <Route path="/passenger-details" element={<PassengerDetails />} />
              <Route path="/booking-confirmation" element={<BookingConfirmation />} />
              <Route path="/booking-history" element={<BookingHistory />} />
              <Route path="/pnr-ticket" element={<PNRTicket />} />
              <Route path="/employee/dashboard" element={<EmployeeDashboard />} />
              <Route path="/profile" element={<UserProfile />} />
              <Route path="/employee/dependents" element={<EmployeeDependents />} />
              <Route path="/train-routes" element={<TrainRoutes />} />
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;