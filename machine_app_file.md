# 🚜 Rental Tracker - Complete Installation Guide

A professional Next.js application for tracking machinery rental income with MySQL database.

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Manual Installation](#manual-installation)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [Database Setup](#database-setup)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

-----

## ✨ Features

### For Operators

- ✅ Simple PIN-based login
- ✅ Large touch-friendly buttons (mobile-optimized)
- ✅ Visual machine selection (Tractor, Harvester, Excavator)
- ✅ Easy quantity adjustment with +/- buttons
- ✅ Flexible pricing with standard rates
- ✅ Instant entry confirmation
- ✅ Bilingual interface (Hindi + English)

### For Admin

- ✅ Complete revenue dashboard
- ✅ Date filtering (Today/Month/Custom)
- ✅ Machine-wise statistics
- ✅ Operator performance tracking
- ✅ Entry management (view/delete)
- ✅ Real-time data updates

### Technical Features

- ✅ INR currency formatting
- ✅ MySQL database with Prisma ORM
- ✅ RESTful API architecture
- ✅ TypeScript for type safety
- ✅ Responsive mobile-first design
- ✅ Server-side data persistence

-----

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: MySQL
- **ORM**: Prisma
- **Icons**: Lucide React
- **Runtime**: Node.js

-----

## 📦 Prerequisites

Before you begin, ensure you have:

1. **Node.js** (v18 or higher)
   
   ```bash
   node --version  # Should be v18+
   ```
1. **MySQL Server** (v8.0 or higher)
   
   ```bash
   mysql --version
   ```
1. **npm** or **yarn**
   
   ```bash
   npm --version
   ```
1. **Git** (optional, for version control)

-----

## 🚀 Quick Start

### Option 1: Automated Setup (Recommended)

```bash
# Download and run the setup script
curl -O [setup-script-url]
chmod +x setup.sh
./setup.sh

# Follow the prompts
```

### Option 2: Manual Setup (5 Minutes)

```bash
# 1. Create Next.js project
npx create-next-app@latest rental-tracker
# Choose: TypeScript ✓, Tailwind ✓, App Router ✓

cd rental-tracker

# 2. Install dependencies
npm install @prisma/client lucide-react
npm install -D prisma

# 3. Initialize Prisma
npx prisma init

# 4. Continue with manual installation below...
```

-----

## 📖 Manual Installation

### Step 1: Configure Database Connection

Edit `.env` file:

```env
DATABASE_URL="mysql://root:YOUR_PASSWORD@localhost:3306/rental_tracker"
```

**Replace:**

- `YOUR_PASSWORD` with your MySQL root password
- `localhost` if your MySQL is on a different host
- `3306` if using a different port

### Step 2: Create Database

```bash
# Option A: Via command line
mysql -u root -p -e "CREATE DATABASE rental_tracker;"

# Option B: Via MySQL Workbench or phpMyAdmin
# Run: CREATE DATABASE rental_tracker;
```

### Step 3: Copy Project Files

You need to create these files with the code from the artifacts:

#### 3.1 Prisma Schema

Create `prisma/schema.prisma` and copy the schema from artifact

#### 3.2 Prisma Client Helper

Create `lib/prisma.ts` and copy the code from artifact

#### 3.3 API Routes

Create these files and copy code from artifacts:

- `app/api/auth/login/route.ts`
- `app/api/rentals/route.ts`
- `app/api/rentals/[id]/route.ts`
- `app/api/rentals/stats/route.ts`
- `app/api/test-db/route.ts`

#### 3.4 Main Application Files

- `app/page.tsx` - Main React component
- `app/layout.tsx` - Root layout
- `app/globals.css` - Global styles

#### 3.5 Configuration Files

- `next.config.js`
- `tsconfig.json`
- `tailwind.config.js`
- `postcss.config.js`

### Step 4: Generate Prisma Client

```bash
npx prisma generate
```

### Step 5: Create Database Tables

```bash
npx prisma db push
```

This creates the `users` and `rentals` tables in your MySQL database.

### Step 6: Insert Test Users

**Option A: Via SQL Script**

```sql
USE rental_tracker;

INSERT INTO users (name, role, pin, created_at, updated_at) VALUES 
('Admin User', 'admin', '1234', NOW(), NOW()),
('Ramesh Kumar', 'operator', '5678', NOW(), NOW()),
('Suresh Patel', 'operator', '9999', NOW(), NOW());
```

**Option B: Via Prisma Studio**

```bash
npx prisma studio
# Opens in browser at http://localhost:5555
# Manually add users through the GUI
```

### Step 7: Start Development Server

```bash
npm run dev
```

Open <http://localhost:3000>

### Step 8: Test the Application

**Login Credentials:**

- **Admin**: PIN `1234`
- **Operator 1**: PIN `5678`
- **Operator 2**: PIN `9999`

-----

## 📁 Project Structure

```
rental-tracker/
├── app/
│   ├── api/                    # API Routes
│   │   ├── auth/
│   │   │   └── login/
│   │   │       └── route.ts   # Login endpoint
│   │   ├── rentals/
│   │   │   ├── route.ts       # GET/POST rentals
│   │   │   ├── stats/
│   │   │   │   └── route.ts   # Statistics
│   │   │   └── [id]/
│   │   │       └── route.ts   # DELETE rental
│   │   └── test-db/
│   │       └── route.ts       # DB connection test
│   ├── layout.tsx             # Root layout
│   ├── page.tsx               # Main app component
│   └── globals.css            # Global styles
├── lib/
│   └── prisma.ts              # Prisma client
├── prisma/
│   └── schema.prisma          # Database schema
├── .env                       # Environment variables
├── .gitignore                 # Git ignore file
├── package.json               # Dependencies
├── tsconfig.json              # TypeScript config
├── tailwind.config.js         # Tailwind config
├── postcss.config.js          # PostCSS config
└── next.config.js             # Next.js config
```

-----

## ⚙️ Configuration

### Environment Variables (.env)

```env
# Database Connection
DATABASE_URL="mysql://username:password@host:port/database"

# Example for local MySQL
DATABASE_URL="mysql://root:mypassword@localhost:3306/rental_tracker"

# Example for remote MySQL
DATABASE_URL="mysql://user:pass@192.168.1.100:3306/rental_tracker"

# Example for cloud database (PlanetScale)
DATABASE_URL="mysql://user:pass@aws.connect.psdb.cloud/rental_tracker?sslaccept=strict"
```

### Standard Pricing (Edit in app/page.tsx)

```typescript
const STANDARD_PRICES = {
  tractor: { hourly: 500, trip: 2000, acre: 300 },
  harvester: { hourly: 800, trip: 3500, acre: 450 },
  excavator: { hourly: 700, trip: 3000, acre: 400 }
};
```

-----

## 🗄️ Database Setup

### Tables Created

**users**

|Column    |Type     |Description          |
|----------|---------|---------------------|
|id        |INT      |Primary key          |
|name      |VARCHAR  |User name            |
|role      |VARCHAR  |‘admin’ or ‘operator’|
|pin       |VARCHAR  |4-digit PIN (unique) |
|created_at|TIMESTAMP|Creation time        |
|updated_at|TIMESTAMP|Last update          |

**rentals**

|Column        |Type     |Description                        |
|--------------|---------|-----------------------------------|
|id            |INT      |Primary key                        |
|machine_type  |VARCHAR  |‘tractor’, ‘harvester’, ‘excavator’|
|unit_type     |VARCHAR  |‘hourly’, ‘trip’, ‘acre’           |
|quantity      |FLOAT    |Quantity rented                    |
|price_per_unit|FLOAT    |Rate per unit                      |
|total_amount  |FLOAT    |Total cost                         |
|operator_id   |INT      |Foreign key to users               |
|date          |TIMESTAMP|Entry date                         |
|created_at    |TIMESTAMP|Creation time                      |
|updated_at    |TIMESTAMP|Last update                        |

### Viewing Database

**Option 1: Prisma Studio** (Recommended)

```bash
npx prisma studio
```

Opens a GUI at http://localhost:5555

**Option 2: MySQL Command Line**

```bash
mysql -u root -p
USE rental_tracker;
SELECT * FROM users;
SELECT * FROM rentals;
```

**Option 3: MySQL Workbench / phpMyAdmin**
Connect to your MySQL server and browse tables visually.

-----

## 🧪 Testing

### Test Database Connection

Visit: http://localhost:3000/api/test-db

**Expected Response:**

```json
{
  "success": true,
  "message": "Database connection successful!",
  "userCount": 3,
  "users": [
    {
      "id": 1,
      "name": "Admin User",
      "role": "admin",
      "pin": "1234"
    },
    ...
  ]
}
```

### Test Login API

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"pin":"1234"}'
```

**Expected Response:**

```json
{
  "id": 1,
  "name": "Admin User",
  "role": "admin"
}
```

### Test Rental Creation

```bash
curl -X POST http://localhost:3000/api/rentals \
  -H "Content-Type: application/json" \
  -d '{
    "machineType": "tractor",
    "unitType": "hourly",
    "quantity": 5,
    "pricePerUnit": 500,
    "totalAmount": 2500,
    "operatorId": 2,
    "date": "2024-01-01T10:00:00Z"
  }'
