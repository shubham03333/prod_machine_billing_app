# TODO: Implement JCB (Excavator) Hourly Work with Normal and Breaker Types

## Overview
The app already has JCB (excavator) as a machine type. Add support for JCB hourly work with two types: Normal and Breaker. Normal work uses a previously selected hourly rate, while Breaker work has a different hourly rate. Include a button to mark time slots as Breaker, calculate amounts accordingly, and display the total calculated amount. This will be implemented in the existing excavator/JCB rental creation and editing logic.

## Database Updates
- [x] Add JCB model or extend existing Rental model in Prisma schema to include:
  - normalHourlyRate (decimal)
  - breakerHourlyRate (decimal)
  - timeSlots (array of objects with startTime, endTime, isBreaker boolean, calculatedAmount)

## UI Updates for JCB Hourly Work
- [x] Update Rental interface in page.tsx to include JCB hourly fields
- [x] Add form fields for normal and breaker hourly rates in add/edit rental forms
- [x] Add time slot management UI:
  - Input fields for start and end times
  - Button to mark time slot as Breaker
  - Display calculated amount per slot based on type
- [x] Display total calculated amount for all time slots
- [x] Update createRental and updateRental functions to handle JCB hourly data

## Calculation Logic
- [x] Implement function to calculate amount per time slot:
  - If normal: hours * normalHourlyRate
  - If breaker: hours * breakerHourlyRate
- [x] Implement total amount calculation summing all slot amounts
- [x] Ensure calculations update in real-time as slots are added/edited

## API Updates
- [x] Update rental API routes to handle JCB hourly data (create, update, fetch)
- [x] Add validation for rates and time slots

## Testing
- [x] Test adding JCB rentals with normal and breaker rates
- [x] Test adding time slots with Breaker button
- [x] Test amount calculations for individual slots and total
- [x] Test editing JCB rentals
- [x] Verify mobile responsiveness for new UI elements
