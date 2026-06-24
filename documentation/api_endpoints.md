# Planning Board API Endpoints

This document provides an exhaustive reference of all available API endpoints, mapped against their corresponding JavaScript client functions, HTTP methods, and required payloads/query parameters.

---

## 1. Endpoint Summary Table

| # | Category | HTTP Method | API Endpoint | JS Function Match |
|---|---|---|---|---|
| 1 | **Auth** | POST | `/api/method/login` | `login(usr, pwd)` |
| 2 | **Auth** | POST | `/api/method/logout` | `logout()` |
| 3 | **Auth** | GET | `/api/method/frappe.auth.get_logged_user` | `getLoggedUser()` |
| 4 | **Auth** | GET | `/api/method/asl_core.asl_production.doctype.strip.strip.get_csrf_token` | `fetchAndSetCsrfToken()` |
| 5 | **Planning Boards** | GET | `/api/method/asl_core.api.external.planning_board.get_planning_boards` | `getPlanningBoards()` |
| 6 | **Planning Boards** | GET | `/api/method/asl_core.api.external.planning_board.get_work_hour_date_range` | `getWorkHourDateRange(board)` |
| 7 | **Floors & Lines** | GET | `/api/method/asl_core.asl_production.doctype.sewing_planning_board_setup.sewing_planning_board_setup.get_floors_and_lines` | `getFloorLineData(board)` |
| 8 | **Floors & Lines** | GET | `/api/method/asl_core.api.external.setup.get_floor_details` | *None (Direct Call Only)* |
| 9 | **Floors & Lines** | GET | `/api/method/asl_core.api.external.setup.get_line_details` | *None (Direct Call Only)* |
| 10 | **Work Hours** | GET | `/api/method/asl_core.asl_production.doctype.work_hour_management_tool.work_hour_management_tool.get_daily_work_hours` | `getWorkHourData(...)` |
| 11 | **Shifts** | GET | `/api/method/asl_core.api.external.shift.get_shift_details` | `getShiftDetails()` |
| 12 | **Strips** | GET | `/api/method/asl_core.asl_production.doctype.strip.strip.get_strips_with_learning_curve` | `getStripsWithLearningCurve(board)` |
| 13 | **Strips** | POST | `/api/method/asl_core.asl_production.doctype.strip.strip.get_overlapping_intervals` | *None (Requires CSRF Token)* |
| 14 | **Strips** | POST | `/api/method/asl_core.asl_production.doctype.strip.strip.merge_strip` | *None (Requires CSRF Token)* |
| 15 | **Strips** | POST | `/api/method/asl_core.asl_production.doctype.strip.strip.update_merged_strips` | *None (Requires CSRF Token)* |
| 16 | **Strips** | POST | `/api/method/asl_core.asl_production.doctype.strip.strip.freeze_form` | *None (Requires CSRF Token)* |
| 17 | **Strips** | POST | `/api/method/asl_core.asl_production.doctype.strip.strip.update_strips_from_tyson` | `updateStripsFromTyson(data)` |
| 18 | **Strips** | POST | `/api/method/asl_core.asl_production.doctype.strip.strip.save_tyson_changes` | `saveTysonChanges(changes)` |

---

## 2. Detailed Endpoint Breakdown

### ─── Auth ───

#### User Login
- **Method:** `POST`
- **Endpoint:** `/api/method/login`
- **Headers:** `Content-Type: application/json`
- **Payload Structure:**
```json
  {
      "usr": "Administrator",
      "pwd": "password_here"
  }

```

#### User Logout

* **Method:** `POST`
* **Endpoint:** `/api/method/logout`

#### Get Logged User

* **Method:** `GET`
* **Endpoint:** `/api/method/frappe.auth.get_logged_user`

#### Get CSRF Token

* **Method:** `GET`
* **Endpoint:** `/api/method/asl_core.asl_production.doctype.strip.strip.get_csrf_token`

---

### ─── Planning Boards ───

#### Get All Planning Boards

