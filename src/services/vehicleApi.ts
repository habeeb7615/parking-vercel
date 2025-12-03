import { apiClient } from '@/lib/apiClient';
import { logger } from './loggerService';

export interface Vehicle {
  id: string;
  plate_number: string;
  vehicle_type: '2-wheeler' | '4-wheeler';
  check_in_time: string;
  check_out_time?: string;
  location_id: string;
  contractor_id: string;
  mobile_number?: string;
  gate_in_id?: string;
  gate_out_id?: string;
  session_id?: string;
  payment_amount?: number;
  payment_status?: string;
  receipt_id?: string;
  created_by?: string;
  updated_by?: string;
  deleted_by?: string;
  created_on?: string;
  updated_on?: string;
  status?: 'checked_in' | 'checked_out';
  location?: {
    contractor_id?: string;
    locations_name: string;
    address: string;
    hourly_rate?: number;
  };
  parking_locations?: {
    locations_name: string;
    address: string;
    contractor_id: string;
    contractors?: {
      company_name: string;
    };
  };
  contractors?: {
    id: string;
    user_id: string;
    company_name: string;
    contact_number: string;
    status: string;
    rates_2wheeler?: any;
    rates_4wheeler?: any;
    profiles?: {
      user_name: string;
      email: string;
      phone_number?: string;
      subscription_plan_id?: string;
      subscription_start_date?: string;
      subscription_end_date?: string;
      subscription_status?: string;
      subscription_plans?: {
        name: string;
        price: number;
      };
    };
  };
  attendant?: {
    id: string;
    user_id: string;
    location_id: string;
    status: string;
    name: string;
    email: string;
    phone_number: string;
  };
}

export interface CreateVehicleData {
  plate_number: string;
  vehicle_type: '2-wheeler' | '4-wheeler';
  location_id: string;
  contractor_id: string;
  mobile_number?: string;
  gate_in_id?: string;
  session_id?: string;
}

export interface VehicleCheckoutData {
  check_out_time: string;
  payment_amount: number;
  payment_method: 'cash' | 'card' | 'digital' | 'free';
  check_in_time?: string; // Preserve original check_in_time
}

export class VehicleAPI {
  // Attendant only - Create vehicle (check-in)
  static async createVehicle(data: CreateVehicleData): Promise<Vehicle> {
    const response = await apiClient.post<Vehicle>('/vehicles', {
      plate_number: data.plate_number,
      vehicle_type: data.vehicle_type,
      location_id: data.location_id,
      contractor_id: data.contractor_id,
      mobile_number: data.mobile_number,
      gate_in_id: data.gate_in_id,
      session_id: data.session_id
    });

    // Log successful check-in (get user from localStorage)
    try {
      const { AuthAPI } = await import('@/services/authApi');
      const user = AuthAPI.getUser();
      if (user) {
        logger.logVehicleCheckin(data.plate_number, data.location_id, user.id);
      }
    } catch (error) {
      console.error('Error logging vehicle check-in:', error);
    }

    return response.data;
  }

  // Get vehicles for super admin (all)
  static async getAllVehicles(): Promise<Vehicle[]> {
    const response = await apiClient.get<Vehicle[]>('/vehicles');
    return response.data || [];
  }


  // Get vehicles for contractor (from all their locations)
  static async getContractorVehicles(contractorId: string): Promise<Vehicle[]> {
    const response = await apiClient.get<Vehicle[]>(`/vehicles/contractor/${contractorId}`);
    // Handle different response structures
    if (Array.isArray(response.data)) {
      return response.data;
    }
    // If response.data is an object with a data property (nested structure)
    if (response.data && typeof response.data === 'object' && 'data' in response.data && Array.isArray(response.data.data)) {
      return response.data.data;
    }
    return [];
  }

