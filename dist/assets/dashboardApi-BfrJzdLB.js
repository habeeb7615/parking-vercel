import { a as apiClient } from "./index-D6HH3bW9.js";
import "./ui-DJO2kEUD.js";
import "./vendor-O_Wxd0qj.js";
import "./utils-BPZBwj5v.js";
import "./router-DjmRium3.js";
class DashboardAPI {
  // Get comprehensive dashboard metrics
  static async getDashboardMetrics() {
    const response = await apiClient.get("/dashboard/metrics");
    return response.data;
  }
  // Get contractor statistics
  static async getContractorStats() {
    const response = await apiClient.get("/dashboard/contractor-stats");
    return response.data || [];
  }
  // Get location statistics
  static async getLocationStats() {
    const response = await apiClient.get("/dashboard/location-stats");
    return response.data || [];
  }
  // Get recent activity (legacy - uses limit parameter)
  static async getRecentActivity(limit = 10) {
    const response = await apiClient.get("/dashboard/recent-activity", { limit });
    return response.data || [];
  }
  // Get recent activity with pagination
  static async getRecentActivityPaginated(params = {}) {
    const {
      page = 1,
      pageSize = 10,
      search = "",
      sortBy = "timestamp",
      sortOrder = "desc",
      type = ""
    } = params;
    const whereClause = [];
    if (search) {
      whereClause.push({
        key: "all",
        value: search,
        operator: "LIKE"
      });
    }
    if (type) {
      whereClause.push({
        key: "type",
        value: type,
        operator: "="
      });
    }
    const paginationPayload = {
      curPage: page,
      perPage: pageSize,
      sortBy,
      direction: sortOrder,
      whereClause
    };
    const response = await apiClient.post("/dashboard/recent-activity/paginated", paginationPayload);
    return {
      data: response.data.data,
      count: response.data.count,
      curPage: response.data.curPage,
      perPage: response.data.perPage,
      totalPages: response.data.totalPages,
      // Legacy fields for backward compatibility
      page: response.data.curPage,
      pageSize: response.data.perPage
    };
  }
  // Get system health status
  static async getSystemHealth() {
    const response = await apiClient.get("/dashboard/system-health");
    return response.data;
  }
  // Get system analytics
  static async getSystemAnalytics() {
    const response = await apiClient.get("/dashboard/analytics");
    return response.data;
  }
  // Get day-wise revenue
  static async getDayWiseRevenue(days = 30) {
    const response = await apiClient.get("/dashboard/revenue/day-wise", { days });
    return response.data;
  }
}
export {
  DashboardAPI
};
