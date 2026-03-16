const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: true
  },
  date: {
    type: Date,
    required: true,
    validate: {
      validator: function(value) {
        // Prevent future dates (allow current date)
        const today = new Date();
        today.setHours(23, 59, 59, 999); // End of today
        return value <= today;
      },
      message: 'Attendance date cannot be in the future'
    }
  },
  checkIn: {
    type: Date,
    validate: {
      validator: function(value) {
        if (!value) return true; // Optional field
        // Check-in should be on the same date as attendance date
        const attendanceDate = new Date(this.date);
        const checkInDate = new Date(value);
        return attendanceDate.toDateString() === checkInDate.toDateString();
      },
      message: 'Check-in time must be on the same date as attendance date'
    }
  },
  checkOut: {
    type: Date,
    validate: {
      validator: function(value) {
        if (!value) return true; // Optional field
        // Check-out should be after check-in
        if (this.checkIn && value <= this.checkIn) {
          return false;
        }
        return true;
      },
      message: 'Check-out time must be after check-in time'
    }
  },
  status: {
    type: String,
    enum: ['present', 'absent', 'late', 'half-day', 'on-leave'],
    default: 'absent'
  },
  lateMinutes: {
    type: Number,
    default: 0
  },
  workingHours: {
    type: Number,
    default: 0
  },
  earlyLeave: {
    isAllowed: { type: Boolean, default: false },
    reason: { type: String, default: 'Late check-in compensation' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    approvedAt: { type: Date }
  },
  holidayInfo: {
    isHoliday: { type: Boolean, default: false },
    holidayName: { type: String },
    isPaid: { type: Boolean, default: false }
  },
  location: {
    type: String
  },
  modifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff'
  }
}, {
  timestamps: true
});

attendanceSchema.index({ staffId: 1, date: 1 }, { unique: true });
attendanceSchema.index({ date: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);