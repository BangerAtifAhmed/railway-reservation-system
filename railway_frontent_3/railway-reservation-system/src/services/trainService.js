import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const trainService = {
  // Search trains for users
  async searchTrains(searchData) {
    const params = new URLSearchParams();
    params.append('from_city', searchData.from_city);
    params.append('to_city', searchData.to_city);
    params.append('journey_date', searchData.journey_date);
    
    const response = await api.get(`/trains/search?${params}`);
    return response.data;
  },

  // Search trains for employees
  async searchTrainsEmployee(searchData) {
    const params = new URLSearchParams();
    params.append('from_city', searchData.from_city);
    params.append('to_city', searchData.to_city);
    params.append('journey_date', searchData.journey_date);
    
    const response = await api.get(`/employees/trains/search?${params}`);
    return response.data;
  },

// Check availability for users
async checkAvailability(availabilityData) {
  const params = new URLSearchParams();
  params.append('train_no', availabilityData.train_no);
  params.append('source_station', availabilityData.source_station);
  params.append('dest_station', availabilityData.dest_station);
  params.append('journey_date', availabilityData.journey_date);
  
  console.log('🚀 Making API call to:', `/trains/availability/check?${params}`);
  
  const response = await api.get(`/trains/availability/check?${params}`);
  console.log('📡 API Response:', response.data);
  return response.data;
},

// Check availability for employees
async checkAvailabilityEmployee(availabilityData) {
  const params = new URLSearchParams();
  params.append('train_no', availabilityData.train_no);
  params.append('source_station', availabilityData.source_station);
  params.append('dest_station', availabilityData.dest_station);
  params.append('journey_date', availabilityData.journey_date);
  
  console.log('🚀 Making API call to:', `/employees/trains/availability/check?${params}`);
  
  const response = await api.get(`/employees/trains/availability/check?${params}`);
  console.log('📡 API Response:', response.data);
  return response.data;
},
  // Book tickets for users
  async bookTickets(bookingData) {
    try {
      // Make individual API calls for each passenger
      const bookingPromises = bookingData.passengers.map(passenger => {
        const userBookingData = {
          train_no: bookingData.train_no,
          source_station: bookingData.source_station,
          dest_station: bookingData.dest_station,
          class_id: bookingData.class_id,
          journey_date: bookingData.journey_date,
          passenger_name: passenger.name,
          passenger_age: passenger.age,
          passenger_gender: passenger.gender,
          payment_mode: bookingData.payment_mode || 'upi'
        };
        return api.post('/bookings/book', userBookingData);
      });

      const responses = await Promise.all(bookingPromises);
      
      return {
        success: true,
        data: responses.map(response => response.data.data),
        message: `Successfully booked ${responses.length} ticket(s)`
      };
    } catch (error) {
      console.error('Booking error:', error);
      throw error;
    }
  },

  // Book tickets for employees (multiple passengers)
 // Book single ticket for user
async bookTicket(bookingData) {
  try {
    console.log('🚀 Booking single user ticket:', bookingData);
    const response = await api.post('/bookings/book', bookingData);
    console.log('✅ User booking response:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ User booking error:', error);
    throw error;
  }
},

// Book single ticket for employee
async bookTicketEmployee(bookingData) {
  try {
    console.log('🚀 Booking single employee ticket:', bookingData);
    const response = await api.post('/employees/book-ticket', bookingData);
    console.log('✅ Employee booking response:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Employee booking error:', error);
    throw error;
  }
},

  // Get booking history for users
  async getBookingHistory() {
    const response = await api.get('/bookings/history');
    return response.data;
  },

  // Get booking history for employees
  async getBookingHistoryEmployee() {
    const response = await api.get('/employees/bookings/history');
    return response.data;
  },
    async getTicketByPNR(pnr) {
    const response = await api.get(`/bookings/${pnr}`);
    return response.data;
  },

  // Get ticket by PNR for employees
  async getTicketByPNREmployee(pnr) {
    const response = await api.get(`/employees/booking/${pnr}`);
    return response.data;
  },
  async getUserProfile() {
    const response = await api.get('/users/profile');
    return response.data;
  },

  // Get employee profile
  async getEmployeeProfile() {
    const response = await api.get('/employees/my-profile');
    return response.data;
  },
    async getEmployeeDependents() {
    const response = await api.get('/employees/dependents-list');
    return response.data;
  },
   async cancelUserTicket(pnrNo) {
    try {
      console.log('🚀 Cancelling user ticket with PNR:', pnrNo);
      const response = await api.post('/bookings/cancel', { pnr_no: pnrNo });
      console.log('✅ User cancellation response:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ User cancellation error:', error);
      throw error;
    }
  },

  // Cancel ticket for employees
  async cancelEmployeeTicket(pnrNo) {
    try {
      console.log('🚀 Cancelling employee ticket with PNR:', pnrNo);
      const response = await api.post('/employees/cancel-ticket', { pnr_no: pnrNo });
      console.log('✅ Employee cancellation response:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Employee cancellation error:', error);
      throw error;
    }
  },
  // Get train route for users
async getTrainRoute(trainNo) {
  try {
    console.log('🚀 Fetching train route for train:', trainNo);
    const response = await api.get(`/trains/${trainNo}/route`);
    console.log('✅ Train route response:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Train route error:', error);
    throw error;
  }
},

// Get train route for employees
async getTrainRouteEmployee(trainNo) {
  try {
    console.log('🚀 Fetching employee train route for train:', trainNo);
    const response = await api.get(`/employees/trains/${trainNo}/route`);
    console.log('✅ Employee train route response:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Employee train route error:', error);
    throw error;
  }
},
// Get employee quota information
async getEmployeeQuotaInfo() {
  try {
    console.log('🚀 Fetching employee quota info');
    const response = await api.get('/employees/quota-info');
    console.log('✅ Employee quota response:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Employee quota error:', error);
    throw error;
  }
}
};