```

-----

## 🐛 Troubleshooting

### Issue 1: “Can’t reach database server”

**Causes:**

- MySQL server not running
- Wrong credentials in .env
- Firewall blocking connection

**Solutions:**

```bash
# Check if MySQL is running
sudo systemctl status mysql  # Linux
brew services list           # macOS

# Start MySQL if stopped
sudo systemctl start mysql   # Linux
brew services start mysql    # macOS

# Test connection
mysql -u root -p -e "SELECT 1;"
```

### Issue 2: “Invalid PIN” on Login

**Solutions:**

```sql
-- Check if users exist
USE rental_tracker;
SELECT * FROM users;

-- If empty, insert users
INSERT INTO users (name, role, pin, created_at, updated_at) VALUES 
('Admin User', 'admin', '1234', NOW(), NOW()),
('Operator One', 'operator', '5678', NOW(), NOW());

-- Verify PIN format (should be string, not int)
SELECT pin, LENGTH(pin) FROM users;
```

### Issue 3: “Cannot find module ‘@prisma/client’”

**Solution:**

```bash
# Regenerate Prisma Client
npx prisma generate

# If still failing, reinstall
npm uninstall @prisma/client
npm install @prisma/client
npx prisma generate
```

### Issue 4: “Table ‘rental_tracker.users’ doesn’t exist”

**Solution:**

```bash
# Push schema to database
npx prisma db push

