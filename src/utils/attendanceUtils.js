class AttendanceUtils {
  static normalizeDate(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  static getCurrentDate() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  static calculateWorkingHours(checkIn, checkOut) {
    if (!checkIn || !checkOut) return 0;
    const hours = (new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60);
    return Math.round(hours * 100) / 100;
  }

  static determineStatus(checkIn, checkOut, scheduledStart, standardHours = 8) {
    // Manual status override takes precedence (handled in controller)
    
    // No check-in = absent
    if (!checkIn) return 'absent';
    
    // Check if late (more than 15 min after scheduled start)
    let isLate = false;
    if (scheduledStart) {
      const lateThreshold = new Date(scheduledStart.getTime() + 15 * 60 * 1000);
      if (new Date(checkIn) > lateThreshold) {
        isLate = true;
      }
    }
    
    // If checked out, determine final status based on hours worked
    if (checkOut) {
      const workingHours = this.calculateWorkingHours(checkIn, checkOut);
      
      // Less than half standard hours = half-day (regardless of late)
      if (workingHours < standardHours / 2) {
        return 'half-day';
      }
      
      // Worked sufficient hours but was late
      if (isLate) {
        return 'late';
      }
      
      // Worked sufficient hours and on time
      return 'present';
    }
    
    // Only checked in (no checkout yet)
    // Return late if applicable, otherwise present
    return isLate ? 'late' : 'present';
  }

  static getScheduledShift(staff, date) {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[new Date(date).getDay()];
    
    if (staff.shiftSchedule?.type === 'fixed' && staff.shiftSchedule.fixedShift) {
      const { startTime, endTime, workingDays } = staff.shiftSchedule.fixedShift;
      
      if (workingDays.includes(dayName)) {
        const scheduledStart = new Date(date);
        scheduledStart.setHours(parseInt(startTime.split(':')[0]), parseInt(startTime.split(':')[1]), 0, 0);
        
        return {
          startTime,
          endTime,
          scheduledStart
        };
      }
    }
    
    if (staff.shifts) {
      const dateStr = new Date(date).toISOString().split('T')[0];
      const specificShift = staff.shifts.find(shift => 
        new Date(shift.date).toISOString().split('T')[0] === dateStr
      );
      
      if (specificShift) {
        const scheduledStart = new Date(date);
        scheduledStart.setHours(parseInt(specificShift.startTime.split(':')[0]), parseInt(specificShift.startTime.split(':')[1]), 0, 0);
        
        return {
          startTime: specificShift.startTime,
          endTime: specificShift.endTime,
          scheduledStart
        };
      }
    }
    
    return null;
  }

  static validateAttendanceDate(date) {
    const targetDate = new Date(date);
    const currentDate = new Date();
    
    // Reset time to compare only dates
    targetDate.setHours(0, 0, 0, 0);
    currentDate.setHours(0, 0, 0, 0);
    
    return {
      isValid: targetDate <= currentDate,
      isFuture: targetDate > currentDate,
      isPast: targetDate < currentDate,
      isToday: targetDate.getTime() === currentDate.getTime()
    };
  }

  static validateCheckInOut(checkIn, checkOut) {
    if (!checkIn && !checkOut) return { isValid: true };
    
    const checkInTime = checkIn ? new Date(checkIn) : null;
    const checkOutTime = checkOut ? new Date(checkOut) : null;
    
    const errors = [];
    
    if (checkInTime && isNaN(checkInTime.getTime())) {
      errors.push('Invalid check-in time format');
    }
    
    if (checkOutTime && isNaN(checkOutTime.getTime())) {
      errors.push('Invalid check-out time format');
    }
    
    if (checkInTime && checkOutTime && checkOutTime <= checkInTime) {
      errors.push('Check-out time must be after check-in time');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = AttendanceUtils;