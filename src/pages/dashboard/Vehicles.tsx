import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CameraCapture } from "@/components/ui/camera-capture";
import { CheckoutDialog } from "@/components/ui/checkout-dialog";
import { CheckoutSuccessDialog } from "@/components/ui/checkout-success-dialog";
import { ConfirmCheckoutDialog } from "@/components/ui/confirm-checkout-dialog";
import { ConfirmCheckinDialog } from "@/components/ui/confirm-checkin-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Car, Trash2, Plus, Camera, Car as CarIcon, Bike, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useEffect, useMemo, useState, useRef } from "react";
import { VehicleAPI, Vehicle, CreateVehicleData } from "@/services/vehicleApi";
import { OCRService } from "@/services/ocrService";
import { useAuth } from "@/contexts/AuthContext";
import { formatDateTime } from "@/utils/dateUtils";
import { checkAttendantContractorSubscription } from "@/utils/subscriptionUtils";
import { useToast } from "@/hooks/use-toast";
import { XCircle } from "lucide-react";
import { ContractorAPI } from "@/services/contractorApi";
import { AttendantAPI } from "@/services/attendantApi";
import { LocationAPI } from "@/services/locationApi";

export default function Vehicles() {
  const { profile } = useAuth();
  const { toast } = useToast();
  
  // Track if data has been fetched to prevent unnecessary re-fetches
  const dataFetchedRef = useRef(false);
  const subscriptionCheckedRef = useRef(false);
  
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [subscriptionBlocked, setSubscriptionBlocked] = useState(false);
  const [locations, setLocations] = useState<any[]>([]);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [newVehicle, setNewVehicle] = useState<CreateVehicleData>({
    plate_number: '',
    vehicle_type: '4-wheeler',
    location_id: '',
    contractor_id: '',
    mobile_number: ''
  });
  const [loading, setLoading] = useState(true);
  const [showCamera, setShowCamera] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showConfirmCheckin, setShowConfirmCheckin] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [contractorRates, setContractorRates] = useState<any>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [checkoutDetails, setCheckoutDetails] = useState<{
    paymentAmount: number;
    paymentMethod: string;
    duration: string;
  } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("parked");
  const [paginationMeta, setPaginationMeta] = useState<{
    count: number;
    curPage: number;
    perPage: number;
    totalPages: number;
  } | null>(null);
  const [mobileNumberError, setMobileNumberError] = useState<string>('');
  const isSuperAdmin = profile?.role === "super_admin";
  const isAttendant = profile?.role === "attendant";
  const isContractor = profile?.role === "contractor";


  const calculateDuration = (checkInTime: string, checkOutTime: string | null) => {
    if (!checkOutTime) return '-';
    
    const checkIn = new Date(checkInTime);
    const checkOut = new Date(checkOutTime);
    const diffMs = checkOut.getTime() - checkIn.getTime();
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  const formatPayment = (vehicle: Vehicle) => {
    // Only show payment for vehicles that have been checked out
    if (vehicle.check_out_time && vehicle.payment_amount != null) {
      // Convert to number if it's a string, handle null/undefined
      let amount: number;
      if (typeof vehicle.payment_amount === 'number') {
        amount = vehicle.payment_amount;
      } else {
        const parsed = parseFloat(String(vehicle.payment_amount));
        amount = isNaN(parsed) ? 0 : parsed;
      }
      
      // Ensure amount is a valid number before calling toFixed
      if (typeof amount === 'number' && !isNaN(amount) && isFinite(amount)) {
        return `₹${amount.toFixed(2)}`;
      }
    }
    
    // For parked vehicles, show "-" instead of estimated payment
    return '-';
  };

  const getStatusBadge = (vehicle: Vehicle) => {
    const status = getVehicleStatus(vehicle);
    if (status === 'checked_in') {
      return <span className="text-sm">Parked</span>;
    } else {
      return (
        <Badge variant="secondary" className="bg-gray-100 text-gray-800">
          Checked Out
        </Badge>
      );
    }
  };

  const getVehicleType = (type: string) => {
    return type === '2-wheeler' ? '2 Wheeler' : '4 Wheeler';
  };

  const PaginationComponent = ({ vehicleList }: { vehicleList: Vehicle[] }) => {
    // Use API pagination metadata if available, otherwise fallback to client-side
    const totalPages = paginationMeta?.totalPages || getTotalPages(vehicleList);
    const paginatedVehicles = vehicleList; // API already returns paginated data
    
    const getPageNumbers = () => {
      const pages = [];
      const maxVisiblePages = 5;
      
      if (totalPages <= maxVisiblePages) {
        for (let i = 1; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        if (currentPage <= 3) {
          for (let i = 1; i <= 4; i++) {
            pages.push(i);
          }
          pages.push('...');
          pages.push(totalPages);
        } else if (currentPage >= totalPages - 2) {
          pages.push(1);
          pages.push('...');
          for (let i = totalPages - 3; i <= totalPages; i++) {
            pages.push(i);
          }
        } else {
          pages.push(1);
          pages.push('...');
          for (let i = currentPage - 1; i <= currentPage + 1; i++) {
            pages.push(i);
          }
          pages.push('...');
          pages.push(totalPages);
        }
      }
      
      return pages;
    };

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4">
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
          <div className="text-xs sm:text-sm text-gray-500 text-center sm:text-left">
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, vehicleList.length)} of {vehicleList.length} vehicles
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-xs sm:text-sm text-gray-500">Show:</span>
            <Select value={itemsPerPage.toString()} onValueChange={(value) => handleItemsPerPageChange(parseInt(value))}>
              <SelectTrigger className="w-16 sm:w-20 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs sm:text-sm text-gray-500">per page</span>
          </div>
        </div>
        
        {totalPages > 1 && (
          <div className="flex items-center space-x-1 sm:space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="text-xs sm:text-sm"
            >
              <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Previous</span>
            </Button>
            
            <div className="flex space-x-1">
              {getPageNumbers().map((page, index) => (
                <Button
                  key={index}
                  variant={page === currentPage ? "default" : "outline"}
                  size="sm"
                  onClick={() => typeof page === 'number' ? handlePageChange(page) : undefined}
                  disabled={page === '...'}
                  className="w-6 h-6 sm:w-8 sm:h-8 p-0 text-xs"
                >
                  {page}
                </Button>
              ))}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="text-xs sm:text-sm"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          </div>
        )}
      </div>
    );
  };

  const renderVehicleTable = (vehicleList: Vehicle[]) => {
    // API already returns paginated data, so use vehicleList directly
    const paginatedVehicles = vehicleList;
    
    return (
      <div>
        {/* Desktop Table */}
        <div className="hidden lg:block overflow-hidden rounded-lg border">
          <div className="bg-gray-50 px-4 sm:px-6 py-3 border-b">
            <div className={`grid gap-2 sm:gap-4 text-xs sm:text-sm font-medium text-gray-700 ${isAttendant ? 'grid-cols-8' : 'grid-cols-9'}`} style={{ gridTemplateColumns: isAttendant ? '1fr 1fr 0.8fr 1.2fr 1.2fr 0.8fr 0.8fr 1fr' : '1fr 1fr 0.8fr 1.2fr 1.2fr 0.8fr 0.8fr 1fr 1fr' }}>
              <div>Plate Number</div>
              <div>Mobile Number</div>
              <div>Type</div>
              <div>Check-in</div>
              <div>Check-out</div>
              <div>Duration</div>
              <div>Payment</div>
              {!isAttendant && <div>Attendant Name</div>}
              {!isAttendant && <div>Location</div>}
              {isAttendant && <div>Actions</div>}
            </div>
          </div>
          
          <div className="divide-y">
            {paginatedVehicles.map((vehicle) => (
              <div key={vehicle.id} className="px-4 sm:px-6 py-3 sm:py-4 hover:bg-gray-50 transition-colors">
                <div className={`grid gap-2 sm:gap-4 items-center text-xs sm:text-sm ${isAttendant ? 'grid-cols-8' : 'grid-cols-9'}`} style={{ gridTemplateColumns: isAttendant ? '1fr 1fr 0.8fr 1.2fr 1.2fr 0.8fr 0.8fr 1fr' : '1fr 1fr 0.8fr 1.2fr 1.2fr 0.8fr 0.8fr 1fr 1fr' }}>
                  <div className="font-medium text-gray-900">
                    {vehicle.plate_number}
                  </div>
                  
                  <div className="text-gray-600 truncate">
                    {vehicle.mobile_number || '-'}
                  </div>
                  
                  <div className="text-gray-600">
                    {getVehicleType(vehicle.vehicle_type)}
                  </div>
                  
                  <div className="text-gray-600 text-xs sm:text-sm whitespace-nowrap">
                    {formatDateTime(vehicle.check_in_time)}
                  </div>
                  
                  <div className="text-gray-600 text-xs sm:text-sm whitespace-nowrap">
                    {vehicle.check_out_time ? formatDateTime(vehicle.check_out_time) : '-'}
                  </div>
                  
                  <div className="text-gray-600">
                    {calculateDuration(vehicle.check_in_time, vehicle.check_out_time)}
                  </div>
                  
                  <div className="text-gray-600">
                    {formatPayment(vehicle)}
                  </div>
                  
                  {!isAttendant && (
                    <div className="text-gray-600 truncate">
                      {vehicle.attendant?.name || 'Unknown Attendant'}
                    </div>
                  )}
                  
                  {!isAttendant && (
                    <div className="text-gray-600 truncate">
                      {vehicle.parking_locations?.locations_name || 'Unknown Location'}
                    </div>
                  )}
                  
                  {isAttendant && (
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      {!vehicle.check_out_time ? (
                        <Button
                          size="sm"
                          onClick={() => handleCheckoutClick(vehicle)}
                          className="bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm px-2 sm:px-3"
                        >
                          Check Out
                        </Button>
                      ) : (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200 text-xs">
                          Completed
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile Cards */}
        <div className="lg:hidden space-y-4">
          {paginatedVehicles.map((vehicle) => (
            <Card key={vehicle.id} className="p-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <Car className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <h3 className="font-medium text-sm">{vehicle.plate_number}</h3>
                      <p className="text-xs text-muted-foreground">{getVehicleType(vehicle.vehicle_type)}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusBadge(vehicle)}
                    {isAttendant && (
                      <div>
                        {!vehicle.check_out_time ? (
                          <Button
                            size="sm"
                            onClick={() => handleCheckoutClick(vehicle)}
                            className="bg-green-600 hover:bg-green-700 text-white text-xs"
                          >
                            Check Out
                          </Button>
                        ) : (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200 text-xs">
                            Completed
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2 text-xs">
                  <div className="flex items-center space-x-1">
                    <span className="text-muted-foreground">Mobile:</span>
                    <span>{vehicle.mobile_number || '-'}</span>
                  </div>
                  <div className="flex flex-col space-y-1">
                    <span className="text-muted-foreground text-xs">Check-in:</span>
                    <span className="text-xs break-all">{formatDateTime(vehicle.check_in_time)}</span>
                  </div>
                  {vehicle.check_out_time && (
                    <div className="flex flex-col space-y-1">
                      <span className="text-muted-foreground text-xs">Check-out:</span>
                      <span className="text-xs break-all">{formatDateTime(vehicle.check_out_time)}</span>
                    </div>
                  )}
                  <div className="flex items-center space-x-1">
                    <span className="text-muted-foreground">Duration:</span>
                    <span>{calculateDuration(vehicle.check_in_time, vehicle.check_out_time)}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-muted-foreground">Payment:</span>
                    <span>{formatPayment(vehicle)}</span>
                  </div>
                  {!isAttendant && (
                    <div className="flex items-center space-x-1">
                      <span className="text-muted-foreground">Attendant:</span>
                      <span className="truncate">{vehicle.attendant?.name || 'Unknown'}</span>
                    </div>
                  )}
                  {!isAttendant && (
                    <div className="flex items-center space-x-1">
                      <span className="text-muted-foreground">Location:</span>
                      <span className="truncate">{vehicle.parking_locations?.locations_name || 'Unknown'}</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
        
        <PaginationComponent vehicleList={vehicleList} />
      </div>
    );
  };

  // Reset pagination when vehicles change
  useEffect(() => {
    resetPagination();
  }, [vehicles]);

  // Reset pagination when search query changes
  useEffect(() => {
    resetPagination();
  }, [searchQuery]);

  // Check subscription status for attendants (non-blocking) - only once when vehicles are loaded
  useEffect(() => {
    // Only check subscription once when we have vehicles data, not on every profile/toast change
    if (profile?.role === 'attendant' && profile?.id && vehicles.length > 0 && !subscriptionCheckedRef.current) {
      subscriptionCheckedRef.current = true;
      
      // Try to get subscription info from vehicle response first (to avoid duplicate API calls)
      const firstVehicle = vehicles[0];
      if (firstVehicle?.contractors?.profiles) {
        // Use data from vehicle response
        const contractorProfile = firstVehicle.contractors.profiles;
        const now = new Date();
        const endDate = contractorProfile.subscription_end_date ? new Date(contractorProfile.subscription_end_date) : null;
        const isExpired = endDate && endDate < now;
        const isSuspended = contractorProfile.subscription_status === 'expired' || contractorProfile.subscription_status === 'suspended';
        
        if (isExpired || isSuspended) {
          setSubscriptionBlocked(true);
          toast({
            variant: "destructive",
            title: "Access Blocked",
            description: "Your contractor's subscription has expired. Please contact your contractor to recharge.",
          });
        }
      } else {
        // Fallback to API call only if vehicle data doesn't have subscription info
        checkAttendantContractorSubscription(profile.id)
          .then((status) => {
            console.log('Subscription status for attendant (Vehicles):', status);
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
            console.error('Error checking subscription status (Vehicles):', error);
            // Don't block access if there's an error checking subscription
          });
      }
    }
  }, [profile?.role, profile?.id, vehicles.length, toast]);

  // Fetch vehicles with pagination
  const fetchVehiclesWithPagination = async (page: number = currentPage, statusFilter?: string) => {
    try {
      setLoading(true);
      
      // Build whereClause based on status filter
      // Map tab values to API status values
      const whereClause: Array<{ key: string; value: string }> = [];
      if (statusFilter === 'parked') {
        whereClause.push({ key: 'status', value: 'checked_in' });
      } else if (statusFilter === 'checked-out') {
        whereClause.push({ key: 'status', value: 'checked_out' });
      }
      
      const response = await VehicleAPI.getVehiclesWithPagination({
        curPage: page,
        perPage: itemsPerPage,
        sortBy: 'created_on',
        direction: 'desc',
        whereClause: whereClause
      });
      
      const fetchedVehicles = response.data || [];
      setVehicles(fetchedVehicles);
      setPaginationMeta({
        count: response.count,
        curPage: response.curPage,
        perPage: response.perPage,
        totalPages: response.totalPages
      });
      
      // Extract location and contractor data from vehicle response (for attendants)
      if (isAttendant && fetchedVehicles.length > 0) {
        const firstVehicle = fetchedVehicles[0];
        
        // Extract location from vehicle response
        if (firstVehicle.parking_locations) {
          const location = {
            id: firstVehicle.location_id,
            locations_name: firstVehicle.parking_locations.locations_name,
            address: firstVehicle.parking_locations.address,
            contractor_id: firstVehicle.parking_locations.contractor_id || firstVehicle.contractor_id,
            ...firstVehicle.parking_locations
          };
          setLocations([location]);
          setNewVehicle(prev => ({
            ...prev,
            location_id: location.id || '',
            contractor_id: location.contractor_id || ''
          }));
        }
        
        // Extract contractor rates from vehicle response
        if (firstVehicle.contractors) {
          const contractor = firstVehicle.contractors;
          // Parse rates if they're JSON strings
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
      }
      
      return fetchedVehicles;
    } catch (error: any) {
      console.error('Error loading vehicles:', error);
      toast({
        variant: "destructive",
        title: "Error Loading Vehicles",
        description: error?.message || "Failed to load vehicles. Please try again later.",
      });
      setVehicles([]);
      setPaginationMeta(null);
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Prevent duplicate calls if already fetched
    if (dataFetchedRef.current) return;
    
    const load = async () => {
      try {
        dataFetchedRef.current = true;
        
        if (isSuperAdmin || isAttendant || isContractor) {
          // Use pagination API for all roles (default to 'parked' tab)
          await fetchVehiclesWithPagination(1, activeTab === 'all' ? undefined : activeTab);
          
          // For contractors, also load locations and rates
          if (isContractor && profile?.id) {
            try {
              const { AuthAPI } = await import('@/services/authApi');
              let contractorData = AuthAPI.getContractor();
              
              if (!contractorData) {
                contractorData = await ContractorAPI.getContractorByUserId(profile.id);
                if (contractorData) {
                  AuthAPI.setContractor(contractorData);
                }
              }

              if (contractorData && contractorData.id) {
                // Set contractor rates for checkout calculation
                let rates2w, rates4w;
                try {
                  rates2w = typeof contractorData.rates_2wheeler === 'string' 
                    ? JSON.parse(contractorData.rates_2wheeler) 
                    : contractorData.rates_2wheeler;
                  rates4w = typeof contractorData.rates_4wheeler === 'string' 
                    ? JSON.parse(contractorData.rates_4wheeler) 
                    : contractorData.rates_4wheeler;
                } catch (e) {
                  console.error('Error parsing rates:', e);
                  rates2w = contractorData.rates_2wheeler;
                  rates4w = contractorData.rates_4wheeler;
                }
                
                setContractorRates({
                  rates_2wheeler: rates2w,
                  rates_4wheeler: rates4w
                });
                
                // Load contractor's locations
                const locationsData = await ContractorAPI.getContractorLocations(contractorData.id);
                const locationsArray = Array.isArray(locationsData) ? locationsData : [];
                const activeLocations = locationsArray.filter(loc => 
                  loc.is_deleted === false && loc.status === 'active'
                );
                setLocations(activeLocations);
              }
            } catch (error) {
              console.error('Error loading contractor data:', error);
            }
          }
        } else {
          setVehicles([]);
          setLocations([]);
        }
      } catch (error: any) {
        console.error('Error loading vehicles:', error);
        toast({
          variant: "destructive",
          title: "Error Loading Vehicles",
          description: error?.message || "Failed to load vehicles. Please try again later.",
        });
        setVehicles([]);
        setLocations([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isSuperAdmin, isAttendant, isContractor, profile?.id]);

  // Refetch when tab changes
  useEffect(() => {
    if (dataFetchedRef.current) {
      const statusFilter = activeTab === 'all' ? undefined : activeTab;
      fetchVehiclesWithPagination(1, statusFilter);
      setCurrentPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Refetch when page or itemsPerPage changes
  useEffect(() => {
    if (dataFetchedRef.current && paginationMeta) {
      const statusFilter = activeTab === 'all' ? undefined : activeTab;
      fetchVehiclesWithPagination(currentPage, statusFilter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, itemsPerPage]);

  const grouped = useMemo(() => {
    if (!isSuperAdmin) return {} as { [k: string]: { [l: string]: Vehicle[] } };
    // Ensure vehicles is always an array
    const vehiclesArray = Array.isArray(vehicles) ? vehicles : [];
    const byContractor: { [k: string]: { [l: string]: Vehicle[] } } = {};
    vehiclesArray.forEach(v => {
      const contractorId = v.location?.contractor_id || "unknown";
      const locationName = v.location?.locations_name || "Unknown Location";
      byContractor[contractorId] = byContractor[contractorId] || {};
      byContractor[contractorId][locationName] = byContractor[contractorId][locationName] || [];
      byContractor[contractorId][locationName].push(v);
    });
    return byContractor;
  }, [vehicles, isSuperAdmin]);

  const stats = useMemo(() => {
    // Ensure vehicles is always an array
    const vehiclesArray = Array.isArray(vehicles) ? vehicles : [];
    const totalVehicles = vehiclesArray.length;
    const currentlyParked = vehiclesArray.filter(v => v.check_out_time === null).length;
    const checkedOut = vehiclesArray.filter(v => v.check_out_time !== null);
    
    // Calculate total revenue - ensure payment_amount is a valid number
    const totalRevenue = vehiclesArray.reduce((sum, v) => {
      if (!v.payment_amount) return sum;
      // Convert to number if it's a string, handle null/undefined
      let amount: number;
      if (typeof v.payment_amount === 'number') {
        amount = v.payment_amount;
      } else if (typeof v.payment_amount === 'string') {
        const parsed = parseFloat(v.payment_amount);
        amount = isNaN(parsed) ? 0 : parsed;
      } else {
        amount = 0;
      }
      // Only add valid, positive amounts
      return sum + (amount > 0 && isFinite(amount) ? amount : 0);
    }, 0);
    
    // Calculate average duration for checked out vehicles
    let averageDuration = 0;
    if (checkedOut.length > 0) {
      let validDurations = 0;
      const totalDuration = checkedOut.reduce((sum, v) => {
        if (v.check_in_time && v.check_out_time) {
          try {
            const checkIn = new Date(v.check_in_time);
            const checkOut = new Date(v.check_out_time);
            
            // Validate dates
            if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
              return sum;
            }
            
            const duration = checkOut.getTime() - checkIn.getTime();
            
            // Only count positive durations (check_out should be after check_in)
            if (duration > 0) {
              validDurations++;
              return sum + duration;
            }
          } catch (error) {
            console.error('Error calculating duration for vehicle:', v.id, error);
          }
        }
        return sum;
      }, 0);
      
      if (validDurations > 0) {
        averageDuration = totalDuration / validDurations / (1000 * 60 * 60); // Convert to hours
      }
    }

    return {
      totalVehicles,
      currentlyParked,
      averageDuration: averageDuration > 0 ? Math.round(averageDuration * 10) / 10 : 0,
      totalRevenue: Math.round(totalRevenue * 100) / 100
    };
  }, [vehicles]);

  // Search and filter logic
  const getVehicleStatus = (vehicle: Vehicle) => {
    return vehicle.check_out_time === null ? 'checked_in' : 'checked_out';
  };

  // Use useMemo to prevent hydration errors with date calculations
  const allVehicles = useMemo(() => {
    const filterVehicles = (vehicleList: Vehicle[]) => {
      if (!searchQuery.trim()) return vehicleList;
      
      const query = searchQuery.toLowerCase();
      return vehicleList.filter(vehicle => 
        vehicle.plate_number.toLowerCase().includes(query) ||
        vehicle.parking_locations?.locations_name?.toLowerCase().includes(query) ||
        vehicle.mobile_number?.toLowerCase().includes(query) ||
        vehicle.vehicle_type.toLowerCase().includes(query) ||
        getVehicleStatus(vehicle).toLowerCase().includes(query)
      );
    };

    // Ensure vehicles is always an array
    const vehiclesArray = Array.isArray(vehicles) ? vehicles : [];
    return filterVehicles([...vehiclesArray].sort((a, b) => {
      const timeA = a.check_in_time ? new Date(a.check_in_time).getTime() : 0;
      const timeB = b.check_in_time ? new Date(b.check_in_time).getTime() : 0;
      return timeB - timeA;
    }));
  }, [vehicles, searchQuery]);

  const currentlyParkedVehicles = useMemo(() => {
    const filterVehicles = (vehicleList: Vehicle[]) => {
      if (!searchQuery.trim()) return vehicleList;
      
      const query = searchQuery.toLowerCase();
      return vehicleList.filter(vehicle => 
        vehicle.plate_number.toLowerCase().includes(query) ||
        vehicle.parking_locations?.locations_name?.toLowerCase().includes(query) ||
        vehicle.mobile_number?.toLowerCase().includes(query) ||
        vehicle.vehicle_type.toLowerCase().includes(query) ||
        getVehicleStatus(vehicle).toLowerCase().includes(query)
      );
    };

    // Ensure vehicles is always an array
    const vehiclesArray = Array.isArray(vehicles) ? vehicles : [];
    return filterVehicles(vehiclesArray.filter(v => v.check_out_time === null));
  }, [vehicles, searchQuery]);

  const checkedOutVehicles = useMemo(() => {
    const filterVehicles = (vehicleList: Vehicle[]) => {
      if (!searchQuery.trim()) return vehicleList;
      
      const query = searchQuery.toLowerCase();
      return vehicleList.filter(vehicle => 
        vehicle.plate_number.toLowerCase().includes(query) ||
        vehicle.parking_locations?.locations_name?.toLowerCase().includes(query) ||
        vehicle.mobile_number?.toLowerCase().includes(query) ||
        vehicle.vehicle_type.toLowerCase().includes(query) ||
        getVehicleStatus(vehicle).toLowerCase().includes(query)
      );
    };

    // Ensure vehicles is always an array
    const vehiclesArray = Array.isArray(vehicles) ? vehicles : [];
    return filterVehicles(vehiclesArray.filter(v => v.check_out_time !== null));
  }, [vehicles, searchQuery]);
  

  // Pagination logic (fallback for when API pagination is not available)
  const getPaginatedVehicles = (vehicleList: Vehicle[]) => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return vehicleList.slice(startIndex, endIndex);
  };

  const getTotalPages = (vehicleList: Vehicle[]) => {
    return Math.ceil(vehicleList.length / itemsPerPage);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top when page changes
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  const resetPagination = () => {
    setCurrentPage(1);
  };

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
    if (!newVehicle.plate_number || !newVehicle.vehicle_type) {
      alert('Please fill in all required fields');
      return;
    }

    // Validate mobile number if provided
    const mobileError = validateMobileNumber(newVehicle.mobile_number || '');
    if (mobileError) {
      setMobileNumberError(mobileError);
      return;
    }
    setMobileNumberError('');

    // Show confirmation dialog first
    setShowConfirmCheckin(true);
  };

  const handleConfirmCheckin = async () => {
    try {
      setLoading(true);
      await VehicleAPI.createVehicle(newVehicle);
      setNewVehicle({
        plate_number: '',
        vehicle_type: '4-wheeler',
        location_id: locations[0]?.id || '',
        contractor_id: locations[0]?.contractor_id || '',
        mobile_number: ''
      });
      setMobileNumberError('');
      setShowAddVehicle(false);
      setShowConfirmCheckin(false);
      // Refetch vehicles after adding
      const statusFilter = activeTab === 'all' ? undefined : activeTab;
      await fetchVehiclesWithPagination(currentPage, statusFilter);
    } catch (error) {
      console.error('Error adding vehicle:', error);
      alert('Error adding vehicle: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckoutClick = (vehicle: Vehicle) => {
    console.log('Vehicles: handleCheckoutClick called', { vehicle, contractorRates });
    setSelectedVehicle(vehicle);
    setShowConfirmDialog(true);
  };

  const handleConfirmCheckout = () => {
    console.log('Vehicles: handleConfirmCheckout called', { selectedVehicle, contractorRates });
    if (!contractorRates) {
      console.error('Vehicles: contractorRates is null, cannot open checkout dialog');
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

  const handleCheckoutConfirm = async (data: { payment_amount: number; payment_method: string }) => {
    console.log('Vehicles: handleCheckoutConfirm called', { selectedVehicle, data });
    if (!selectedVehicle) {
      console.error('Vehicles: selectedVehicle is null');
      return;
    }

    try {
      setLoading(true);
      console.log('Vehicles: Starting checkout API call...');
      // Store original check_in_time before checkout
      const originalCheckInTime = selectedVehicle.check_in_time;
      
      // Get current UTC time
      const now = new Date();
      const checkoutData = {
        check_out_time: now.toISOString(), // Already in UTC format (ISO 8601 with Z suffix)
        payment_amount: data.payment_amount,
        payment_method: data.payment_method as 'cash' | 'card' | 'digital' | 'free'
      };
      
      console.log('Vehicles: Checkout data being sent:', {
        check_out_time: checkoutData.check_out_time,
        payment_amount: checkoutData.payment_amount,
        original_check_in_time: originalCheckInTime,
        original_check_in_time_parsed: new Date(originalCheckInTime).toISOString()
      });
      
      const response = await VehicleAPI.checkoutVehicle(selectedVehicle.id, checkoutData);
      
      // Check if backend incorrectly updated check_in_time
      if (response && response.check_in_time) {
        const receivedCheckInTime = new Date(response.check_in_time).toISOString();
        const originalCheckInTimeISO = new Date(originalCheckInTime).toISOString();
        
        if (receivedCheckInTime !== originalCheckInTimeISO) {
          const timeDiff = new Date(receivedCheckInTime).getTime() - new Date(originalCheckInTimeISO).getTime();
          const hoursDiff = timeDiff / (1000 * 60 * 60);
          
          console.error('Vehicles: CRITICAL - Backend updated check_in_time during checkout!', {
            original: originalCheckInTime,
            original_iso: originalCheckInTimeISO,
            received: response.check_in_time,
            received_iso: receivedCheckInTime,
            time_difference_hours: hoursDiff,
            time_difference_ms: timeDiff
          });
          
          toast({
            variant: "destructive",
            title: "Warning: Check-in Time Changed",
            description: `Backend incorrectly updated check_in_time by ${hoursDiff.toFixed(2)} hours. This is a backend bug that needs to be fixed.`,
          });
        } else {
          console.log('Vehicles: check_in_time preserved correctly');
        }
      }
      
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
      
      // Close checkout dialog and show success dialog
      setShowCheckout(false);
      setShowSuccessDialog(true);
      
      // Refetch vehicles after checkout and verify check_in_time
      const statusFilter = activeTab === 'all' ? undefined : activeTab;
      const refetchedVehicles = await fetchVehiclesWithPagination(currentPage, statusFilter);
      
      // After refetch, check if check_in_time was changed
      const refetchedVehicle = refetchedVehicles.find(v => v.id === selectedVehicle.id);
      if (refetchedVehicle && refetchedVehicle.check_in_time !== originalCheckInTime) {
        const timeDiff = new Date(refetchedVehicle.check_in_time).getTime() - new Date(originalCheckInTime).getTime();
        const hoursDiff = timeDiff / (1000 * 60 * 60);
        console.error('Vehicles: After refetch - check_in_time was changed by backend!', {
          vehicle_id: selectedVehicle.id,
          plate_number: selectedVehicle.plate_number,
          original_check_in_time: originalCheckInTime,
          refetched_check_in_time: refetchedVehicle.check_in_time,
          difference_hours: hoursDiff,
          difference_minutes: timeDiff / (1000 * 60)
        });
        
        toast({
          variant: "destructive",
          title: "Backend Bug Detected",
          description: `check_in_time was incorrectly updated by ${hoursDiff.toFixed(2)} hours. Please report this to the backend team.`,
        });
      }
      
      // Don't clear selectedVehicle yet - let success dialog use it
    } catch (error: any) {
      console.error('Error during checkout:', error);
      toast({
        variant: "destructive",
        title: "Checkout Failed",
        description: error?.message || "Failed to checkout vehicle. Please try again.",
      });
      setShowCheckout(false);
      setSelectedVehicle(null);
      console.error('Error checking out vehicle:', error);
      alert('Error checking out vehicle: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCameraCapture = async (imageData: string) => {
    try {
      setProcessingImage(true);
      const plateNumber = await OCRService.processPlateImage(imageData);
      setNewVehicle(prev => ({ ...prev, plate_number: plateNumber }));
      setShowCamera(false);
    } catch (error) {
      console.error('Error processing image:', error);
      alert('Error processing image. Please try again.');
    } finally {
      setProcessingImage(false);
    }
  };
  // Add a simple fallback for debugging
  if (!profile) {
    return (
      <div className="text-center py-8">
        <h3 className="text-lg font-medium mb-2">Loading Profile...</h3>
        <p className="text-muted-foreground">Please wait while we load your profile.</p>
        <div className="mt-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  // Debug information
  console.log('Vehicles component - Profile loaded:', {
    role: profile.role,
    id: profile.id,
    status: profile.status,
    loading: loading,
    vehiclesCount: vehicles.length,
    isSuperAdmin,
    isAttendant,
    isContractor
  });

  // Add a simple test to see if the component is rendering
  console.log('Vehicles component is rendering with vehicles:', vehicles);
  console.log('allVehicles after filtering:', allVehicles);
  console.log('currentlyParkedVehicles:', currentlyParkedVehicles);
  console.log('checkedOutVehicles:', checkedOutVehicles);

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
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Vehicle Logs</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            View all vehicle activity from your locations with assigned attendants.
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search by plate, location, mobile..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-9 text-sm"
          />
        </div>
        {searchQuery && (
          <Button
            variant="outline"
            onClick={() => setSearchQuery("")}
            className="text-gray-500 w-full sm:w-auto h-9 text-sm"
          >
            Clear
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3">
          <TabsTrigger value="parked" className="text-xs sm:text-sm">Currently Parked</TabsTrigger>
          <TabsTrigger value="checked-out" className="text-xs sm:text-sm">Checked Out</TabsTrigger>
          <TabsTrigger value="all" className="text-xs sm:text-sm">All Vehicles</TabsTrigger>
        </TabsList>
        
        <TabsContent value="parked" className="mt-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="text-muted-foreground">Loading vehicles...</div>
            </div>
          ) : currentlyParkedVehicles.length === 0 ? (
            <div className="text-center py-8">
              <h3 className="text-lg font-medium mb-2">No parked vehicles</h3>
              <p className="text-muted-foreground">Currently parked vehicles will appear here.</p>
            </div>
          ) : (
            renderVehicleTable(currentlyParkedVehicles)
          )}
        </TabsContent>
        
        <TabsContent value="checked-out" className="mt-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="text-muted-foreground">Loading vehicles...</div>
            </div>
          ) : checkedOutVehicles.length === 0 ? (
            <div className="text-center py-8">
              <h3 className="text-lg font-medium mb-2">No checked out vehicles</h3>
              <p className="text-muted-foreground">Checked out vehicles will appear here.</p>
            </div>
          ) : (
            renderVehicleTable(checkedOutVehicles)
          )}
        </TabsContent>
        
        <TabsContent value="all" className="mt-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="text-muted-foreground">Loading vehicles...</div>
            </div>
          ) : allVehicles.length === 0 ? (
            <div className="text-center py-8">
              <h3 className="text-lg font-medium mb-2">No vehicles found</h3>
              <p className="text-muted-foreground">
                {isContractor 
                  ? "Vehicle logs will appear here when attendants check in vehicles at your assigned locations."
                  : "Vehicle logs will appear here when vehicles check in."
                }
              </p>
            </div>
          ) : (
            renderVehicleTable(allVehicles)
          )}
        </TabsContent>
      </Tabs>

      {/* Add Vehicle Dialog */}
      {isAttendant && (
        <Dialog open={showAddVehicle} onOpenChange={setShowAddVehicle}>
          <DialogContent className="max-w-md w-[95vw] sm:w-full">
            <DialogHeader>
              <DialogTitle className="text-xl sm:text-2xl font-bold">Vehicle Check-in</DialogTitle>
              <DialogDescription className="text-sm">
                Enter vehicle details to check-in.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 sm:space-y-6">
              {/* Vehicle Type Selection */}
              <div>
                <Label className="text-sm sm:text-base font-semibold mb-2 sm:mb-3 block">Vehicle Type</Label>
                <RadioGroup
                  value={newVehicle.vehicle_type}
                  onValueChange={(value: '2-wheeler' | '4-wheeler') => 
                    setNewVehicle(prev => ({ ...prev, vehicle_type: value }))
                  }
                  className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="2-wheeler" id="2-wheeler" />
                    <Label htmlFor="2-wheeler" className="flex items-center space-x-2 cursor-pointer">
                      <Bike className="h-5 w-5" />
                      <span>2-Wheeler</span>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="4-wheeler" id="4-wheeler" />
                    <Label htmlFor="4-wheeler" className="flex items-center space-x-2 cursor-pointer">
                      <CarIcon className="h-5 w-5" />
                      <span>4-Wheeler</span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Plate Number Input */}
              <div>
                <Label className="text-sm sm:text-base font-semibold mb-2 sm:mb-3 block">Plate Number</Label>
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                  <Input
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
                    placeholder="e.g., ABC-1234"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setShowCamera(true)}
                    disabled={processingImage}
                    className="w-full sm:w-auto"
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                </div>
                {processingImage && (
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    Processing image...
                  </p>
                )}
              </div>

              {/* Mobile Number Input */}
              <div>
                <Label className="text-sm sm:text-base font-semibold mb-2 sm:mb-3 block">Mobile Number (Optional)</Label>
                <Input
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
                  placeholder="e.g., 9876543210"
                  type="tel"
                  maxLength={10}
                  className={mobileNumberError ? 'border-red-500' : ''}
                />
                {mobileNumberError && (
                  <p className="text-sm text-red-500 mt-1">{mobileNumberError}</p>
                )}
              </div>

              {/* Location Display */}
              <div>
                <Label className="text-sm sm:text-base font-semibold mb-2 sm:mb-3 block">Location</Label>
                <Input
                  value={locations[0]?.locations_name || 'Loading...'}
                  disabled
                  className="bg-gray-50"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This is your assigned location
                </p>
              </div>

              {/* Live Occupancy */}
              <div>
                <Label className="text-sm sm:text-base font-semibold mb-2 sm:mb-3 block">Live Occupancy</Label>
                <div className="space-y-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min((stats.currentlyParked / Math.max(stats.totalVehicles, 1)) * 100, 100)}%` }}
                    ></div>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground text-center">
                    {stats.currentlyParked}/{Math.max(stats.totalVehicles, 100)} spots occupied
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row justify-center space-y-2 sm:space-y-0 sm:space-x-3 pt-3 sm:pt-4">
                <Button variant="outline" onClick={() => setShowAddVehicle(false)} className="w-full sm:w-auto">
                  Cancel
                </Button>
                <Button 
                  onClick={handleAddVehicle} 
                  disabled={loading || !newVehicle.plate_number}
                  className="bg-purple-600 hover:bg-purple-700 w-full sm:w-auto"
                >
                  {loading ? 'Adding...' : 'Check-in'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Camera Capture Modal */}
      {showCamera && (
        <CameraCapture
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
        />
      )}

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
        loading={loading}
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

      {/* Confirm Check-in Dialog */}
      <ConfirmCheckinDialog
        isOpen={showConfirmCheckin}
        onClose={() => {
          setShowConfirmCheckin(false);
        }}
        onConfirm={handleConfirmCheckin}
        vehicle={{
          id: '',
          plate_number: newVehicle.plate_number,
          vehicle_type: newVehicle.vehicle_type,
          mobile_number: newVehicle.mobile_number,
          location: locations.find(loc => loc.id === newVehicle.location_id)
        }}
        loading={loading}
      />
    </div>
  );
}
