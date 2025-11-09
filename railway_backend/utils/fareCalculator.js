const calculateFare = async (pool, train_no, source_station, dest_station, class_id) => {
  try {
    // Now using the database FUNCTION instead of raw query
    const [fareResults] = await pool.execute(
      `SELECT 
        c.class_id,
        c.class_name,
        c.c_multiplier,
        c.reservation_charges,
        c.special_charges,
        (dest_rs.distance_from_source - src_rs.distance_from_source) as distance,
        CalculateTicketFare(?, ?, ?, ?) as fare
       FROM class c
       JOIN schedule s ON c.train_no = s.train_no
       JOIN route_stop src_rs ON s.schedule_id = src_rs.schedule_id
       JOIN route_stop dest_rs ON s.schedule_id = dest_rs.schedule_id
       WHERE c.class_id = ? 
         AND c.train_no = ?
         AND src_rs.station_id = ?
         AND dest_rs.station_id = ?
         AND src_rs.stop_sequence < dest_rs.stop_sequence
       LIMIT 1`,
      [class_id, train_no, source_station, dest_station, 
       class_id, train_no, source_station, dest_station]
    );
    
    return fareResults.length > 0 ? fareResults[0] : null;
  } catch (error) {
    console.error('Fare calculation error:', error);
    return null;
  }
};

// Alternative simpler version using just the function:
const calculateFareSimple = async (pool, train_no, source_station, dest_station, class_id) => {
  try {
    const [result] = await pool.execute(
      'SELECT CalculateTicketFare(?, ?, ?, ?) as fare',
      [class_id, train_no, source_station, dest_station]
    );
    
    return result.length > 0 ? { fare: result[0].fare } : null;
  } catch (error) {
    console.error('Fare calculation error:', error);
    return null;
  }
};

module.exports = { calculateFare, calculateFareSimple };