# Planning Board API Endpoints

This document provides a comprehensive list of all the API endpoints used in the planning board codebase, along with their respective JavaScript functions, HTTP methods, and parameter details.

## Endpoint Summary Table

| # | JS Function | HTTP Method | API Endpoint | Description |
|---|-------------|-------------|--------------|-------------|
| 1 | `fetchAndSetCsrfToken` | GET | `/api/method/asl_core.asl_production.doctype.strip.strip.get_csrf_token` | Fetches a new CSRF token. |
| 2 | `login` | POST | `/api/method/login` | Authenticates a user with username (`usr`) and password (`pwd`). |
| 3 | `logout` | POST | `/api/method/logout` | Logs out the current user and clears session tokens. |
| 4 | `getLoggedUser` | GET | `/api/method/frappe.auth.get_logged_user` | Gets information about the currently logged-in user. |
| 5 | `getWorkHourDateRange` | GET | `/api/method/asl_core.api.external.planning_board.get_work_hour_date_range` | Fetches the work hour date range for a planning board. |
| 6 | `getPlanningBoards` | GET | `/api/method/asl_core.api.external.planning_board.get_planning_boards` | Retrieves a list of available planning boards. |
| 7 | `getFloorLineData` | GET | `/api/method/asl_core.asl_production.doctype.sewing_planning_board_setup.sewing_planning_board_setup.get_floors_and_lines` | Fetches floors and lines data for a planning board. |
| 8 | `getWorkHourData` | GET | `/api/method/asl_core.asl_production.doctype.work_hour_management_tool.work_hour_management_tool.get_daily_work_hours` | Fetches daily work hours data. |
| 9 | `getStripsWithLearningCurve` | GET | `/api/method/asl_core.asl_production.doctype.strip.strip.get_strips_with_learning_curve` | Retrieves strips data with learning curves. |
| 10 | `getShiftDetails` | GET | `/api/method/asl_core.api.external.shift.get_shift_details` | Fetches shift specific setup details. |
| 11 | `updateStripsFromTyson` | POST | `/api/method/asl_core.asl_production.doctype.strip.strip.update_strips_from_tyson` | Updates strips data imported from Tyson (CSRF Protected). |
| 12 | `saveTysonChanges` | POST | `/api/method/asl_core.asl_production.doctype.strip.strip.save_tyson_changes` | Saves modifications made to Tyson data (CSRF Protected). |

---

## Detailed Endpoint Breakdown

### 1. Get CSRF Token
- **Function:** `fetchAndSetCsrfToken()`
- **Method:** `GET`
- **Endpoint:** `/api/method/asl_core.asl_production.doctype.strip.strip.get_csrf_token`
- **Description:** Used to securely retrieve a CSRF token if it is not present in the browser cookies.

### 2. User Login
- **Function:** `login(usr, pwd)`
- **Method:** `POST`
- **Endpoint:** `/api/method/login`
- **Payload:**
```json
  {
    "usr": "username",
    "pwd": "password"
  }

```

### 3. User Logout

* **Function:** `logout()`
* **Method:** `POST`
* **Endpoint:** `/api/method/logout`

### 4. Get Logged-in User

* **Function:** `getLoggedUser()`
* **Method:** `GET`
* **Endpoint:** `/api/method/frappe.auth.get_logged_user`

### 5. Get Work Hour Date Range

* **Function:** `getWorkHourDateRange(planningBoard)`
* **Method:** `GET`
* **Endpoint:** `/api/method/asl_core.api.external.planning_board.get_work_hour_date_range`
* **Query Parameters:**
* `planning_board_name` (String, Required)



### 6. Get Planning Boards

* **Function:** `getPlanningBoards()`
* **Method:** `GET`
* **Endpoint:** `/api/method/asl_core.api.external.planning_board.get_planning_boards`

### 7. Get Floors and Lines Data

* **Function:** `getFloorLineData(planningBoard)`
* **Method:** `GET`
* **Endpoint:** `/api/method/asl_core.asl_production.doctype.sewing_planning_board_setup.sewing_planning_board_setup.get_floors_and_lines`
* **Query Parameters:**
* `planning_board_name` (String, Default fallback: `Sewing Board-MF-020226-02882`)



### 8. Get Daily Work Hours Data

* **Function:** `getWorkHourData(fromDate, toDate, planningBoard)`
* **Method:** `GET`
* **Endpoint:** `/api/method/asl_core.asl_production.doctype.work_hour_management_tool.work_hour_management_tool.get_daily_work_hours`
* **Query Parameters:**
* `company` (String, Hardcoded: `M.I.M Fashion Wear Ltd.`)
* `planning_board_name` (String)
* `from_date` (String, Format: `YYYY-MM-DD`)
* `to_date` (String, Format: `YYYY-MM-DD`)



### 9. Get Strips With Learning Curve

* **Function:** `getStripsWithLearningCurve(planningBoard)`
* **Method:** `GET`
* **Endpoint:** `/api/method/asl_core.asl_production.doctype.strip.strip.get_strips_with_learning_curve`
* **Query Parameters:**
* `planning_board_name` (String)



### 10. Get Shift Details

* **Function:** `getShiftDetails()`
* **Method:** `GET`
* **Endpoint:** `/api/method/asl_core.api.external.shift.get_shift_details`

### 11. Update Strips From Tyson

* **Function:** `updateStripsFromTyson(stripsData)`
* **Method:** `POST` (Requires `X-Frappe-CSRF-Token` header)
* **Endpoint:** `/api/method/asl_core.asl_production.doctype.strip.strip.update_strips_from_tyson`
* **Payload:**

```json
  {
    "data": "STRINGIFIED_STRIPS_DATA"
  }

```

### 12. Save Tyson Changes

* **Function:** `saveTysonChanges(changes)`
* **Method:** `POST` (Requires `X-Frappe-CSRF-Token` header)
* **Endpoint:** `/api/method/asl_core.asl_production.doctype.strip.strip.save_tyson_changes`
* **Payload:**

```json
  {
    "data": "STRINGIFIED_CHANGES_DATA"
  }

```