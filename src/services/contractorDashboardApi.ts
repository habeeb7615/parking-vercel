import { apiClient } from '@/lib/apiClient';

export interface ContractorDashboardData {
  contractorId: string;
  contractorName: string;
  email: string;
  assignedLocations: {
    locationId: string;
    locationName: string;
    address: string;
    totalSlots: number;
    occupiedSlots: number;
    occupancyRate: number;
    status: string;
    attendants: {
      attendantId: string;
      attendantName: string;
      phone: string;
      email: string;
      status: string;
    }[];
  }[];
}

export interface ContractorStats {
  totalLocations: number;
  totalAttendants: number;
  totalVehicles: number;
  totalRevenue: number;
  todayRevenue: number;
  occupancyRate: number;
  todayVehicles: number;
}

export interface RecentActivityItem {
  attendant_name: string;
  plate_number: string;
  vehicle_type: string;
  check_in_time: string;
  check_out_time: string | null;
  amount: number;
  payment_status: string;
  created_on: string;
}

export class ContractorDashboardAPI {
  // Get contractor dashboard data
  static async getContractorDashboard(userId: string): Promise<ContractorDashboardData> {
    const response = await apiClient.get<ContractorDashboardData>(`/contractor-dashboard/${userId}`);
    return response.data;
  }


  // Get contractor statistics
  static async getContractorStats(userId: string): Promise<ContractorStats> {
    const response = await apiClient.get<ContractorStats>(`/contractor-dashboard/${userId}/stats`);
    return response.data;
  }

  // Get recent activity (latest 10 records)
  static async getRecentActivity(limit: number = 10): Promise<RecentActivityItem[]> {
    const response = await apiClient.get<{ statusCode: number; data: RecentActivityItem[] }>('/contractor-dashboard/recent-activity', { limit });
    // Response structure: { statusCode: 200, data: [...] }
    return response.data?.data || [];
  }

}
