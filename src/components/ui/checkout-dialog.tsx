import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './dialog';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Clock, Car, Bike, RefreshCw } from 'lucide-react';
import { calculateParkingFee, ParkingRates } from '../../utils/parkingCalculator';
import { formatDateTime } from '../../utils/dateUtils';

interface Vehicle {
  id: string;
  plate_number: string;
  vehicle_type: '2-wheeler' | '4-wheeler';
  check_in_time: string;
  location?: {
    locations_name: string;
    address: string;
  };
}

interface CheckoutDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: { payment_amount: number; calculated_amount?: number; payment_method: string }) => void;
  vehicle: Vehicle | null;
  contractorRates: {
    rates_2wheeler: ParkingRates;
    rates_4wheeler: ParkingRates;
  } | null;
  loading?: boolean;
}

export function CheckoutDialog({
  isOpen,
  onClose,
  onConfirm,
  vehicle,
  contractorRates,
  loading = false
}: CheckoutDialogProps) {
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [manualAmount, setManualAmount] = useState<string>('');
  const [useManualAmount, setUseManualAmount] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  
  // State for calculation retry
  const [calculationRetryCount, setCalculationRetryCount] = useState(0);
  const [calculationError, setCalculationError] = useState<string>('');
  const [isCalculating, setIsCalculating] = useState(false);
  const calculationTimestampRef = useRef<number>(0);
  
  // Reset processing state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setIsProcessing(false);
    }
  }, [isOpen]);

  // Use useMemo to prevent hydration errors - only calculate when dialog is open and data is available
  const calculation = useMemo(() => {
    // Mark calculation start
    setIsCalculating(true);
    calculationTimestampRef.current = Date.now();
    // Clear previous errors when recalculating
    setCalculationError('');
    
    console.log('CheckoutDialog: Calculation useMemo triggered', { 
      isOpen, 
      vehicle: !!vehicle, 
      contractorRates: !!contractorRates,
      retryCount: calculationRetryCount
    });
    
    if (!isOpen || !vehicle || !contractorRates) {
      console.log('CheckoutDialog: Missing required data', { 
        isOpen, 
        hasVehicle: !!vehicle, 
        hasContractorRates: !!contractorRates 
      });
      return null;
    }
    
    // Validate vehicle has required fields
    if (!vehicle.check_in_time || !vehicle.vehicle_type) {
      const error = 'Vehicle data is incomplete. Missing check-in time or vehicle type.';
      console.error('CheckoutDialog:', error);
      setCalculationError(error);
      return null;
    }
    
    try {
      // Get rates based on vehicle type
      const rates = vehicle.vehicle_type === '2-wheeler' 
        ? contractorRates.rates_2wheeler 
        : contractorRates.rates_4wheeler;
      
      console.log('CheckoutDialog: Selected rates', { 
        vehicleType: vehicle.vehicle_type, 
        rates,
        hasRates: !!rates,
        ratesType: typeof rates
      });
      
      if (!rates) {
        const error = `Parking rates not configured for ${vehicle.vehicle_type}. Please contact your contractor.`;
        console.error('CheckoutDialog: Rates are null or undefined', { 
          vehicleType: vehicle.vehicle_type,
          contractorRates 
        });
        setCalculationError(error);
        return null;
      }
      
      // Validate rates is an object
      if (typeof rates !== 'object' || Array.isArray(rates)) {
        const error = 'Invalid rates structure. Rates must be an object.';
        console.error('CheckoutDialog: Rates is not an object', rates);
        setCalculationError(error);
        return null;
      }
      
      // Check if rates have required properties with better validation
      const requiredFields = ['upTo2Hours', 'upTo6Hours', 'upTo12Hours', 'upTo24Hours'];
      const missingFields = requiredFields.filter(field => 
        rates[field as keyof typeof rates] === undefined || rates[field as keyof typeof rates] === null
      );
      
      if (missingFields.length > 0) {
        const error = `Rates structure is invalid. Missing fields: ${missingFields.join(', ')}`;
        console.error('CheckoutDialog: Rates structure is invalid', { rates, missingFields });
        setCalculationError(error);
        return null;
      }
      
      // Validate rate values are numbers
      for (const field of requiredFields) {
        const value = rates[field as keyof typeof rates];
        if (typeof value !== 'number' || !isFinite(value) || value < 0) {
          const error = `Invalid rate value for ${field}: ${value}. Must be a valid positive number.`;
          console.error('CheckoutDialog:', error);
          setCalculationError(error);
          return null;
        }
      }
      
      // Check if all rates are zero (which would result in 0 payment)
      const allRatesZero = rates.upTo2Hours === 0 && 
                          rates.upTo6Hours === 0 && 
                          rates.upTo12Hours === 0 && 
                          rates.upTo24Hours === 0;
      
      if (allRatesZero) {
        console.warn('CheckoutDialog: All rates are set to 0', rates);
        // Still allow calculation but it will result in 0
      }
      
      // Get current time with multiple attempts to ensure accuracy
      let checkOutTime: string;
      try {
        // Use Date.now() for better precision and avoid timezone issues
        const currentTime = Date.now();
        
        // Validate current time is reasonable (not too far in past/future)
        const now = new Date();
        const maxPastTime = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
        const maxFutureTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour in future
        
        if (currentTime < maxPastTime.getTime() || currentTime > maxFutureTime.getTime()) {
          console.warn('CheckoutDialog: System time may be incorrect', {
            currentTime: new Date(currentTime).toISOString(),
            now: now.toISOString()
          });
        }
        
        checkOutTime = new Date(currentTime).toISOString();
      } catch (timeError) {
        const error = 'Failed to get current time. Please refresh the page.';
        console.error('CheckoutDialog: Error getting current time:', timeError);
        setCalculationError(error);
        return null;
      }
      
      // Validate check-in time format
      let checkInTime: string;
      try {
        const checkInDate = new Date(vehicle.check_in_time);
        if (isNaN(checkInDate.getTime())) {
          const error = `Invalid check-in time format: ${vehicle.check_in_time}`;
          console.error('CheckoutDialog:', error);
          setCalculationError(error);
          return null;
        }
        checkInTime = vehicle.check_in_time;
      } catch (dateError) {
        const error = `Invalid check-in time: ${vehicle.check_in_time}`;
        console.error('CheckoutDialog: Error parsing check-in time:', dateError);
        setCalculationError(error);
        return null;
      }
      
      console.log('CheckoutDialog: Calling calculateParkingFee', {
        checkInTime,
        checkOutTime,
        vehicleType: vehicle.vehicle_type,
        rates
      });
      
      // Perform calculation with error handling
      let result;
      try {
        result = calculateParkingFee(
          checkInTime,
          checkOutTime,
          vehicle.vehicle_type,
          rates
        );
      } catch (calcError: any) {
        const error = calcError?.message || 'Failed to calculate parking fee. Please try again.';
        console.error('CheckoutDialog: Error in calculateParkingFee:', calcError);
        setCalculationError(error);
        return null;
      }
      
      // Validate result
      if (!result || typeof result.amount !== 'number' || !isFinite(result.amount)) {
        const error = 'Calculation returned invalid result. Please try again.';
        console.error('CheckoutDialog: Invalid calculation result', result);
        setCalculationError(error);
        return null;
      }
      
      // Validate amount is not negative
      if (result.amount < 0) {
        const error = 'Calculation resulted in negative amount. Please contact support.';
        console.error('CheckoutDialog: Negative amount calculated', result);
        setCalculationError(error);
        return null;
      }
      
      console.log('CheckoutDialog: Calculation successful', result);
      setIsCalculating(false);
      return result;
    } catch (error: any) {
      const errorMessage = error?.message || 'An unexpected error occurred during calculation. Please try again.';
      console.error('CheckoutDialog: Unexpected error calculating parking fee:', error);
      setCalculationError(errorMessage);
      setIsCalculating(false);
      return null;
    }
  }, [isOpen, vehicle, contractorRates, calculationRetryCount]);
  
  // Clear error when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setErrorMessage('');
      setPaymentMethod('cash');
      setManualAmount('');
      setUseManualAmount(false);
    }
  }, [isOpen]);
  
  // Reset manual amount when calculation changes
  useEffect(() => {
    if (calculation && !useManualAmount) {
      setManualAmount(calculation.amount.toFixed(2));
    }
  }, [calculation, useManualAmount]);
  
  // Auto-refresh calculation every 30 seconds when dialog is open to ensure accuracy
  useEffect(() => {
    if (!isOpen || !calculation) return;
    
    const interval = setInterval(() => {
      // Only refresh if calculation is more than 30 seconds old
      const age = Date.now() - calculationTimestampRef.current;
      if (age > 30000) {
        console.log('CheckoutDialog: Auto-refreshing calculation after 30 seconds');
        setCalculationRetryCount(prev => prev + 1);
      }
    }, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, [isOpen, calculation]);

  const handleConfirm = () => {
    console.log('CheckoutDialog: handleConfirm called', { calculation, vehicle, contractorRates, paymentMethod });
    
    if (!calculation) {
      console.error('CheckoutDialog: Calculation is null, cannot proceed');
      setErrorMessage('Unable to calculate parking fee. Please try again.');
      return;
    }
    
    if (!vehicle) {
      console.error('CheckoutDialog: Vehicle is null, cannot proceed');
      setErrorMessage('Vehicle information is missing. Please try again.');
      return;
    }
    
    // Determine final amount - use manual amount if enabled, otherwise use calculated
    let finalAmount: number;
    
    if (paymentMethod === 'free') {
      finalAmount = 0;
    } else if (useManualAmount && manualAmount.trim()) {
      // Validate manual amount
      const parsedAmount = parseFloat(manualAmount);
      if (isNaN(parsedAmount) || !isFinite(parsedAmount)) {
        setErrorMessage('Please enter a valid amount.');
        return;
      }
      if (parsedAmount < 0) {
        setErrorMessage('Amount cannot be negative.');
        return;
      }
      if (parsedAmount > calculation.amount * 2) {
        setErrorMessage(`Amount (₹${parsedAmount.toFixed(2)}) is more than double the calculated amount (₹${calculation.amount.toFixed(2)}). Please verify.`);
        return;
      }
      finalAmount = Math.round(parsedAmount * 100) / 100; // Round to 2 decimal places
    } else {
      finalAmount = calculation.amount;
    }
    
    // If amount is 0 and payment method is not "free", show error
    if (finalAmount === 0 && paymentMethod !== 'free') {
      setErrorMessage('Payment amount cannot be ₹0.00. Please enter a valid amount or select "Free" payment method.');
      return;
    }
    
    // Clear any previous errors
    setErrorMessage('');
    
    // Set processing state immediately
    setIsProcessing(true);
    
    try {
      onConfirm({
        payment_amount: finalAmount,
        calculated_amount: calculation.amount, // Send calculated amount for tracking
        payment_method: paymentMethod
      });
    } catch (error) {
      console.error('CheckoutDialog: Error in handleConfirm', error);
      setErrorMessage('An error occurred. Please try again.');
      setIsProcessing(false);
    }
  };

  // Show loading state if calculation is not ready
  if (!vehicle) {
    return null;
  }
  
  if (!contractorRates) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl sm:text-2xl font-bold">Check Out Vehicle</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Error: Contractor rates not available
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 text-center text-red-600">
            Unable to calculate parking fee. Please try again.
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
  
  if (!calculation) {
    // Check if it's a data issue or calculation issue
    const hasRates = contractorRates && (
      (vehicle?.vehicle_type === '2-wheeler' && contractorRates.rates_2wheeler) ||
      (vehicle?.vehicle_type === '4-wheeler' && contractorRates.rates_4wheeler)
    );
    
    // Check if we have a specific error message
    const hasError = calculationError && calculationError.length > 0;
    
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl sm:text-2xl font-bold">Check Out Vehicle</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {hasError ? 'Calculation Error' : hasRates ? 'Calculating parking fee...' : 'Error: Parking rates not configured'}
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 text-center">
            {hasError ? (
              <>
                <div className="text-red-600 mb-4">
                  <p className="font-semibold mb-2">Calculation Failed</p>
                  <p className="text-sm">{calculationError}</p>
                </div>
                <div className="flex justify-center space-x-3">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setCalculationRetryCount(prev => prev + 1);
                      setCalculationError('');
                    }}
                    disabled={isCalculating}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isCalculating ? 'animate-spin' : ''}`} />
                    Retry Calculation
                  </Button>
                  <Button variant="outline" onClick={onClose}>
                    Close
                  </Button>
                </div>
              </>
            ) : hasRates ? (
              <>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-parkflow-blue mx-auto"></div>
                <p className="mt-4 text-muted-foreground">Please wait...</p>
                {calculationRetryCount > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Retrying calculation... (Attempt {calculationRetryCount + 1})
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="text-red-600 mb-4">
                  <p className="font-semibold">Unable to calculate parking fee</p>
                  <p className="text-sm mt-2">Parking rates are not configured for this vehicle type.</p>
                  <p className="text-xs mt-2 text-muted-foreground">
                    Please contact your contractor to set up parking rates.
                  </p>
                </div>
                <Button variant="outline" onClick={onClose}>
                  Close
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl sm:text-2xl font-bold">Check Out Vehicle</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Review parking details and complete payment
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6">
          {/* Vehicle Info */}
          <Card>
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-base sm:text-lg flex items-center space-x-2">
                {vehicle.vehicle_type === '2-wheeler' ? (
                  <Bike className="h-4 w-4 sm:h-5 sm:w-5" />
                ) : (
                  <Car className="h-4 w-4 sm:h-5 sm:w-5" />
                )}
                <span className="text-sm sm:text-base">{vehicle.plate_number}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type:</span>
                  <span className="font-medium">{vehicle.vehicle_type}</span>
                </div>
                {vehicle.location && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Location:</span>
                    <span className="font-medium">{vehicle.location.locations_name}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Check In:</span>
                  <span className="font-medium">
                    {formatDateTime(vehicle.check_in_time)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Duration & Amount */}
          <Card>
            <CardHeader className="pb-2 sm:pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base sm:text-lg flex items-center space-x-2">
                  <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="text-sm sm:text-base">Parking Details</span>
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCalculationRetryCount(prev => prev + 1);
                    setCalculationError('');
                  }}
                  disabled={isCalculating}
                  className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                  title="Refresh calculation"
                >
                  <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 ${isCalculating ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2 sm:space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-xs sm:text-sm">Duration:</span>
                  <span className="font-mono text-base sm:text-lg font-bold">
                    {calculation.duration.formatted}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-xs sm:text-sm">Rate:</span>
                  <span className="text-xs sm:text-sm">{calculation.breakdown}</span>
                </div>
                <div className="border-t pt-2 sm:pt-3 space-y-2 sm:space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm sm:text-lg font-semibold">Calculated Amount:</span>
                    <span className="text-base sm:text-xl font-bold text-blue-600">
                      ₹{calculation.amount.toFixed(2)}
                    </span>
                  </div>
                  
                  {/* Manual Amount Override */}
                  <div className="space-y-1.5 sm:space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="useManualAmount"
                        checked={useManualAmount}
                        onChange={(e) => {
                          setUseManualAmount(e.target.checked);
                          if (e.target.checked && !manualAmount) {
                            setManualAmount(calculation.amount.toFixed(2));
                          }
                        }}
                        className="h-3.5 w-3.5 sm:h-4 sm:w-4 rounded border-gray-300"
                      />
                      <Label htmlFor="useManualAmount" className="text-xs sm:text-sm font-medium cursor-pointer">
                        Enter manual amount (if different)
                      </Label>
                    </div>
                    
                    {useManualAmount && (
                      <div className="space-y-1">
                        <Label htmlFor="manualAmount" className="text-xs sm:text-sm text-muted-foreground">
                          Actual Received Amount
                        </Label>
                        <Input
                          id="manualAmount"
                          type="number"
                          step="0.01"
                          min="0"
                          value={manualAmount}
                          onChange={(e) => {
                            const value = e.target.value;
                            // Allow empty, numbers, and one decimal point
                            if (value === '' || /^\d*\.?\d*$/.test(value)) {
                              setManualAmount(value);
                              setErrorMessage('');
                            }
                          }}
                          placeholder={`Enter amount (Calculated: ₹${calculation.amount.toFixed(2)})`}
                          className="w-full text-xs sm:text-sm h-8 sm:h-10"
                        />
                        {useManualAmount && manualAmount && parseFloat(manualAmount) !== calculation.amount && (
                          <div className="text-xs text-muted-foreground">
                            Difference: ₹{Math.abs(parseFloat(manualAmount) - calculation.amount).toFixed(2)}
                            {parseFloat(manualAmount) < calculation.amount && (
                              <span className="text-orange-600 ml-1">(Discount/Partial Payment)</span>
                            )}
                            {parseFloat(manualAmount) > calculation.amount && (
                              <span className="text-green-600 ml-1">(Extra Payment)</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="border-t pt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm sm:text-lg font-semibold">Amount to Charge:</span>
                      <span className={`text-lg sm:text-2xl font-bold ${
                        paymentMethod === 'free' ? 'text-orange-600' : 
                        useManualAmount && manualAmount ? 'text-purple-600' : 'text-green-600'
                      }`}>
                        {paymentMethod === 'free' ? '₹0.00 (Free)' : 
                         useManualAmount && manualAmount ? `₹${parseFloat(manualAmount || '0').toFixed(2)}` : 
                         `₹${calculation.amount.toFixed(2)}`}
                      </span>
                    </div>
                    {useManualAmount && manualAmount && parseFloat(manualAmount) !== calculation.amount && (
                      <div className="text-xs text-muted-foreground mt-1 text-right">
                        Calculated: ₹{calculation.amount.toFixed(2)} | Received: ₹{parseFloat(manualAmount || '0').toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Method */}
          <div>
            <Label className="text-sm sm:text-base font-semibold mb-2 sm:mb-3 block">Payment Method</Label>
            <Select value={paymentMethod} onValueChange={(value) => {
              setPaymentMethod(value);
              setErrorMessage(''); // Clear error when payment method changes
            }}>
              <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="digital">Digital Payment</SelectItem>
                <SelectItem value="free">Free</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2 sm:p-3">
              <p className="text-xs sm:text-sm text-red-600">{errorMessage}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-3 pt-3 sm:pt-4">
            <Button variant="outline" onClick={onClose} disabled={loading || isProcessing} className="w-full sm:w-auto text-xs sm:text-sm h-9 sm:h-10">
              Cancel
            </Button>
            <Button 
              onClick={handleConfirm} 
              disabled={
                loading || 
                isProcessing ||
                (calculation.amount === 0 && paymentMethod !== 'free') ||
                (useManualAmount && (!manualAmount || parseFloat(manualAmount || '0') < 0))
              }
              className="bg-green-600 hover:bg-green-700 w-full sm:w-auto text-xs sm:text-sm h-9 sm:h-10"
            >
              {(loading || isProcessing) ? 'Processing...' : 'Confirm Checkout'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
