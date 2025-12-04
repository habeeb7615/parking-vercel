export interface ParkingRates {
  upTo2Hours: number;
  upTo6Hours: number;
  upTo12Hours: number;
  upTo24Hours: number;
}

export interface ParkingCalculation {
  duration: {
    hours: number;
    minutes: number;
    seconds: number;
    totalHours: number;
    formatted: string; // HH:MM:SS format
  };
  amount: number;
  breakdown: string;
}

/**
 * Validate parking rates structure
 */
function validateRates(rates: ParkingRates): { valid: boolean; error?: string } {
  if (!rates || typeof rates !== 'object') {
    return { valid: false, error: 'Rates object is missing or invalid' };
  }
  
  const requiredFields: (keyof ParkingRates)[] = ['upTo2Hours', 'upTo6Hours', 'upTo12Hours', 'upTo24Hours'];
  
  for (const field of requiredFields) {
    if (rates[field] === undefined || rates[field] === null) {
      return { valid: false, error: `Rate field '${field}' is missing` };
    }
    
    if (typeof rates[field] !== 'number') {
      return { valid: false, error: `Rate field '${field}' must be a number` };
    }
    
    if (rates[field] < 0 || !isFinite(rates[field])) {
      return { valid: false, error: `Rate field '${field}' must be a valid positive number` };
    }
  }
  
  // Validate rate progression (optional but recommended)
  if (rates.upTo2Hours > rates.upTo6Hours || 
      rates.upTo6Hours > rates.upTo12Hours || 
      rates.upTo12Hours > rates.upTo24Hours) {
    console.warn('Parking rates are not in ascending order. This may be intentional.');
  }
  
  return { valid: true };
}

/**
 * Validate and parse date strings
 */
function validateAndParseDate(dateString: string, fieldName: string): { valid: boolean; date?: Date; error?: string } {
  if (!dateString || typeof dateString !== 'string') {
    return { valid: false, error: `${fieldName} is missing or invalid` };
  }
  
  const date = new Date(dateString);
  
  if (isNaN(date.getTime())) {
    return { valid: false, error: `${fieldName} is not a valid date: ${dateString}` };
  }
  
  return { valid: true, date };
}

/**
 * Calculate parking duration and amount based on rates
 * This function is bulletproof with comprehensive validation and error handling
 */
