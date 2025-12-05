# API Specification: Hierarchical Income Data (Location-wise & Attendant-wise)

## Overview
This API endpoint provides income data in a hierarchical structure: **Location → Attendants** for contractors. This allows contractors to view their revenue breakdown by location and then by attendant within each location.

## Endpoint

### GET `/api/income/contractor/location-wise`
or
### POST `/api/income/contractor/location-wise`

## Request

### Headers
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

### Query Parameters (for GET) or Body (for POST)
```json
{
  "contractor_id": "string (optional - if not provided, use from auth token)",
  "date_range": {
    "start_date": "YYYY-MM-DD (optional)",
    "end_date": "YYYY-MM-DD (optional)"
  },
  "include_attendants": true (default: true)
}
```

## Response Structure

### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "contractor_id": "uuid",
    "contractor_name": "string",
    "total_revenue": 0.00,
    "today_revenue": 0.00,
    "this_week_revenue": 0.00,
    "this_month_revenue": 0.00,
    "locations": [
      {
        "location_id": "uuid",
        "location_name": "string",
        "address": "string",
        "total_revenue": 0.00,
        "today_revenue": 0.00,
        "this_week_revenue": 0.00,
        "this_month_revenue": 0.00,
        "total_vehicles": 0,
        "attendants": [
          {
            "attendant_id": "uuid",
            "attendant_name": "string",
            "attendant_email": "string (optional)",
            "total_revenue": 0.00,
            "today_revenue": 0.00,
            "this_week_revenue": 0.00,
            "this_month_revenue": 0.00,
            "total_vehicles": 0
          }
        ]
      }
    ]
  },
  "message": "Income data retrieved successfully"
}
```

## Detailed Field Descriptions

### Top Level
- **contractor_id**: UUID of the contractor
- **contractor_name**: Company name of the contractor
- **total_revenue**: Sum of all payment_amount from checked-out vehicles (all time)
- **today_revenue**: Sum of payment_amount from vehicles checked out today
- **this_week_revenue**: Sum of payment_amount from vehicles checked out in last 7 days
- **this_month_revenue**: Sum of payment_amount from vehicles checked out in current month

### Location Object
- **location_id**: UUID of the parking location
- **location_name**: Name of the location
- **address**: Full address of the location
- **total_revenue**: Sum of payment_amount from all checked-out vehicles at this location
- **today_revenue**: Sum of payment_amount from vehicles checked out today at this location
- **this_week_revenue**: Sum of payment_amount from vehicles checked out in last 7 days at this location
- **this_month_revenue**: Sum of payment_amount from vehicles checked out in current month at this location
- **total_vehicles**: Count of all checked-out vehicles at this location
- **attendants**: Array of attendant income objects

### Attendant Object
- **attendant_id**: UUID of the attendant (from attendants table or gate_in_id from vehicles)
- **attendant_name**: Name of the attendant (from profiles table via attendant.user_id, or from vehicle.attendant_name if available)
- **attendant_email**: Email of the attendant (optional)
- **total_revenue**: Sum of payment_amount from all checked-out vehicles handled by this attendant at this location
- **today_revenue**: Sum of payment_amount from vehicles checked out today by this attendant
- **this_week_revenue**: Sum of payment_amount from vehicles checked out in last 7 days by this attendant
- **this_month_revenue**: Sum of payment_amount from vehicles checked out in current month by this attendant
- **total_vehicles**: Count of all checked-out vehicles handled by this attendant at this location

## Business Logic Requirements

1. **Vehicle Filtering**:
   - Only include vehicles where `check_out_time IS NOT NULL`
   - Only include vehicles where `payment_amount > 0` (or payment_status = 'paid')
   - Only include vehicles where `is_deleted = false`
   - Filter by `contractor_id` matching the authenticated contractor

2. **Date Calculations**:
   - **Today**: Vehicles where `check_out_time >= start of today (00:00:00)` and `check_out_time < start of tomorrow`
   - **This Week**: Vehicles where `check_out_time >= 7 days ago from now`
   - **This Month**: Vehicles where `check_out_time >= first day of current month (00:00:00)`

3. **Attendant Identification**:
   - Primary: Use `vehicle.attendant_name` if available
   - Fallback: Join with `attendants` table via `gate_in_id` → `attendants.user_id` → `profiles.user_name`
   - If no attendant found, use "Unknown Attendant" as attendant_name

4. **Location Filtering**:
   - Only include locations that belong to the contractor
   - Only include locations that have at least one vehicle with payment
   - Sort locations alphabetically by `location_name`

5. **Attendant Sorting**:
   - Sort attendants alphabetically by `attendant_name` within each location

## SQL Query Structure (Reference)

```sql
-- Pseudo SQL structure (adjust based on your actual schema)