# If that fails, manually create database
mysql -u root -p -e "CREATE DATABASE rental_tracker;"
npx prisma db push
```

### Issue 5: Port 3000 Already in Use

**Solution:**

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill

# Or use different port
PORT=3001 npm run dev
```

### Issue 6: Build Errors

**Solution:**

```bash
# Clear Next.js cache
rm -rf .next

# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run dev
```

-----

## 📱 Mobile Testing

### Testing on Physical Device

1. **Find your local IP:**
   
   ```bash
   # macOS/Linux
   ifconfig | grep "inet "
   
   # Windows
   ipconfig
   ```
1. **Start dev server on network:**
   
   ```bash
   npm run dev -- -H 0.0.0.0
   ```
1. **Access from mobile:**
   
   ```
   http://YOUR_LOCAL_IP:3000
   ```

-----

## 🚀 Production Deployment

### Option 1: Vercel + PlanetScale (Recommended)

1. **Push to GitHub**
1. **Deploy to Vercel**: https://vercel.com/new
1. **Setup PlanetScale**: https://planetscale.com
1. **Add DATABASE_URL** to Vercel environment variables

### Option 2: Self-Hosted

```bash
# Build for production
npm run build

# Start production server
npm start

# Or use PM2 for process management
npm install -g pm2
pm2 start npm --name rental-tracker -- start
```

-----

## 📞 Support

### Getting Help

