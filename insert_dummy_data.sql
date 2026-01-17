-- Insert dummy data into machines_db
-- Run this after creating the database tables with setup_database.sql

USE machines_db;

-- Fix table defaults if needed
ALTER TABLE User MODIFY updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
ALTER TABLE Customer MODIFY updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
ALTER TABLE Rental MODIFY updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
ALTER TABLE Expense MODIFY updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Insert Users
INSERT INTO User (name, role, pin) VALUES
('John Doe', 'admin', '1234'),
('Jane Smith', 'operator', '5678'),
('Bob Johnson', 'operator', '9012');

-- Insert Customers
INSERT INTO Customer (name, contactNumber, address) VALUES
('Rajesh Kumar', '9876543210', 'Village Rampur, District Meerut, UP'),
('Sita Devi', '9876543211', 'Farm House, Sector 15, Gurgaon, Haryana'),
('Mohan Singh', '9876543212', 'Plot 45, Industrial Area, Faridabad, Haryana');

-- Insert Rentals
INSERT INTO Rental (machineType, unitType, quantity, acreage, pricePerUnit, totalAmount, customerId, operatorId, date, dieselCost, maintenanceCost, operatorSalary) VALUES
('tractor', 'hourly', 5, NULL, 50, 250, 1, 2, '2023-10-01 00:00:00', 500, 200, 300),
('harvester', 'acre', 10, 2.5, 100, 1000, 2, 3, '2023-10-02 00:00:00', 800, 150, 400),
('excavator', 'trip', 3, NULL, 200, 600, 3, 2, '2023-10-03 00:00:00', 600, 100, 350);

-- Insert Expenses
INSERT INTO Expense (description, amount, date, operatorId) VALUES
('Diesel for tractor maintenance', 500, '2023-10-01 00:00:00', 2),
('Maintenance parts for harvester', 150, '2023-10-02 00:00:00', 3),
('Operator salary for excavator work', 350, '2023-10-03 00:00:00', 2);