export function calculateParkingFee(
  checkInTime: string,
  checkOutTime: string,
  vehicleType: '2-wheeler' | '4-wheeler',
  rates: ParkingRates
): ParkingCalculation {
  // Validate vehicle type
  if (vehicleType !== '2-wheeler' && vehicleType !== '4-wheeler') {
    throw new Error(`Invalid vehicle type: ${vehicleType}. Must be '2-wheeler' or '4-wheeler'`);
  }
  
  // Validate rates
  const ratesValidation = validateRates(rates);
  if (!ratesValidation.valid) {
    throw new Error(`Invalid parking rates: ${ratesValidation.error}`);
  }
  
  // Validate and parse check-in time
  const checkInValidation = validateAndParseDate(checkInTime, 'Check-in time');
  if (!checkInValidation.valid || !checkInValidation.date) {
    throw new Error(`Invalid check-in time: ${checkInValidation.error}`);
  }
  const checkIn = checkInValidation.date;
  
  // Validate and parse check-out time
  const checkOutValidation = validateAndParseDate(checkOutTime, 'Check-out time');
  if (!checkOutValidation.valid || !checkOutValidation.date) {
    throw new Error(`Invalid check-out time: ${checkOutValidation.error}`);
  }
  const checkOut = checkOutValidation.date;
  
  // Calculate duration in milliseconds
  const durationMs = checkOut.getTime() - checkIn.getTime();
  
  // Validate duration is not negative
  if (durationMs < 0) {
    throw new Error(`Invalid duration: Check-out time (${checkOutTime}) is before check-in time (${checkInTime})`);
  }
  
  // Validate duration is not too large (more than 1 year = suspicious)
  const maxDurationMs = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
  if (durationMs > maxDurationMs) {
    throw new Error(`Invalid duration: Duration exceeds 1 year. Check-in: ${checkInTime}, Check-out: ${checkOutTime}`);
  }
  
  // Convert to hours, minutes, seconds with proper rounding
  const totalHours = durationMs / (1000 * 60 * 60);
  const hours = Math.floor(totalHours);
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);
  
  // Validate calculated values
  if (!isFinite(totalHours) || !isFinite(hours) || !isFinite(minutes) || !isFinite(seconds)) {
    throw new Error('Duration calculation resulted in invalid values');
  }
  
  // Format as HH:MM:SS
  const formatted = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  
  // Calculate amount based on duration and vehicle type
  let amount = 0;
  let breakdown = '';
  
  // Handle edge case: duration is 0 or very small (less than 1 minute)
  if (totalHours < 1 / 60) {
    // Less than 1 minute - charge minimum rate (upTo2Hours)
    amount = rates.upTo2Hours;
    breakdown = `Less than 1 minute: ₹${rates.upTo2Hours} (minimum charge)`;
  } else if (totalHours <= 2) {
    amount = rates.upTo2Hours;
    breakdown = `Up to 2 hours: ₹${rates.upTo2Hours}`;
  } else if (totalHours <= 6) {
    amount = rates.upTo6Hours;
    breakdown = `Up to 6 hours: ₹${rates.upTo6Hours}`;
  } else if (totalHours <= 12) {
    amount = rates.upTo12Hours;
    breakdown = `Up to 12 hours: ₹${rates.upTo12Hours}`;
  } else if (totalHours <= 24) {
    amount = rates.upTo24Hours;
    breakdown = `Up to 24 hours: ₹${rates.upTo24Hours}`;
  } else {
    // For more than 24 hours, charge daily rate + hourly rate for additional time
    const days = Math.floor(totalHours / 24);
    const remainingHours = totalHours % 24;
    
    // Validate calculations
    if (!isFinite(days) || !isFinite(remainingHours)) {
      throw new Error('Invalid calculation for duration exceeding 24 hours');
    }
    
    const dailyAmount = days * rates.upTo24Hours;
    const hourlyRate = rates.upTo24Hours / 24;
    const additionalAmount = remainingHours * hourlyRate;
    amount = dailyAmount + additionalAmount;
    
    breakdown = `${days} day(s) × ₹${rates.upTo24Hours} + ${remainingHours.toFixed(1)}h × ₹${hourlyRate.toFixed(2)}/h = ₹${amount.toFixed(2)}`;
  }
  
  // Final validation of amount
  if (!isFinite(amount) || amount < 0) {
    throw new Error(`Invalid calculated amount: ${amount}`);
  }
  
  // Round to 2 decimal places with proper handling
  const roundedAmount = Math.round(amount * 100) / 100;
  
  // Final validation of rounded amount
  if (!isFinite(roundedAmount) || roundedAmount < 0) {
    throw new Error(`Invalid rounded amount: ${roundedAmount}`);
  }
  
  return {
    duration: {
      hours: Math.max(0, hours), // Ensure non-negative
      minutes: Math.max(0, minutes), // Ensure non-negative
      seconds: Math.max(0, seconds), // Ensure non-negative
      totalHours: Math.max(0, totalHours), // Ensure non-negative
      formatted
    },
    amount: roundedAmount,
    breakdown
  };
}

/**
 * Format duration in a human-readable way
 */
export function formatDuration(hours: number, minutes: number, seconds: number): string {
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Get default rates for testing
 */
export function getDefaultRates(vehicleType: '2-wheeler' | '4-wheeler'): ParkingRates {
  if (vehicleType === '2-wheeler') {
    return {
      upTo2Hours: 2,
      upTo6Hours: 5,
      upTo12Hours: 8,
      upTo24Hours: 12
    };
  } else {
    return {
      upTo2Hours: 5,
      upTo6Hours: 10,
      upTo12Hours: 18,
      upTo24Hours: 30
    };
  }
}
