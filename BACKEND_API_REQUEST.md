# Backend API Request: Hierarchical Income Data

## Request Summary
हमें एक नया API endpoint चाहिए जो contractor के लिए income data को **hierarchical structure** में return करे: **Location-wise → Attendant-wise**

## Endpoint
```
GET /api/income/contractor/location-wise
या
POST /api/income/contractor/location-wise
```

## Required Response Structure

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
            "total_revenue": 0.00,
            "today_revenue": 0.00,
            "this_week_revenue": 0.00,
            "this_month_revenue": 0.00,
            "total_vehicles": 0
          }
        ]
      }
    ]
  }
}
```

## Key Requirements

1. **Data Source**: 
   - `vehicles` table से data लेना है
   - केवल `check_out_time IS NOT NULL` और `payment_amount > 0` वाले vehicles
   - `is_deleted = false` वाले vehicles

2. **Grouping**:
   - पहले `location_id` से group करना है
   - फिर हर location में `attendant_name` या `gate_in_id` से attendant identify करके group करना है

3. **Revenue Calculations**:
   - **Total Revenue**: सभी checked-out vehicles का `payment_amount` का sum
   - **Today Revenue**: आज checkout हुए vehicles का sum
   - **This Week Revenue**: पिछले 7 दिनों में checkout हुए vehicles का sum
   - **This Month Revenue**: current month में checkout हुए vehicles का sum

4. **Attendant Name**:
   - Priority 1: `vehicle.attendant_name` (अगर available है)
   - Priority 2: `gate_in_id` से `attendants` table join करके `profiles.user_name` लेना
   - Fallback: "Unknown Attendant"

5. **Filtering**:
   - Authenticated contractor की सभी locations show करनी हैं
   - केवल उन locations जिनमें कम से कम एक vehicle payment है

6. **Sorting**:
   - Locations: alphabetically by `location_name`
   - Attendants: alphabetically by `attendant_name` (within each location)

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
        "address": "123 Main St",
        "total_revenue": 30000.00,
        "today_revenue": 1000.00,
        "this_week_revenue": 5000.00,
        "this_month_revenue": 15000.00,
        "total_vehicles": 150,
        "attendants": [
          {
            "attendant_id": "att-001",
            "attendant_name": "John Doe",
            "total_revenue": 18000.00,
            "today_revenue": 600.00,
            "this_week_revenue": 3000.00,
            "this_month_revenue": 9000.00,
            "total_vehicles": 90
          },
          {
            "attendant_id": "att-002",
            "attendant_name": "Jane Smith",
            "total_revenue": 12000.00,
            "today_revenue": 400.00,
            "this_week_revenue": 2000.00,
            "this_month_revenue": 6000.00,
            "total_vehicles": 60
          }
        ]
      }
    ]
  }
}
```

## Important Notes

- यह API केवल authenticated contractor के लिए होनी चाहिए
- Authorization check करना है कि user अपने ही data access कर रहा है
- Performance के लिए proper indexing ensure करें
- Date calculations में timezone consistency maintain करें

## Full Specification
Detailed specification के लिए `API_SPECIFICATION_INCOME_HIERARCHICAL.md` file देखें।

