-- SQL script to create the machines_db database and tables on AWS EC2 MySQL instance
-- Database connection details:
-- Host: 3.110.217.70
-- Username: root
-- Password: Sbmntn@2
-- Database: machines_db

-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS machines_db;
USE machines_db;

-- Create User table
CREATE TABLE IF NOT EXISTS User (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(255) NOT NULL COMMENT 'admin or operator',
    pin VARCHAR(4) NOT NULL UNIQUE COMMENT '4-digit PIN',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create Customer table
CREATE TABLE IF NOT EXISTS Customer (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    contactNumber VARCHAR(255) NOT NULL,
    address VARCHAR(255) NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create Rental table
CREATE TABLE IF NOT EXISTS Rental (
    id INT AUTO_INCREMENT PRIMARY KEY,
    machineType VARCHAR(255) NOT NULL COMMENT 'tractor, harvester, excavator',
    unitType VARCHAR(255) NOT NULL COMMENT 'hourly, trip, acre, guntha',
    quantity FLOAT NOT NULL,
    acreage FLOAT NULL COMMENT 'For acre-based rentals, supports decimals',
    pricePerUnit FLOAT NOT NULL,
    totalAmount FLOAT NOT NULL,
    customerId INT NOT NULL,
    operatorId INT NOT NULL,
    date DATETIME NOT NULL,
    dieselCost FLOAT DEFAULT 0,
    maintenanceCost FLOAT DEFAULT 0,
    operatorSalary FLOAT DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customerId) REFERENCES Customer(id),
    FOREIGN KEY (operatorId) REFERENCES User(id)
);

-- Create Expense table
CREATE TABLE IF NOT EXISTS Expense (
    id INT AUTO_INCREMENT PRIMARY KEY,
    description TEXT NOT NULL,
    amount FLOAT NOT NULL,
    date DATETIME NOT NULL,
    operatorId INT NOT NULL,
    dieselCost FLOAT DEFAULT 0,
    maintenanceCost FLOAT DEFAULT 0,
    operatorSalary FLOAT DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (operatorId) REFERENCES User(id)
);

-- Optional: Insert some sample data (uncomment if needed)
