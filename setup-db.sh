#!/bin/bash

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check for required dependencies
DEPENDENCIES=("node" "npm" "prisma")
for dep in "${DEPENDENCIES[@]}"; do
    if ! command_exists "$dep"; then
        echo -e "${RED}Error: $dep is not installed.${NC}"
        echo "Please install the following dependencies:"
        echo "- Node.js (https://nodejs.org/)"
        echo "- npm (comes with Node.js)"
        echo "- Prisma CLI: npm install -g prisma"
        exit 1
    fi
done

# Check for .env file
if [ ! -f .env ]; then
    echo -e "${YELLOW}Warning: .env file not found. Please create one with DATABASE_URL.${NC}"
    echo "Example .env content:"
    echo "DATABASE_URL=\"sqlserver://localhost:1433;database=InsuranceDB;user=YourUsername;password=YourPassword;encrypt=true;trustServerCertificate=true\""
    exit 1
fi

# Function to handle errors
handle_error() {
    echo -e "${RED}Error: $1${NC}"
    exit 1
}

# Step 1: Install dependencies
echo -e "${YELLOW}Installing project dependencies...${NC}"
npm install || handle_error "Failed to install dependencies"

# Step 2: Generate Prisma Client
echo -e "${YELLOW}Generating Prisma Client...${NC}"
npx prisma generate || handle_error "Failed to generate Prisma Client"

# Step 3: Run database migrations
echo -e "${YELLOW}Running database migrations...${NC}"
npx prisma migrate dev --name init || handle_error "Database migration failed"

# Step 4: Optional Seeding (uncomment and customize as needed)
echo -e "${YELLOW}Seeding initial data...${NC}"
# Uncomment and modify the seed script if you create one
# npx prisma db seed || handle_error "Database seeding failed"

# Step 5: Validate database setup
echo -e "${YELLOW}Validating database setup...${NC}"
npx prisma studio --browser none &
STUDIO_PID=$!

# Give Prisma Studio a moment to start
sleep 3

if kill -0 $STUDIO_PID 2>/dev/null; then
    kill $STUDIO_PID
    echo -e "${GREEN}✔ Database setup completed successfully!${NC}"
else
    echo -e "${RED}✘ Database setup might have issues. Please check your configuration.${NC}"
    exit 1
fi

# Optional: Create a basic seed script template
create_seed_script() {
    mkdir -p prisma
    cat > prisma/seed.ts << EOL
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    // Example seed data
    const policy = await prisma.policy.create({
        data: {
            whatsappNumber: '+1234567890',
            isCompleted: false,
            policyPeriod: '15 days',
        }
    })

    console.log('Seeded initial policy:', policy)
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
EOL

    echo -e "${GREEN}Seed script template created at prisma/seed.ts${NC}"
}

# Uncomment the following line if you want to create a seed script template
# create_seed_script

echo -e "${GREEN}Database setup process completed.${NC}"