WITH vehicle_payments AS (
  SELECT 
    v.id,
    v.location_id,
    v.contractor_id,
    v.check_out_time,
    v.payment_amount,
    v.gate_in_id,
    v.attendant_name,
    v.check_in_time
  FROM vehicles v
  WHERE v.contractor_id = :contractor_id
    AND v.check_out_time IS NOT NULL
    AND v.payment_amount > 0
    AND v.is_deleted = false
),
location_income AS (
  SELECT 
    l.id as location_id,
    l.locations_name as location_name,
    l.address,
    SUM(vp.payment_amount) as total_revenue,
    SUM(CASE WHEN DATE(vp.check_out_time) = CURRENT_DATE THEN vp.payment_amount ELSE 0 END) as today_revenue,
    SUM(CASE WHEN vp.check_out_time >= CURRENT_DATE - INTERVAL '7 days' THEN vp.payment_amount ELSE 0 END) as this_week_revenue,
    SUM(CASE WHEN DATE_TRUNC('month', vp.check_out_time) = DATE_TRUNC('month', CURRENT_DATE) THEN vp.payment_amount ELSE 0 END) as this_month_revenue,
    COUNT(*) as total_vehicles
  FROM locations l
  INNER JOIN vehicle_payments vp ON l.id = vp.location_id
  WHERE l.contractor_id = :contractor_id
    AND l.is_deleted = false
  GROUP BY l.id, l.locations_name, l.address
),
attendant_income AS (
  SELECT 
    vp.location_id,
    COALESCE(vp.attendant_name, p.user_name, 'Unknown Attendant') as attendant_name,
    COALESCE(a.id, vp.gate_in_id::text) as attendant_id,
    SUM(vp.payment_amount) as total_revenue,
    SUM(CASE WHEN DATE(vp.check_out_time) = CURRENT_DATE THEN vp.payment_amount ELSE 0 END) as today_revenue,
    SUM(CASE WHEN vp.check_out_time >= CURRENT_DATE - INTERVAL '7 days' THEN vp.payment_amount ELSE 0 END) as this_week_revenue,
    SUM(CASE WHEN DATE_TRUNC('month', vp.check_out_time) = DATE_TRUNC('month', CURRENT_DATE) THEN vp.payment_amount ELSE 0 END) as this_month_revenue,
    COUNT(*) as total_vehicles
  FROM vehicle_payments vp
  LEFT JOIN attendants a ON a.user_id = vp.gate_in_id
  LEFT JOIN profiles p ON p.id = a.user_id
  GROUP BY vp.location_id, attendant_name, attendant_id
)
SELECT 
  c.id as contractor_id,
  c.company_name as contractor_name,
  (SELECT SUM(total_revenue) FROM location_income) as total_revenue,
  (SELECT SUM(today_revenue) FROM location_income) as today_revenue,
  (SELECT SUM(this_week_revenue) FROM location_income) as this_week_revenue,
  (SELECT SUM(this_month_revenue) FROM location_income) as this_month_revenue,
  json_agg(
    json_build_object(
      'location_id', li.location_id,
      'location_name', li.location_name,
      'address', li.address,
      'total_revenue', li.total_revenue,
      'today_revenue', li.today_revenue,
      'this_week_revenue', li.this_week_revenue,
      'this_month_revenue', li.this_month_revenue,
      'total_vehicles', li.total_vehicles,
      'attendants', (
        SELECT json_agg(
          json_build_object(
            'attendant_id', ai.attendant_id,
            'attendant_name', ai.attendant_name,
            'total_revenue', ai.total_revenue,
            'today_revenue', ai.today_revenue,
            'this_week_revenue', ai.this_week_revenue,
            'this_month_revenue', ai.this_month_revenue,
            'total_vehicles', ai.total_vehicles
          ) ORDER BY ai.attendant_name
        )
        FROM attendant_income ai
        WHERE ai.location_id = li.location_id
      )
    ) ORDER BY li.location_name
  ) as locations
