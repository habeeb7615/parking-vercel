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
  onConfirm: (data: { payment_amount: number; payment_method: string }) => void;
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
  
  // Clear error when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setErrorMessage('');
      setPaymentMethod('cash');
    }
  }, [isOpen]);
  
  // State for calculation retry
  const [calculationRetryCount, setCalculationRetryCount] = useState(0);
  const [calculationError, setCalculationError] = useState<string>('');
  const [isCalculating, setIsCalculating] = useState(false);
  const calculationTimestampRef = useRef<number>(0);
  
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
    
    // Validate payment amount
    const finalAmount = paymentMethod === 'free' ? 0 : calculation.amount;
    
    // If amount is 0 and payment method is not "free", show error
    if (calculation.amount === 0 && paymentMethod !== 'free') {
      setErrorMessage('Parking fee calculation resulted in ₹0.00. This may indicate missing or incorrect rates. Please contact your contractor.');
      return;
    }
    
    // If amount is negative, show error
    if (calculation.amount < 0) {
      setErrorMessage('Invalid parking fee calculation. Please try again.');
      return;
    }
    
    // Clear any previous errors
    setErrorMessage('');
    
    try {
      onConfirm({
        payment_amount: finalAmount,
        payment_method: paymentMethod
      });
    } catch (error) {
      console.error('CheckoutDialog: Error in handleConfirm', error);
      setErrorMessage('An error occurred. Please try again.');
    }
  };

  // Show loading state if calculation is not ready
  if (!vehicle) {
    return null;
  }
  
  if (!contractorRates) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Check Out Vehicle</DialogTitle>
            <DialogDescription>
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Check Out Vehicle</DialogTitle>
            <DialogDescription>
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Check Out Vehicle</DialogTitle>
          <DialogDescription>
            Review parking details and complete payment
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Vehicle Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center space-x-2">
                {vehicle.vehicle_type === '2-wheeler' ? (
                  <Bike className="h-5 w-5" />
                ) : (
                  <Car className="h-5 w-5" />
                )}
                <span>{vehicle.plate_number}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2 text-sm">
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
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center space-x-2">
                  <Clock className="h-5 w-5" />
                  <span>Parking Details</span>
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCalculationRetryCount(prev => prev + 1);
                    setCalculationError('');
                  }}
                  disabled={isCalculating}
                  className="h-8 w-8 p-0"
                  title="Refresh calculation"
                >
                  <RefreshCw className={`h-4 w-4 ${isCalculating ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Duration:</span>
                  <span className="font-mono text-lg font-bold">
                    {calculation.duration.formatted}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Rate:</span>
                  <span className="text-sm">{calculation.breakdown}</span>
                </div>
                <div className="border-t pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold">Total Amount:</span>
                    <span className={`text-2xl font-bold ${paymentMethod === 'free' ? 'text-orange-600' : 'text-green-600'}`}>
                      {paymentMethod === 'free' ? '₹0.00 (Free)' : `₹${calculation.amount.toFixed(2)}`}
                    </span>
                  </div>
                  {paymentMethod === 'free' && calculation.amount > 0 && (
                    <div className="text-xs text-muted-foreground mt-1 text-right">
                      Calculated: ₹{calculation.amount.toFixed(2)}
                    </div>
                  )}
                  {calculation.amount === 0 && paymentMethod !== 'free' && (
                    <div className="text-xs text-red-600 mt-1 text-right">
                      ⚠️ Warning: Amount is ₹0.00
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Method */}
          <div>
            <Label className="text-base font-semibold mb-3 block">Payment Method</Label>
            <Select value={paymentMethod} onValueChange={(value) => {
              setPaymentMethod(value);
              setErrorMessage(''); // Clear error when payment method changes
            }}>
              <SelectTrigger>
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
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600">{errorMessage}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-center space-x-3 pt-4">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirm} 
              disabled={loading || (calculation.amount === 0 && paymentMethod !== 'free')}
              className="bg-green-600 hover:bg-green-700"
            >
              {loading ? 'Processing...' : 'Confirm Checkout'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