* **Method:** `GET`
* **Endpoint:** `/api/method/asl_core.api.external.planning_board.get_planning_boards`
* **Optional Query Parameter:** `?company=Company Name`

#### Get Work Hour Date Range

* **Method:** `GET`
* **Endpoint:** `/api/method/asl_core.api.external.planning_board.get_work_hour_date_range`
* **Query Parameter:** `?planning_board_name=Board_Name`

---

### ─── Floors & Lines ───

#### Get Floors and Lines

* **Method:** `GET`
* **Endpoint:** `/api/method/asl_core.asl_production.doctype.sewing_planning_board_setup.sewing_planning_board_setup.get_floors_and_lines`
* **Query Parameter:** `?planning_board_name=Board_Name`

#### Get Floor Details

* **Method:** `GET`
* **Endpoint:** `/api/method/asl_core.api.external.setup.get_floor_details`

#### Get Line Details

* **Method:** `GET`
* **Endpoint:** `/api/method/asl_core.api.external.setup.get_line_details`
* **Optional Query Parameter:** `?floor_id=1`

---

### ─── Work Hours ───

#### Get Daily Work Hours

* **Method:** `GET`
* **Endpoint:** `/api/method/asl_core.asl_production.doctype.work_hour_management_tool.work_hour_management_tool.get_daily_work_hours`
* **Query Parameters:** `?company=Company Name&planning_board_name=Board_Name&from_date=YYYY-MM-DD&to_date=YYYY-MM-DD`

---

### ─── Shifts ───

#### Get Shift Details

* **Method:** `GET`
* **Endpoint:** `/api/method/asl_core.api.external.shift.get_shift_details`
* **Optional Query Parameter:** `?shift_name=General`

---

### ─── Strips ───

#### Get Strips with Learning Curve

* **Method:** `GET`
* **Endpoint:** `/api/method/asl_core.asl_production.doctype.strip.strip.get_strips_with_learning_curve`
* **Query Parameter:** `?planning_board_name=Board_Name`

#### Get Overlapping Intervals

* **Method:** `POST`
* **Endpoint:** `/api/method/asl_core.asl_production.doctype.strip.strip.get_overlapping_intervals`
* **Headers:** Includes `X-Frappe-CSRF-Token`
* **Payload Structure:**

```json
  {
      "doc": "{}"
  }

```

#### Merge Strip

* **Method:** `POST`
* **Endpoint:** `/api/method/asl_core.asl_production.doctype.strip.strip.merge_strip`
* **Headers:** Includes `X-Frappe-CSRF-Token`
* **Payload Structure:**

```json
  {
      "source_name": "STRIP-0001"
  }

```

#### Update Merged Strips

* **Method:** `POST`
* **Endpoint:** `/api/method/asl_core.asl_production.doctype.strip.strip.update_merged_strips`
* **Headers:** Includes `X-Frappe-CSRF-Token`
* **Payload Structure:**

```json
  {
      "merged_strips_json": "[]",
      "merged_with_json": "[]"
  }

```

#### Freeze Form

* **Method:** `POST`
* **Endpoint:** `/api/method/asl_core.asl_production.doctype.strip.strip.freeze_form`
* **Headers:** Includes `X-Frappe-CSRF-Token`
* **Payload Structure:**

```json
  {
      "doc": "{}"
  }

```

#### Update Strips from Tyson

* **Method:** `POST`
* **Endpoint:** `/api/method/asl_core.asl_production.doctype.strip.strip.update_strips_from_tyson`
* **Headers:** Includes `X-Frappe-CSRF-Token`
* **Payload Structure:**

```json
  {
      "data": "[]"
  }

```

#### Save Tyson Changes

* **Method:** `POST`
* **Endpoint:** `/api/method/asl_core.asl_production.doctype.strip.strip.save_tyson_changes`
* **Headers:** Includes `X-Frappe-CSRF-Token`
* **Payload Structure:**

```json
  {
      "data": "{\"updates\": [], \"splits\": [], \"merges\": []}"
  }

```