FROM contractors c
LEFT JOIN location_income li ON true
WHERE c.id = :contractor_id
GROUP BY c.id, c.company_name;
```

## Error Responses

### 401 Unauthorized
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You don't have permission to access this resource"
  }
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": {
    "code": "CONTRACTOR_NOT_FOUND",
    "message": "Contractor not found"
  }
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An error occurred while processing your request"
  }
}
```

## Example Request

```bash
GET /api/income/contractor/location-wise?contractor_id=123e4567-e89b-12d3-a456-426614174000

# Or with POST
POST /api/income/contractor/location-wise
Content-Type: application/json

{
  "contractor_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

## Example Response

```json
{
  "success": true,
  "data": {
    "contractor_id": "123e4567-e89b-12d3-a456-426614174000",
    "contractor_name": "Vyas Enterprises",
    "total_revenue": 50000.00,
    "today_revenue": 1500.00,
    "this_week_revenue": 8500.00,
    "this_month_revenue": 25000.00,
    "locations": [
      {
        "location_id": "loc-001",
        "location_name": "Downtown Parking",
        "address": "123 Main St, City",
        "total_revenue": 30000.00,
        "today_revenue": 1000.00,
        "this_week_revenue": 5000.00,
        "this_month_revenue": 15000.00,
        "total_vehicles": 150,
        "attendants": [
          {
            "attendant_id": "att-001",
            "attendant_name": "John Doe",
            "attendant_email": "john@example.com",
            "total_revenue": 18000.00,
            "today_revenue": 600.00,
            "this_week_revenue": 3000.00,
            "this_month_revenue": 9000.00,
            "total_vehicles": 90
          },
          {
            "attendant_id": "att-002",
            "attendant_name": "Jane Smith",
            "attendant_email": "jane@example.com",
            "total_revenue": 12000.00,
            "today_revenue": 400.00,
            "this_week_revenue": 2000.00,
            "this_month_revenue": 6000.00,
            "total_vehicles": 60
          }
        ]
      },
      {
        "location_id": "loc-002",
        "location_name": "Mall Parking",
        "address": "456 Mall Rd, City",
        "total_revenue": 20000.00,
        "today_revenue": 500.00,
        "this_week_revenue": 3500.00,
        "this_month_revenue": 10000.00,
        "total_vehicles": 100,
        "attendants": [
          {
            "attendant_id": "att-003",
            "attendant_name": "Bob Johnson",
            "attendant_email": "bob@example.com",
            "total_revenue": 20000.00,
            "today_revenue": 500.00,
            "this_week_revenue": 3500.00,
            "this_month_revenue": 10000.00,
            "total_vehicles": 100
          }
        ]
      }
    ]
  },
  "message": "Income data retrieved successfully"
}
```

## Notes for Backend Team

1. **Performance**: Consider caching this data if it's accessed frequently, as it involves aggregations across multiple tables.

2. **Pagination**: If the contractor has many locations/attendants, consider adding pagination support.

3. **Date Timezone**: Ensure all date calculations use the same timezone (preferably UTC or the contractor's timezone).

4. **Null Handling**: Handle cases where:
   - A location has no vehicles
   - An attendant name is missing
   - Payment amounts are null or zero

5. **Authorization**: Ensure the authenticated user is a contractor and can only access their own data.

6. **Indexing**: Ensure proper indexes on:
   - `vehicles.contractor_id`
   - `vehicles.location_id`
   - `vehicles.check_out_time`
   - `vehicles.gate_in_id`
   - `locations.contractor_id`

## Frontend Integration

Once this API is implemented, the frontend will call it like this:

```typescript
const response = await apiClient.get('/income/contractor/location-wise', {
  contractor_id: contractor.id
});

// Response will be in the exact hierarchical structure needed
setLocationIncomes(response.data.locations);
```

This will replace the current frontend logic that fetches all vehicles and processes them client-side.

