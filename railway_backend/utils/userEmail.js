// utils/userEmail.js
const nodemailer = require('nodemailer');

console.log('🔧 Email service loading...');
console.log('📧 Email User:', process.env.EMAIL_USER ? 'Set' : 'Not Set');
console.log('🔑 Email Pass:', process.env.EMAIL_PASS ? 'Set' : 'Not Set');

// ✅ FIX: Use createTransport (not createTransporter)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Verify transporter configuration
transporter.verify(function (error, success) {
  if (error) {
    console.log('❌ Email transporter error:', error);
  } else {
    console.log('✅ Email server is ready to send messages');
  }
});

const sendUserBookingEmail = async (email, bookingData) => {
  try {
    console.log('📤 Attempting to send email to:', email);
    
    const subject = `🎫 Ticket Confirmed - PNR: ${bookingData.pnr_no}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; border-radius: 10px;">
        <h2 style="color: #2E86AB;">🎫 Railway Ticket Confirmed!</h2>
        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
          <p><strong>PNR:</strong> ${bookingData.pnr_no}</p>
          <p><strong>Passenger:</strong> ${bookingData.passenger_name}</p>
          <p><strong>Train:</strong> ${bookingData.train_no}</p>
          <p><strong>Route:</strong> ${bookingData.from_station} to ${bookingData.to_station}</p>
          <p><strong>Journey Date:</strong> ${new Date(bookingData.journey_date).toLocaleDateString()}</p>
          <p><strong>Class:</strong> ${bookingData.class_name}</p>
          <p><strong>Seat:</strong> ${bookingData.seat_type}</p>
          <p><strong>Fare Paid:</strong> ₹${bookingData.fare}</p>
          <p><strong>Status:</strong> ${bookingData.status}</p>
        </div>
        <p style="color: #666; margin-top: 20px;">Thank you for choosing our railway service! 🚆</p>
      </div>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: subject,
      html: html
    };

    console.log('📨 Sending email with options:', {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject
    });

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully! Message ID:', result.messageId);
    return true;
    
  } catch (error) {
    console.log('❌ Email sending failed with error:', error.message);
    console.log('🔍 Full error details:', error);
    return false;
  }
};

const sendUserCancellationEmail = async (email, cancelData) => {
  try {
    const subject = `❌ Ticket Cancelled - PNR: ${cancelData.pnr_no}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; border-radius: 10px;">
        <h2 style="color: #e74c3c;">❌ Ticket Cancellation Confirmed</h2>
        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
          <p><strong>PNR:</strong> ${cancelData.pnr_no}</p>
          <p><strong>Passenger:</strong> ${cancelData.passenger_name}</p>
          <p><strong>Train:</strong> ${cancelData.train_no}</p>
          <p><strong>Route:</strong> ${cancelData.from_station} to ${cancelData.to_station}</p>
          <p><strong>Original Amount:</strong> ₹${cancelData.original_amount}</p>
          <p><strong>Refund Amount:</strong> ₹${cancelData.refund_amount}</p>
          <p><strong>Cancelled at:</strong> ${new Date(cancelData.cancellation_time).toLocaleString()}</p>
        </div>
        <p style="color: #666; margin-top: 20px;">Refund will be processed within 5-7 business days.</p>
      </div>
    `;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: subject,
      html: html
    });
    
    console.log('✅ User cancellation email sent to:', email);
    return true;
  } catch (error) {
    console.log('❌ Cancellation email failed:', error.message);
    return false;
  }
};

// Add these new functions to your existing userEmail.js

const sendEmployeeBookingEmail = async (email, bookingData) => {
  try {
    console.log('📤 Attempting to send EMPLOYEE booking email to:', email);
    
    const subject = `🎫 Employee Ticket Confirmed - PNR: ${bookingData.pnr_no}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #2E86AB; padding: 20px; border-radius: 10px; background: #f8f9fa;">
        <h2 style="color: #2E86AB;">🎫 Railway Ticket Confirmed (Employee Benefit)</h2>
        <div style="background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #2E86AB;">
          <p><strong>PNR:</strong> ${bookingData.pnr_no}</p>
          <p><strong>Passenger:</strong> ${bookingData.passenger_name}</p>
          <p><strong>Employee:</strong> ${bookingData.employee_name}</p>
          <p><strong>Passenger Type:</strong> ${bookingData.passenger_type}</p>
          <p><strong>Train:</strong> ${bookingData.train_no}</p>
          <p><strong>Route:</strong> ${bookingData.from_station} to ${bookingData.to_station}</p>
          <p><strong>Journey Date:</strong> ${new Date(bookingData.journey_date).toLocaleDateString()}</p>
          <p><strong>Class:</strong> ${bookingData.class_name}</p>
          <p><strong>Seat:</strong> ${bookingData.seat_type}</p>
          <p><strong>Original Fare:</strong> ₹${bookingData.original_fare}</p>
          <p><strong>Final Fare:</strong> <span style="color: green; font-weight: bold;">₹${bookingData.final_fare} (EMPLOYEE FREE TRAVEL)</span></p>
          <p><strong>Status:</strong> ${bookingData.status}</p>
          ${bookingData.waiting_list_position ? `<p><strong>Waiting List Position:</strong> ${bookingData.waiting_list_position}</p>` : ''}
        </div>
        <div style="background: #e8f5e8; padding: 10px; border-radius: 5px; margin-top: 15px;">
          <p style="color: #2d5016; margin: 0;">✅ <strong>Employee Benefit Applied:</strong> This ticket is provided free of cost as part of your employee benefits.</p>
        </div>
        <p style="color: #666; margin-top: 20px;">Thank you for your service! 🚆</p>
      </div>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: subject,
      html: html
    };

    console.log('📨 Sending EMPLOYEE email with options:', {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject
    });

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Employee booking email sent successfully! Message ID:', result.messageId);
    return true;
    
  } catch (error) {
    console.log('❌ Employee booking email failed with error:', error.message);
    return false;
  }
};

