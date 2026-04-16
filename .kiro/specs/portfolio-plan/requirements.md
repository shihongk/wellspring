# Requirements Document

## Introduction

This feature redesigns the Plan tab of the Wellspring portfolio tracker. It replaces the existing flat monthly SGD target list with two capabilities:

1. **Target Allocation** — the user sets a target percentage for each equity holding. The dashboard and plan tab show a gap analysis comparing current allocation to target.
2. **Monthly Investment Schedule** — the user enters a forward-looking purchase plan directly in Google Sheets (month, ticker, planned SGD). The app reads this and recommends how many units to buy at the current live price to close the gap toward target allocation.

The app is read-only with respect to the monthly schedule (user edits Google Sheets directly). Target allocations are editable in the app UI.

---

## Glossary

- **Target_Allocation**: A user-defined percentage representing the desired portfolio weight for a single equity holding.
- **Allocation_Editor**: The UI component on the Plan tab that allows the user to view and edit Target_Allocation values.
- **Gap_Analysis**: A comparison of each holding's current allocation percentage against its Target_Allocation, expressed as a signed difference (positive = underweight, negative = overweight).
- **Monthly_Schedule**: A Google Sheets tab (`InvestmentSchedule`) containing rows of planned purchases with columns: month (e.g. "Apr 2026"), ticker, holding name, and planned SGD amount.
- **Schedule_Viewer**: The UI component on the Plan tab that displays Monthly_Schedule rows grouped by month.
- **Purchase_Recommendation**: A calculated suggestion of how many units of a holding to buy, derived from the planned SGD amount divided by the current live price.
- **Plan_Tab**: The `/plan` page of the Wellspring app.
- **Dashboard**: The `/dashboard` page of the Wellspring app.
- **TargetAllocation_Sheet**: A Google Sheets tab (`TargetAllocation`) containing rows of ticker and target percentage.
- **Holdings**: The equity positions BRK-B, JK8.SI, 2823.HK, 2838.HK, and TSM.
- **Available_Cash**: The total cash balance displayed on the Plan tab as an informational figure representing funds available to invest. It has no target allocation.
- **Live_Price**: The current market price of a holding fetched from the existing prices API.

---

## Requirements

### Requirement 1: Target Allocation Storage

**User Story:** As a portfolio investor, I want to store a target allocation percentage for each equity holding in Google Sheets, so that the app can persist my intended portfolio weights.

#### Acceptance Criteria

1. THE `TargetAllocation_Sheet` SHALL contain one row per equity holding with columns: `ticker` and `target_pct`.
2. WHEN the `TargetAllocation_Sheet` is missing or empty, THE Plan_Tab SHALL display zero as the target percentage for all holdings.

---

### Requirement 2: Target Allocation Editing

**User Story:** As a portfolio investor, I want to edit my target allocation percentages in the app, so that I can adjust my intended portfolio weights without opening Google Sheets.

#### Acceptance Criteria

1. THE Allocation_Editor SHALL display one editable percentage input per equity holding (BRK-B, JK8.SI, 2823.HK, 2838.HK, TSM).
2. THE Allocation_Editor SHALL display a running total of all entered target percentages.
3. THE Plan_Tab SHALL display the current total cash balance as an informational "available to invest" figure; CASH SHALL have no target allocation input.
4. WHEN the user submits the Allocation_Editor form, THE Plan_Tab SHALL write the updated target percentages to the `TargetAllocation_Sheet`.
5. IF the Google Sheets write fails, THEN THE Allocation_Editor SHALL display an error message to the user.

---

### Requirement 3: Gap Analysis on the Dashboard

**User Story:** As a portfolio investor, I want to see my target allocation alongside my current allocation on the dashboard, so that I can quickly identify which holdings are overweight or underweight.

#### Acceptance Criteria