1. Check this README thoroughly
1. Visit the troubleshooting section
1. Check browser console (F12) for errors
1. Check terminal for server errors
1. Test database connection at `/api/test-db`

### Common Commands Reference

```bash
# Development
npm run dev              # Start dev server
npx prisma studio        # Open database GUI

# Database
npx prisma generate      # Generate Prisma Client
npx prisma db push       # Update database schema
npx prisma db pull       # Pull schema from database

# Production
npm run build            # Build for production
npm start                # Start production server

# Maintenance
npm install              # Install dependencies
npm update               # Update dependencies
```

-----

## 📄 License

This project is private and proprietary.

-----

## 🎯 Quick Reference

### Default Login Credentials

- Admin: `1234`
- Operator: `5678` or `9999`

### API Endpoints

- POST `/api/auth/login` - User login
- GET `/api/rentals` - Fetch rentals
- POST `/api/rentals` - Create rental
- DELETE `/api/rentals/[id]` - Delete rental
- GET `/api/rentals/stats` - Get statistics
- GET `/api/test-db` - Test database

### Default Port

- Development: `http://localhost:3000`
- Prisma Studio: `http://localhost:5555`

-----

**Made with ❤️ for machinery rental businesses in India**



@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@


new file --> 

#!/bin/bash

# Rental Tracker - Quick Setup Script

# Run this script to set up the entire project

echo “🚀 Starting Rental Tracker Setup…”
echo “”

# Step 1: Check if Node.js is installed

echo “📦 Checking Node.js…”
if ! command -v node &> /dev/null; then
echo “❌ Node.js is not installed. Please install Node.js first.”
exit 1
fi
echo “✅ Node.js version: $(node -v)”
echo “”

# Step 2: Check if MySQL is installed

echo “🗄️  Checking MySQL…”
if ! command -v mysql &> /dev/null; then
echo “⚠️  MySQL command not found. Make sure MySQL is installed and running.”
echo “   You can still continue if MySQL is running.”
fi
echo “”

# Step 3: Create project directory

echo “📁 Creating project structure…”
mkdir -p rental-tracker
cd rental-tracker

# Step 4: Initialize package.json

echo “📝 Creating package.json…”
cat > package.json << ‘EOF’
{
“name”: “rental-tracker”,
“version”: “0.1.0”,
“private”: true,
“scripts”: {
“dev”: “next dev”,
“build”: “next build”,
“start”: “next start”,
“lint”: “next lint”
},
“dependencies”: {
“@prisma/client”: “^5.22.0”,
“lucide-react”: “^0.263.1”,
“next”: “14.0.4”,
“react”: “^18”,
“react-dom”: “^18”
},
“devDependencies”: {
“@types/node”: “^20”,
“@types/react”: “^18”,
“@types/react-dom”: “^18”,
“autoprefixer”: “^10.0.1”,
“eslint”: “^8”,
“eslint-config-next”: “14.0.4”,
“postcss”: “^8”,
“prisma”: “^5.22.0”,
“tailwindcss”: “^3.3.0”,
“typescript”: “^5”
}
}
EOF

# Step 5: Install dependencies

echo “📦 Installing dependencies (this may take a few minutes)…”
npm install
echo “”

# Step 6: Initialize Prisma

echo “🔧 Initializing Prisma…”
npx prisma init
echo “”

# Step 7: Create directory structure

echo “📁 Creating directory structure…”
mkdir -p app/api/auth/login
mkdir -p app/api/rentals/stats
mkdir -p app/api/rentals/[id]
mkdir -p app/api/test-db
mkdir -p lib
mkdir -p prisma
echo “”

# Step 8: Create .env file

echo “🔐 Creating .env file…”
echo “Please enter your MySQL password (or press Enter to skip):”
read -s MYSQL_PASSWORD

if [ -z “$MYSQL_PASSWORD” ]; then
MYSQL_PASSWORD=“your_password”
fi

cat > .env << EOF
DATABASE_URL=“mysql://root:${MYSQL_PASSWORD}@localhost:3306/rental_tracker”
EOF
echo “✅ .env file created”
echo “”

