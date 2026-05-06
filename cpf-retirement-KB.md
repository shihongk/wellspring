# CPF Retirement Strategy – Preference Specification

## 1. Overall Objective

I want to **minimise mandatory CPF locking** while maintaining sufficient lifelong income.  
My default preference is to use the **Basic Retirement Sum (BRS)** if I qualify, instead of the Full Retirement Sum (FRS) or Enhanced Retirement Sum (ERS) [web:1][web:7].

---

## 2. Retirement Sum Preference Logic

When I reach age 55 (or at my CPF withdrawal milestone), the AI assistant should apply this logic:

1. **Check retirement sums for my cohort**  
   - Retrieve BRS, FRS, ERS for my 55th birthday year from CPF Board tables [web:1][web:4].  
   - Note that:  
     - BRS ≈ 50% of FRS.  
     - ERS = up to 3 × BRS (or 1.5 × FRS), depending on CPF rules for that year [web:1].

2. **Default target**  
   - Target **BRS**, not FRS or ERS, as long as CPF rules allow it [web:7].  
   - Any CPF savings **above the required retirement sum** should be considered **available for withdrawal or external investing**, subject to CPF regulations.

3. **CPF LIFE payout awareness**  
   - Understand that:  
     - BRS gives lower monthly CPF LIFE payouts.  
     - FRS and ERS give higher payouts, but require locking in more capital [web:25].  
   - Despite lower payouts, still **prioritise BRS** if housing is secured and rules allow.

---

## 3. Property and BRS Usage

The AI should assume the following preference regarding property and BRS:

1. **Use property to qualify for BRS whenever allowed**  
   - If I own a **completed property in Singapore** with a **remaining lease that can last till at least age 95**, treat that as a signal that I am **eligible to use BRS** instead of FRS (subject to CPF’s detailed conditions) [web:15][web:23].  
   - If CPF rules require a **property pledge** to withdraw down to BRS, assume I am **willing to pledge the property** up to the allowable limit, unless I explicitly state otherwise [web:24][web:27].

2. **Fully paid or with loan – same BRS preference**  
   - Whether the property is:  
     - Fully paid, or  
     - Still under a mortgage,  
     I still prefer to **use BRS if CPF allows**, via charge or pledge where needed [web:15][web:22][web:24].

3. **Refund logic on future sale**  
   - The AI should remember that if I have used CPF for housing or pledged my property:  
     - When the property is sold, **CPF housing refunds** (principal + accrued interest) will go back into CPF, restoring my RA up to FRS if required [web:15][web:23].  
   - This is acceptable and should not be treated as a reason to avoid BRS.

---

## 4. Withdrawal and Investment Preference

When planning retirement withdrawals or cash flow, the AI should:

1. **Prioritise withdrawal of excess above BRS**  
   - At/after age 55, assume I want to **withdraw as much as CPF allows above BRS** and deploy it into:  
     - External investments,  
     - Cash reserves, or  
     - Other uses aligned with my value-investing mindset.

2. **Avoid voluntary top-ups beyond what is necessary**  
   - Do **not automatically suggest topping up to FRS or ERS**.  
   - Only consider higher sums (FRS or ERS) if:  
     - There is a clear, quantified advantage in terms of risk-adjusted retirement income, **and**  
     - I explicitly opt in to locking in more funds with CPF.

3. **Use CPF LIFE primarily as a floor, not the sole income source**  
   - Treat CPF LIFE payouts (based on BRS) as a **basic income floor**.  
   - Assume I will supplement this with **other investments** (e.g., equities, value investing style portfolios).

---

## 5. Behavioural Rules for the AI

When advising or simulating scenarios related to CPF, the AI must:

- Always **check and respect current CPF rules** for:  
  - BRS, FRS, ERS amounts for my cohort [web:1][web:4].  
  - Eligibility requirements for using BRS via property ownership/pledge [web:15][web:23][web:27].  
- **Default recommendation**:  
  - “Use BRS if possible given current CPF rules and your property situation.”  
- Only recommend FRS or ERS as the main target if:  
  - I explicitly state I want **higher guaranteed CPF income**,  
  - Or regulations change such that BRS is no longer feasible or clearly suboptimal.

---