  // Get vehicles for attendant (assigned locations)
  static async getAttendantVehicles(attendantUserId?: string): Promise<Vehicle[]> {
    let userId = attendantUserId;
    if (!userId) {
      const { AuthAPI } = await import('@/services/authApi');
      const user = AuthAPI.getUser();
      if (!user) throw new Error('User not authenticated');
      userId = user.id;
    }

    const response = await apiClient.get<Vehicle[]>(`/vehicles/attendant/${userId}`);
    // Handle different response structures
    if (Array.isArray(response.data)) {
      return response.data;
    }
    // If response.data is an object with a data property (nested structure)
    if (response.data && typeof response.data === 'object' && 'data' in response.data && Array.isArray(response.data.data)) {
      return response.data.data;
    }
    return [];
  }

  // Get vehicles by location
  static async getVehiclesByLocation(locationId: string): Promise<Vehicle[]> {
    const response = await apiClient.get<Vehicle[]>(`/vehicles/location/${locationId}`);
    // Handle different response structures
    if (Array.isArray(response.data)) {
      return response.data;
    }
    // If response.data is an object with a data property (nested structure)
    if (response.data && typeof response.data === 'object' && 'data' in response.data && Array.isArray(response.data.data)) {
      return response.data.data;
    }
    return [];
  }

  // Attendant only - Check out vehicle
  static async checkoutVehicle(vehicleId: string, checkoutData: VehicleCheckoutData): Promise<Vehicle> {
    // Backend doesn't accept check_in_time in checkout request
    // Only send the fields that backend expects
    const response = await apiClient.post<Vehicle>(`/vehicles/checkout/${vehicleId}`, {
      check_out_time: checkoutData.check_out_time,
      payment_amount: checkoutData.payment_amount,
      payment_method: checkoutData.payment_method
    });

    // Log successful checkout (get user from localStorage)
    try {
      const { AuthAPI } = await import('@/services/authApi');
      const user = AuthAPI.getUser();
      if (user) {
        logger.logVehicleCheckout(response.data.plate_number, checkoutData.payment_amount, user.id);
        logger.logPaymentReceived(checkoutData.payment_amount, checkoutData.payment_method, user.id);
      }
    } catch (error) {
      console.error('Error logging vehicle checkout:', error);
    }

    return response.data;
  }

  // Get vehicle by ID
  static async getVehicleById(id: string): Promise<Vehicle> {
    const response = await apiClient.get<Vehicle>(`/vehicles/${id}`);
    return response.data;
  }

  // Get vehicle statistics
  static async getVehicleStats(locationId?: string): Promise<{
    totalVehicles: number;
    parkedVehicles: number;
    checkedOutVehicles: number;
    overdueVehicles: number;
    todayVehicles: number;
  }> {
    const params = locationId ? { locationId } : {};
    const response = await apiClient.get('/vehicles/stats', params);
    return response.data;
  }

  // Get vehicles by date range
  static async getVehiclesByDateRange(locationId: string, startDate: string, endDate: string): Promise<Vehicle[]> {
    const response = await apiClient.get<Vehicle[]>('/vehicles/date-range', {
      locationId,
      startDate,
      endDate
    });
    return response.data || [];
  }

  // Update vehicle
  static async updateVehicle(id: string, data: Partial<CreateVehicleData>): Promise<Vehicle> {
    const response = await apiClient.post<Vehicle>(`/vehicles/update/${id}`, data);
    return response.data;
  }

  // Delete vehicle
  static async deleteVehicle(vehicleId: string): Promise<void> {
    await apiClient.get(`/vehicles/delete/${vehicleId}`);
  }

  // Get vehicles with pagination
  static async getVehiclesWithPagination(params: {
    curPage: number;
    perPage: number;
    sortBy?: string;
    direction?: 'asc' | 'desc';
    whereClause?: Array<{ key: string; value: string }>;
  }): Promise<{
    data: Vehicle[];
    count: number;
    curPage: number;
    perPage: number;
    totalPages: number;
    statusCode: number;
  }> {
    const response = await apiClient.post<{
      data: Vehicle[];
      count: number;
      curPage: number;
      perPage: number;
      totalPages: number;
      statusCode: number;
    }>('/vehicles/pagination', {
      curPage: params.curPage,
      perPage: params.perPage,
      sortBy: params.sortBy || 'created_on',
      direction: params.direction || 'desc',
      whereClause: params.whereClause || []
    });
    return response.data;
  }
}
