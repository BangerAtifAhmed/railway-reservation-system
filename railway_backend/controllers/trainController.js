// controllers/trainController.js
const pool = require('../config/database');
const { calculateFare } = require('../utils/fareCalculator');

const checkAvailability = async (req, res) => {
  try {
    const { train_no, source_station, dest_station, journey_date } = req.query;
    
    console.log('🔍 Checking REAL availability for:', {
      train_no, source_station, dest_station, journey_date
    });

    // Get basic train and class info with REAL availability
    const [results] = await pool.execute(
      `SELECT 
        s.schedule_id,
        s.train_no,
        c.class_id,
        c.class_name,
        c.coach_type,
        c.no_of_coaches,
        
        -- TOTAL physical berths from berth table
        (SELECT COUNT(*) FROM berth b WHERE b.class_id = c.class_id) as total_berths,
        
        -- DATE-SPECIFIC confirmed bookings for this route
        (SELECT COUNT(*) 
         FROM allocates a 
         JOIN ticket t ON a.pnr_no = t.pnr_no
         WHERE a.class_id = c.class_id 
           AND t.train_no = s.train_no
           AND t.source_station = ?
           AND t.destination_station = ?
           AND DATE(t.date_time) = ?
           AND a.allocation_status = 'confirmed'
        ) as confirmed_bookings_today,
        
        -- DATE-SPECIFIC RAC bookings
        (SELECT COUNT(*) 
         FROM allocates a 
         JOIN ticket t ON a.pnr_no = t.pnr_no
         WHERE a.class_id = c.class_id 
           AND t.train_no = s.train_no
           AND t.source_station = ?
           AND t.destination_station = ?
           AND DATE(t.date_time) = ?
           AND a.allocation_status = 'rac'
        ) as rac_bookings_today,
        
        -- DATE-SPECIFIC waiting list
        (SELECT COUNT(*) 
         FROM allocates a 
         JOIN ticket t ON a.pnr_no = t.pnr_no
         WHERE a.class_id = c.class_id 
           AND t.train_no = s.train_no
           AND t.source_station = ?
           AND t.destination_station = ?
           AND DATE(t.date_time) = ?
           AND a.allocation_status = 'waiting'
        ) as waiting_list_today,
        
        -- REAL available berths for this date
        ((SELECT COUNT(*) FROM berth b WHERE b.class_id = c.class_id) - 
         (SELECT COUNT(*) 
          FROM allocates a 
          JOIN ticket t ON a.pnr_no = t.pnr_no
          WHERE a.class_id = c.class_id 
            AND t.train_no = s.train_no
            AND t.source_station = ?
            AND t.destination_station = ?
            AND DATE(t.date_time) = ?
            AND a.allocation_status = 'confirmed'
         )) as available_berths_today,
        
        -- FIXED: AVAILABLE seat type counts for this date (not total counts)
        (SELECT COUNT(*) FROM berth b 
         WHERE b.class_id = c.class_id 
           AND b.seat_type = 'Lower'
           AND b.berth_id NOT IN (
             SELECT a.berth_id 
             FROM allocates a 
             JOIN ticket t ON a.pnr_no = t.pnr_no
             WHERE a.class_id = c.class_id 
               AND t.train_no = s.train_no
               AND t.source_station = ?
               AND t.destination_station = ?
               AND DATE(t.date_time) = ?
               AND a.allocation_status = 'confirmed'
           )
        ) as lower_berths,

        (SELECT COUNT(*) FROM berth b 
         WHERE b.class_id = c.class_id 
           AND b.seat_type = 'Middle'
           AND b.berth_id NOT IN (
             SELECT a.berth_id 
             FROM allocates a 
             JOIN ticket t ON a.pnr_no = t.pnr_no
             WHERE a.class_id = c.class_id 
               AND t.train_no = s.train_no
               AND t.source_station = ?
               AND t.destination_station = ?
               AND DATE(t.date_time) = ?
               AND a.allocation_status = 'confirmed'
           )
        ) as middle_berths,

        (SELECT COUNT(*) FROM berth b 
         WHERE b.class_id = c.class_id 
           AND b.seat_type = 'Upper'
           AND b.berth_id NOT IN (
             SELECT a.berth_id 
             FROM allocates a 
             JOIN ticket t ON a.pnr_no = t.pnr_no
             WHERE a.class_id = c.class_id 
               AND t.train_no = s.train_no
               AND t.source_station = ?
               AND t.destination_station = ?
               AND DATE(t.date_time) = ?
               AND a.allocation_status = 'confirmed'
           )
        ) as upper_berths,

        (SELECT COUNT(*) FROM berth b 
         WHERE b.class_id = c.class_id 
           AND b.seat_type = 'Side Lower'
           AND b.berth_id NOT IN (
             SELECT a.berth_id 
             FROM allocates a 
             JOIN ticket t ON a.pnr_no = t.pnr_no
             WHERE a.class_id = c.class_id 
               AND t.train_no = s.train_no
               AND t.source_station = ?
               AND t.destination_station = ?
               AND DATE(t.date_time) = ?
               AND a.allocation_status = 'confirmed'
           )
        ) as side_lower_berths,

        (SELECT COUNT(*) FROM berth b 
         WHERE b.class_id = c.class_id 
           AND b.seat_type = 'Side Upper'
           AND b.berth_id NOT IN (
             SELECT a.berth_id 
             FROM allocates a 
             JOIN ticket t ON a.pnr_no = t.pnr_no
             WHERE a.class_id = c.class_id 
               AND t.train_no = s.train_no
               AND t.source_station = ?
               AND t.destination_station = ?
               AND DATE(t.date_time) = ?
               AND a.allocation_status = 'confirmed'
           )
        ) as side_upper_berths
        
       FROM schedule s
       JOIN class c ON s.train_no = c.train_no
       JOIN route_stop src_rs ON s.schedule_id = src_rs.schedule_id
       JOIN route_stop dest_rs ON s.schedule_id = dest_rs.schedule_id
       WHERE s.train_no = ?
         AND src_rs.station_id = ?
         AND dest_rs.station_id = ?
         AND src_rs.stop_sequence < dest_rs.stop_sequence
       ORDER BY c.c_multiplier DESC`,
      [
        // Parameters for the subqueries
        source_station, dest_station, journey_date,  // confirmed_bookings_today
        source_station, dest_station, journey_date,  // rac_bookings_today
        source_station, dest_station, journey_date,  // waiting_list_today
        source_station, dest_station, journey_date,  // available_berths_today
        // Parameters for seat type counts (each needs source, dest, date)
        source_station, dest_station, journey_date,  // lower_berths
        source_station, dest_station, journey_date,  // middle_berths  
        source_station, dest_station, journey_date,  // upper_berths
        source_station, dest_station, journey_date,  // side_lower_berths
        source_station, dest_station, journey_date,  // side_upper_berths
        train_no, source_station, dest_station       // WHERE conditions
      ]
    );

    console.log('📊 Found classes:', results.length);

    if (results.length === 0) {
      return res.json({ 
        success: true, 
        message: 'No trains found for the specified route',
        data: [] 
      });
    }

    // Add consistent fares using shared calculator
    const availabilityData = await Promise.all(
      results.map(async (train) => {
        const fareData = await calculateFare(pool, train_no, source_station, dest_station, train.class_id);
        
        // Determine availability status
        let availability_status = 'Waiting List';
        if (train.available_berths_today > 0) {
          availability_status = 'Available';
        } else if (train.rac_bookings_today < (train.total_berths * 0.1)) { // 10% RAC quota
          availability_status = 'RAC Available';
        }
        
        return {
          ...train,
          fare: fareData ? fareData.fare : 0,
          availability_status: availability_status,
          available_berths: train.available_berths_today
        };
      })
    );

    res.json({ 
      success: true, 
      data: availabilityData 
    });
    
  } catch (error) {
    console.error('Check availability error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};
const searchTrains = async (req, res) => {
  try {
    const { from_city, to_city, journey_date } = req.query;
    
    const [results] = await pool.execute(
      'CALL search_trains_between_cities(?, ?, ?)',
      [from_city, to_city, journey_date]
    );
    
    res.json({ success: true, data: results[0] });
  } catch (error) {
    console.error('Search trains error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const getTrainRoute = async (req, res) => {
  try {
    const { train_no } = req.params;
    
    const [results] = await pool.execute(
      'CALL show_train_route_all_stations(?)',
      [train_no]
    );
    
    res.json({ success: true, data: results[0] });
  } catch (error) {
    console.error('Get train route error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};




module.exports = { searchTrains, getTrainRoute, checkAvailability };