1. THE Dashboard SHALL display a `target %` column in the holdings allocation table showing the Target_Allocation for each equity holding.
2. THE Dashboard SHALL display a `gap` column showing the signed difference: `target_pct − current_allocation_pct`, rounded to one decimal place.
3. WHEN the gap value is positive (holding is underweight), THE Dashboard SHALL render the gap value in green.
4. WHEN the gap value is negative (holding is overweight), THE Dashboard SHALL render the gap value in red.
5. WHEN the gap value is zero, THE Dashboard SHALL render the gap value in a neutral colour.
6. WHEN a holding has no Target_Allocation set (value is zero or absent), THE Dashboard SHALL display `—` in the target and gap columns for that holding.

---

### Requirement 4: Gap Analysis on the Plan Tab

**User Story:** As a portfolio investor, I want to see the gap analysis on the Plan tab, so that I have a consolidated view of allocation targets and deviations alongside my investment schedule.

#### Acceptance Criteria

1. THE Plan_Tab SHALL display a gap analysis table with columns: ticker, holding name, current allocation %, target %, and gap %.
2. THE Plan_Tab gap analysis table SHALL apply the same colour coding rules as defined in Requirement 3 acceptance criteria 3–5.
3. WHEN a holding has no Target_Allocation set, THE Plan_Tab SHALL display `—` in the target and gap columns for that holding.

---

### Requirement 5: Monthly Investment Schedule Storage

**User Story:** As a portfolio investor, I want to store a forward-looking monthly purchase plan in Google Sheets, so that the app can read and display my intended investments.

#### Acceptance Criteria

1. THE `InvestmentSchedule` sheet SHALL contain one row per planned purchase with columns: `month` (e.g. "Apr 2026"), `ticker`, `name`, and `planned_sgd`.
2. THE `InvestmentSchedule` sheet SHALL be edited directly by the user in Google Sheets; THE Plan_Tab SHALL treat it as read-only.
3. WHEN the `InvestmentSchedule` sheet is missing or empty, THE Schedule_Viewer SHALL display an empty state message.

---

### Requirement 6: Monthly Schedule Display

**User Story:** As a portfolio investor, I want to view my monthly investment schedule in the app, so that I can see what purchases are planned for each month.

#### Acceptance Criteria

1. THE Schedule_Viewer SHALL group planned purchases by month and display them in chronological order.
2. THE Schedule_Viewer SHALL display the current month and all future months by default.
3. WHEN the user activates the "Show past months" toggle, THE Schedule_Viewer SHALL also display months prior to the current month.
4. THE Schedule_Viewer SHALL display for each row: month, ticker, holding name, and planned SGD amount.

---

### Requirement 7: Purchase Recommendations

**User Story:** As a portfolio investor, I want the app to recommend how many units to buy for each planned purchase, so that I can execute the right trade size without manual calculation.

#### Acceptance Criteria

1. WHEN a Live_Price is available for a holding, THE Schedule_Viewer SHALL display a recommended unit quantity calculated as `floor(planned_sgd / current_price_sgd)`.
2. THE Schedule_Viewer SHALL display the Live_Price used for the recommendation alongside the unit quantity.
3. WHEN a Live_Price is unavailable for a holding, THE Schedule_Viewer SHALL display `—` in the recommended units column and indicate that the price is unavailable.
4. WHEN prices are stale (fetched more than 24 hours ago), THE Schedule_Viewer SHALL display a staleness warning adjacent to the affected price.

---

### Requirement 8: Plan Tab Layout

**User Story:** As a portfolio investor, I want the Plan tab to present both the allocation editor and the investment schedule in a clear layout, so that I can manage both aspects of my plan in one place.

#### Acceptance Criteria

1. THE Plan_Tab SHALL present the Allocation_Editor section and the Schedule_Viewer section as distinct, labelled sections on the same page.
2. THE Plan_Tab SHALL load target allocation data and schedule data in a single server-side render pass.
3. WHEN either data source is unavailable, THE Plan_Tab SHALL render the available section normally and display an error state for the unavailable section.