# Step 9: Create Next.js config files

echo “⚙️  Creating configuration files…”

cat > next.config.js << ‘EOF’
/** @type {import(‘next’).NextConfig} */
const nextConfig = {}

module.exports = nextConfig
EOF

cat > tsconfig.json << ‘EOF’
{
“compilerOptions”: {
“target”: “es5”,
“lib”: [“dom”, “dom.iterable”, “esnext”],
“allowJs”: true,
“skipLibCheck”: true,
“strict”: true,
“noEmit”: true,
“esModuleInterop”: true,
“module”: “esnext”,
“moduleResolution”: “bundler”,
“resolveJsonModule”: true,
“isolatedModules”: true,
“jsx”: “preserve”,
“incremental”: true,
“plugins”: [{“name”: “next”}],
“paths”: {”@/*”: [”./*”]}
},
“include”: [“next-env.d.ts”, “**/*.ts”, “**/*.tsx”, “.next/types/**/*.ts”],
“exclude”: [“node_modules”]
}
EOF

cat > tailwind.config.js << ‘EOF’
/** @type {import(‘tailwindcss’).Config} */
module.exports = {
content: [
’./pages/**/*.{js,ts,jsx,tsx,mdx}’,
‘./components/**/*.{js,ts,jsx,tsx,mdx}’,
’./app/**/*.{js,ts,jsx,tsx,mdx}’,
],
theme: {
extend: {},
},
plugins: [],
}
EOF

cat > postcss.config.js << ‘EOF’
module.exports = {
plugins: {
tailwindcss: {},
autoprefixer: {},
},
}
EOF

echo “✅ Configuration files created”
echo “”

# Step 10: Create .gitignore

echo “📝 Creating .gitignore…”
cat > .gitignore << ‘EOF’

# dependencies

/node_modules
/.pnp
.pnp.js

# testing

/coverage

# next.js

/.next/
/out/

# production

/build

# misc

.DS_Store
*.pem

# debug

npm-debug.log*
yarn-debug.log*
yarn-error.log*

# local env files

.env*.local
.env

# vercel

.vercel

# typescript

*.tsbuildinfo
next-env.d.ts

# prisma

prisma/migrations
EOF
echo “”

# Step 11: Display next steps

echo “✅ Setup Complete!”
echo “”
echo “📋 Next Steps:”
echo “”
echo “1️⃣  Copy all the code files from the artifacts to their respective locations:”
echo “   - Copy Prisma schema to: prisma/schema.prisma”
echo “   - Copy lib/prisma.ts”
echo “   - Copy all API route files to app/api/”
echo “   - Copy app/page.tsx (main component)”
echo “   - Copy app/layout.tsx”
echo “”
echo “2️⃣  Create the MySQL database:”
echo “   mysql -u root -p -e "CREATE DATABASE rental_tracker;"”
echo “”
echo “3️⃣  Generate Prisma Client and push schema:”
echo “   npx prisma generate”
echo “   npx prisma db push”
echo “”
echo “4️⃣  Insert test users:”
echo “   mysql -u root -p rental_tracker < setup_users.sql”
echo “”
echo “5️⃣  Start the development server:”
echo “   npm run dev”
echo “”
echo “🎯 Test Login Credentials:”
echo “   Admin: PIN 1234”
echo “   Operator: PIN 5678 or 9999”
echo “”
echo “📖 For complete setup instructions, see the full documentation artifact”
echo “”

# Create SQL file for inserting users

cat > setup_users.sql << ‘EOF’
USE rental_tracker;

INSERT INTO users (name, role, pin, created_at, updated_at) VALUES
(‘Admin User’, ‘admin’, ‘1234’, NOW(), NOW()),
(‘Ramesh Kumar’, ‘operator’, ‘5678’, NOW(), NOW()),
(‘Suresh Patel’, ‘operator’, ‘9999’, NOW(), NOW());

SELECT * FROM users;
EOF

echo “✅ Created setup_users.sql for easy user setup”
echo “”
echo “🚀 Happy coding!”