const sendEmployeeCancellationEmail = async (email, cancelData) => {
  try {
    const subject = `❌ Employee Ticket Cancelled - PNR: ${cancelData.pnr_no}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e74c3c; padding: 20px; border-radius: 10px; background: #fdf2f2;">
        <h2 style="color: #e74c3c;">❌ Employee Ticket Cancellation Confirmed</h2>
        <div style="background: white; padding: 15px; border-radius: 5px;">
          <p><strong>PNR:</strong> ${cancelData.pnr_no}</p>
          <p><strong>Passenger:</strong> ${cancelData.passenger_name}</p>
          <p><strong>Employee:</strong> ${cancelData.employee_name}</p>
          <p><strong>Train:</strong> ${cancelData.train_no}</p>
          <p><strong>Route:</strong> ${cancelData.from_station} to ${cancelData.to_station}</p>
          <p><strong>Original Amount:</strong> ₹${cancelData.original_amount} (Free for Employee)</p>
          <p><strong>Cancelled at:</strong> ${new Date(cancelData.cancellation_time).toLocaleString()}</p>
        </div>
        <div style="background: #fff3cd; padding: 10px; border-radius: 5px; margin-top: 15px;">
          <p style="color: #856404; margin: 0;">ℹ️ <strong>Note:</strong> Since this was a free employee ticket, no refund processing is required.</p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: subject,
      html: html
    });
    
    console.log('✅ Employee cancellation email sent to:', email);
    return true;
  } catch (error) {
    console.log('❌ Employee cancellation email failed:', error.message);
    return false;
  }
};

// Update your exports to include employee functions
module.exports = { 
  sendUserBookingEmail, 
  sendUserCancellationEmail,
  sendEmployeeBookingEmail,
  sendEmployeeCancellationEmail 
};