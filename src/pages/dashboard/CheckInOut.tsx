import { useState, useEffect, useRef, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckoutDialog } from "@/components/ui/checkout-dialog";
import { CheckoutSuccessDialog } from "@/components/ui/checkout-success-dialog";
import { ConfirmCheckoutDialog } from "@/components/ui/confirm-checkout-dialog";
import { 
  UserPlus, 
  Car, 
  MapPin, 
  XCircle, 
  Camera,
  ArrowRight,
  Bike,
  Search
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { VehicleAPI, type Vehicle, type CreateVehicleData } from "@/services/vehicleApi";
import { AttendantAPI } from "@/services/attendantApi";
import { LocationAPI, type Location } from "@/services/locationApi";
import { ContractorAPI } from "@/services/contractorApi";
import { useAuth } from "@/contexts/AuthContext";
import { formatDateTime } from "@/utils/dateUtils";
import { checkAttendantContractorSubscription } from "@/utils/subscriptionUtils";
import { ImageCheckInDialog } from "@/components/vehicle/ImageCheckInDialog";

interface CheckInForm {
  plate_number: string;
  vehicle_type: '2-wheeler' | '4-wheeler';
  location_id: string;
}

interface CheckOutForm {
  vehicle_id: string;
  payment_method: 'cash' | 'card' | 'digital' | 'free';
}

export default function CheckInOut() {
  const { profile, user } = useAuth();
  const { toast } = useToast();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscriptionBlocked, setSubscriptionBlocked] = useState(false);
  
  // Check-in form state
  const [newVehicle, setNewVehicle] = useState<CreateVehicleData>({
    plate_number: '',
    vehicle_type: '2-wheeler',
    location_id: '',
    contractor_id: '',
    mobile_number: ''
  });
  const [processing, setProcessing] = useState(false);
  
  // Check-out modal
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [contractorRates, setContractorRates] = useState<any>(null);
  
  // Success modal
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [checkoutDetails, setCheckoutDetails] = useState<{
    paymentAmount: number;
    paymentMethod: string;
    duration: string;
  } | null>(null);
  
  // Search
  const [searchTerm, setSearchTerm] = useState("");
  
  // Image check-in dialog
  const [showImageCheckIn, setShowImageCheckIn] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [mobileNumberError, setMobileNumberError] = useState<string>('');

  // Track if data has been fetched to prevent unnecessary refreshes
  const dataFetchedRef = useRef(false);

  // Check if user is attendant
  if (profile?.role !== 'attendant') {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-red-600">Access Denied</h2>
        <p className="text-muted-foreground">Only attendants can access Check In/Out.</p>
      </div>
    );
  }

  // Check subscription status for attendants (non-blocking)
  useEffect(() => {
    if (profile?.role === 'attendant' && profile?.id) {
      // Run subscription check in background without blocking page load
      checkAttendantContractorSubscription(profile.id)
        .then((status) => {
          console.log('Subscription status for attendant:', status);
          if (status.isExpired || status.isSuspended) {
            setSubscriptionBlocked(true);
            toast({
              variant: "destructive",
              title: "Access Blocked",
              description: "Your contractor's subscription has expired. Please contact your contractor to recharge.",
            });
          }
        })
        .catch((error) => {
          console.error('Error checking subscription status:', error);
          // Don't block access if there's an error checking subscription
        });
    }
  }, [profile, toast]);

  const fetchData = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      
      // Get attendant's location
      const attendant = await AttendantAPI.getAttendantByUserId(user.id);
      if (!attendant || !attendant.location_id) {
        throw new Error('Attendant not assigned to any location');
      }

      // Get current location details
      const location = await LocationAPI.getLocationById(attendant.location_id);
      setCurrentLocation(location);

      // Set location for new vehicle
      setNewVehicle(prev => ({
        ...prev,
        location_id: location.id,
        contractor_id: location.contractor_id
      }));

      // Fetch contractor rates for checkout calculation
      if (location.contractor_id) {
        try {
          const contractor = await ContractorAPI.getContractorById(location.contractor_id);
          if (contractor) {
            let rates2w, rates4w;
            try {
              rates2w = typeof contractor.rates_2wheeler === 'string' 
                ? JSON.parse(contractor.rates_2wheeler) 
                : contractor.rates_2wheeler;
              rates4w = typeof contractor.rates_4wheeler === 'string' 
                ? JSON.parse(contractor.rates_4wheeler) 
                : contractor.rates_4wheeler;
            } catch (e) {
              console.error('Error parsing rates:', e);
              rates2w = contractor.rates_2wheeler ?? null;
              rates4w = contractor.rates_4wheeler ?? null;
            }
            
            setContractorRates({
              rates_2wheeler: rates2w,
              rates_4wheeler: rates4w
            });
          }
        } catch (error) {
          console.error('Error fetching contractor rates:', error);
        }
      }

      // Get vehicles for this location (parked vehicles only)
      const { VehicleAPI } = await import('@/services/vehicleApi');
      const allVehicles = await VehicleAPI.getVehiclesByLocation(attendant.location_id);
      
      // Ensure allVehicles is always an array
      const vehiclesArray = Array.isArray(allVehicles) ? allVehicles : [];
      
      // Filter only parked vehicles (check_out_time is null)
      const parkedVehicles = vehiclesArray.filter(v => !v.check_out_time).slice(0, 5);
      
      // Calculate actual occupied slots
      const totalParkedCount = vehiclesArray.filter(v => !v.check_out_time).length;
      setActualOccupiedSlots(totalParkedCount);

      setVehicles(parkedVehicles || []);
      
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to load data",
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch locations for image check-in
  const fetchLocations = async () => {
    try {
      const locationsData = await LocationAPI.getAllLocations();
      setLocations(locationsData);
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };

  // Handle plate detection
  const handlePlateDetected = (plateNumber: string) => {
    // Fill the plate number field with detected plate
    setNewVehicle(prev => ({
      ...prev,
      plate_number: plateNumber
    }));
    
    toast({
      title: "Plate Number Detected!",
      description: `License plate "${plateNumber}" has been filled in the form. Please complete the check-in process.`,
    });
  };

  useEffect(() => {
    if (user && !dataFetchedRef.current) {
      fetchData();
      fetchLocations();
      dataFetchedRef.current = true;
    }
  }, [user]);

  const validateMobileNumber = (value: string): string => {
    if (!value || value.trim() === '') {
      return ''; // Empty is allowed for optional field
    }
    // Only allow exactly 10 digits
    const digitsOnly = value.replace(/\D/g, '');
    
    if (digitsOnly.length !== 10) {
      return 'Mobile number must be exactly 10 digits (e.g., 9876543210)';
    }
    if (!/^\d{10}$/.test(digitsOnly)) {
      return 'Mobile number must contain only digits (e.g., 9876543210)';
    }
    return '';
  };

  const handleAddVehicle = async () => {
    // Set processing immediately to show loader
    setProcessing(true);
    
    try {
      // Validate required fields
      if (!newVehicle.plate_number || !newVehicle.vehicle_type) {
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: "Please fill in all required fields.",
        });
        setProcessing(false);
        return;
      }

      // Validate mobile number if provided
      const mobileError = validateMobileNumber(newVehicle.mobile_number || '');
      if (mobileError) {
        setMobileNumberError(mobileError);
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: mobileError,
        });
        setProcessing(false);
        return;
      }
      setMobileNumberError('');

      // Ensure location_id is set
      if (!newVehicle.location_id && currentLocation?.id) {
        setNewVehicle(prev => ({
          ...prev,
          location_id: currentLocation.id,
          contractor_id: currentLocation.contractor_id || prev.contractor_id
        }));
      }

      if (!newVehicle.location_id) {
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: "Location is required. Please select a location.",
        });
        setProcessing(false);
        return;
      }

      const vehicle = await VehicleAPI.createVehicle(newVehicle);
      setVehicles(prev => [vehicle, ...prev]);
      
      // Reset form
      setNewVehicle({
        plate_number: '',
        vehicle_type: '2-wheeler',
        location_id: currentLocation?.id || '',
        contractor_id: currentLocation?.contractor_id || '',
        mobile_number: ''
      });
      setMobileNumberError('');
      
      // Refresh occupancy count
      dataFetchedRef.current = false;
      fetchData();
      
      toast({
        title: "Vehicle Checked In",
        description: `Vehicle ${vehicle.plate_number} has been checked in successfully.`,
      });
    } catch (error: any) {
      console.error('Error adding vehicle:', error);
      toast({
        variant: "destructive",
        title: "Check-In Failed",
        description: error.message || "Failed to check in vehicle.",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleCheckoutClick = (vehicle: Vehicle) => {
    console.log('CheckInOut: handleCheckoutClick called', { vehicle, contractorRates });
    setSelectedVehicle(vehicle);
    setShowConfirmDialog(true);
  };

  const handleConfirmCheckout = () => {
    console.log('CheckInOut: handleConfirmCheckout called', { selectedVehicle, contractorRates });
    if (!contractorRates) {
      console.error('CheckInOut: contractorRates is null, cannot open checkout dialog');
      toast({
        variant: "destructive",
        title: "Error",
        description: "Contractor rates not available. Please refresh the page.",
      });
      return;
    }
    setShowConfirmDialog(false);
    setShowCheckout(true);
  };

  const handleCheckoutConfirm = async (data: { payment_amount: number; calculated_amount?: number; payment_method: string }) => {
    console.log('CheckInOut: handleCheckoutConfirm called', { selectedVehicle, data });
    if (!selectedVehicle) {
      console.error('CheckInOut: selectedVehicle is null');
      return;
    }

    try {
      setProcessing(true);
      console.log('CheckInOut: Starting checkout API call...');
      // Store original check_in_time before checkout
      const originalCheckInTime = selectedVehicle.check_in_time;
      
      // Get current UTC time
      const now = new Date();
      const checkoutData = {
        check_out_time: now.toISOString(), // Already in UTC format (ISO 8601 with Z suffix)
        payment_amount: data.payment_amount,
        calculated_amount: data.calculated_amount, // Send calculated amount for tracking
        payment_method: data.payment_method as 'cash' | 'card' | 'digital' | 'free'
      };
      
      console.log('CheckInOut: Checkout data being sent:', {
        check_out_time: checkoutData.check_out_time,
        payment_amount: checkoutData.payment_amount,
        calculated_amount: checkoutData.calculated_amount,
        original_check_in_time: originalCheckInTime
      });
      
      const response = await VehicleAPI.checkoutVehicle(selectedVehicle.id, checkoutData);
      
      // Calculate duration
      const checkInTime = new Date(selectedVehicle.check_in_time);
      const checkOutTime = new Date();
      const durationMs = checkOutTime.getTime() - checkInTime.getTime();
      const hours = Math.floor(durationMs / (1000 * 60 * 60));
      const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);
      const duration = `${hours}h ${minutes}m ${seconds}s`;
      
      // Set checkout details for success dialog
      setCheckoutDetails({
        paymentAmount: data.payment_amount,
        paymentMethod: data.payment_method,
        duration: duration
      });
      
      // Update selectedVehicle with response data (includes receipt_id, contractors, etc.)
      setSelectedVehicle(response);
      
      setShowCheckout(false);
      setShowSuccessDialog(true);
      dataFetchedRef.current = false;
      fetchData(); // Refresh data
    } catch (error: any) {
      console.error('Error checking out vehicle:', error);
      toast({
        variant: "destructive",
        title: "Check-Out Failed",
        description: error.message || "Failed to check out vehicle.",
      });
    } finally {
      setProcessing(false);
    }
  };

  // Filter and paginate vehicles
  const filteredVehicles = vehicles.filter(vehicle => 
    vehicle.plate_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (vehicle.mobile_number && vehicle.mobile_number.includes(searchTerm))
  );

  // Show all filtered vehicles (max 5 from API)
  const currentVehicles = filteredVehicles;

  // Calculate occupancy - get actual count of parked vehicles
  const totalSlots = currentLocation?.total_slots || 100;
  const [actualOccupiedSlots, setActualOccupiedSlots] = useState(0);
  const occupancyPercentage = (actualOccupiedSlots / totalSlots) * 100;

  // No need to reset page since we removed pagination

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-parkflow-blue"></div>
      </div>
    );
  }

  // Block access if subscription is expired
  if (subscriptionBlocked) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto max-w-md">
          <div className="rounded-full bg-red-100 p-3 mx-auto w-16 h-16 flex items-center justify-center mb-4">
            <XCircle className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-red-600 mb-2">Access Blocked</h2>
          <p className="text-muted-foreground mb-4">
            Your contractor's subscription has expired. Please contact your contractor to recharge.
          </p>
          <Button 
            variant="outline" 
            onClick={() => window.location.reload()}
            className="mt-4"
          >
            Refresh Page
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Check In/Out</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            {currentLocation ? `${currentLocation.locations_name} - ${currentLocation.address}` : 'Manage vehicle check-ins and check-outs'}
          </p>
        </div>
      </div>

      {/* Main Content - Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[calc(100vh-200px)]">
        {/* Left Panel - Vehicle Check-in */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <UserPlus className="h-5 w-5" />
              <span>Vehicle Check-in</span>
            </CardTitle>
            <CardDescription>
              Enter vehicle details to check-in.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Vehicle Type Selection */}
            <div className="space-y-2">
              <Label className="text-base font-semibold mb-2 block">Vehicle Type</Label>
              <div className="flex space-x-6">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="vehicleType"
                    value="2-wheeler"
                    checked={newVehicle.vehicle_type === '2-wheeler'}
                    onChange={(e) => setNewVehicle(prev => ({ ...prev, vehicle_type: e.target.value as '2-wheeler' }))}
                    className="w-4 h-4 text-parkflow-blue"
                  />
                  <Bike className="h-5 w-5" />
                  <span className="text-sm font-medium">2-Wheeler</span>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="vehicleType"
                    value="4-wheeler"
                    checked={newVehicle.vehicle_type === '4-wheeler'}
                    onChange={(e) => setNewVehicle(prev => ({ ...prev, vehicle_type: e.target.value as '4-wheeler' }))}
                    className="w-4 h-4 text-parkflow-blue"
                  />
                  <Car className="h-5 w-5" />
                  <span className="text-sm font-medium">4-Wheeler</span>
                </div>
              </div>
            </div>

            {/* Plate Number Input */}
            <div className="space-y-2">
              <Label className="text-base font-semibold mb-2 block">Plate Number</Label>
              <div className="flex space-x-2">
                <Input
                  placeholder="e.g., ABC-1234"
                  value={newVehicle.plate_number}
                  onChange={(e) => {
                    const input = e.target;
                    const cursorPosition = input.selectionStart;
                    const newValue = e.target.value.toUpperCase();
                    setNewVehicle(prev => ({ ...prev, plate_number: newValue }));
                    // Restore cursor position after state update
                    setTimeout(() => {
                      input.setSelectionRange(cursorPosition, cursorPosition);
                    }, 0);
                  }}
                  className="flex-1"
                />
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => setShowImageCheckIn(true)}
                  title="Check-in with Image Recognition"
                >
                  <Camera className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Mobile Number Input */}
            <div className="space-y-2">
              <Label className="text-base font-semibold mb-2 block">Mobile Number (Optional)</Label>
              <Input
                placeholder="e.g., 9876543210"
                value={newVehicle.mobile_number || ''}
                onChange={(e) => {
                  const input = e.target;
                  const cursorPosition = input.selectionStart;
                  // Only allow digits, limit to 10 digits
                  const newValue = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setNewVehicle(prev => ({ ...prev, mobile_number: newValue }));
                  // Validate and set error
                  const error = validateMobileNumber(newValue);
                  setMobileNumberError(error);
                  // Restore cursor position after state update
                  setTimeout(() => {
                    input.setSelectionRange(cursorPosition, cursorPosition);
                  }, 0);
                }}
                type="tel"
                maxLength={10}
                className={mobileNumberError ? 'border-red-500' : ''}
              />
              {mobileNumberError && (
                <p className="text-sm text-red-500 mt-1">{mobileNumberError}</p>
              )}
            </div>

            {/* Location Display */}
            <div className="space-y-2">
              <Label className="text-base font-semibold mb-2 block">Location</Label>
              <Input
                value={currentLocation?.locations_name || 'Loading...'}
                disabled
                className="bg-gray-50"
              />
              <p className="text-xs text-muted-foreground mt-1">
                This is your assigned location
              </p>
            </div>

            {/* Check-in Button */}
            <Button 
              onClick={handleAddVehicle} 
              className="w-full bg-parkflow-blue hover:bg-parkflow-blue/90 h-12 text-base"
              disabled={processing || !newVehicle.plate_number.trim()}
            >
              {processing ? (
                <span className="flex items-center">
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                  Processing...
                </span>
              ) : (
                <>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Check-in
                </>
              )}
            </Button>

            {/* Live Occupancy */}
            <div className="space-y-2">
              <Label className="text-base font-semibold mb-2 block">Live Occupancy</Label>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{actualOccupiedSlots}/{totalSlots}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(occupancyPercentage, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Panel - Currently Parked Vehicles */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
              <div>
                <CardTitle className="flex items-center space-x-2 text-lg sm:text-xl">
                  <MapPin className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span>Currently Parked Vehicles</span>
                </CardTitle>
                <CardDescription className="text-sm">
                  List of all vehicles currently in the lot.
                </CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <div className="relative w-full sm:w-48">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search vehicles..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 w-full text-sm"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {currentVehicles.length > 0 ? (
              <div className="space-y-3">
                <div className="space-y-3">
                  {currentVehicles.map((vehicle) => (
                    <div key={vehicle.id} className="border rounded-lg hover:bg-muted/50 transition-colors">
                      {/* Desktop Layout */}
                      <div className="hidden sm:flex items-center justify-between p-3">
                        <div className="flex-1 grid grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="font-mono font-medium">{vehicle.plate_number}</p>
                            {vehicle.mobile_number && (
                              <p className="text-xs text-muted-foreground">{vehicle.mobile_number}</p>
                            )}
                          </div>
                          <div>
                            <Badge variant="outline" className="text-xs">
                              {vehicle.vehicle_type === '2-wheeler' ? '2 Wheeler' : '4 Wheeler'}
                            </Badge>
                          </div>
                          <div>
                            <p className="text-muted-foreground">
                              {new Date(vehicle.check_in_time).toLocaleTimeString()}
                            </p>
                          </div>
                          <div>
                            <Button
                              size="sm"
                              onClick={() => handleCheckoutClick(vehicle)}
                              className="bg-red-600 hover:bg-red-700 text-white w-full"
                            >
                              <ArrowRight className="h-3 w-3 mr-1" />
                              Check-out
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Mobile Layout */}
                      <div className="sm:hidden p-3 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-mono font-medium text-sm">{vehicle.plate_number}</p>
                            {vehicle.mobile_number && (
                              <p className="text-xs text-muted-foreground">{vehicle.mobile_number}</p>
                            )}
                          </div>
                          <div className="flex-shrink-0 ml-2">
                            <Badge variant="outline" className="text-xs">
                              {vehicle.vehicle_type === '2-wheeler' ? '2 Wheeler' : '4 Wheeler'}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-muted-foreground">
                            Check-in: {new Date(vehicle.check_in_time).toLocaleTimeString()}
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleCheckoutClick(vehicle)}
                            className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1"
                          >
                            <ArrowRight className="h-3 w-3 mr-1" />
                            Check-out
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Car className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {searchTerm ? 'No vehicles found matching your search' : 'No vehicles currently parked'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Confirm Checkout Dialog */}
      <ConfirmCheckoutDialog
        isOpen={showConfirmDialog}
        onClose={() => {
          setShowConfirmDialog(false);
          setSelectedVehicle(null);
        }}
        onConfirm={handleConfirmCheckout}
        vehicle={selectedVehicle}
      />

      {/* Checkout Dialog */}
      <CheckoutDialog
        isOpen={showCheckout}
        onClose={() => {
          setShowCheckout(false);
          setSelectedVehicle(null);
        }}
        onConfirm={handleCheckoutConfirm}
        vehicle={selectedVehicle}
        contractorRates={contractorRates}
        loading={processing}
      />

      {/* Checkout Success Dialog */}
      <CheckoutSuccessDialog
        isOpen={showSuccessDialog}
        onClose={() => {
          setShowSuccessDialog(false);
          setCheckoutDetails(null);
          setSelectedVehicle(null);
        }}
        vehicle={selectedVehicle}
        paymentAmount={checkoutDetails?.paymentAmount || 0}
        paymentMethod={checkoutDetails?.paymentMethod || ''}
        duration={checkoutDetails?.duration || ''}
      />

      {/* Image Check-in Dialog */}
      <ImageCheckInDialog
        isOpen={showImageCheckIn}
        onClose={() => setShowImageCheckIn(false)}
        onPlateDetected={handlePlateDetected}
      />
    </div>
  );
}
