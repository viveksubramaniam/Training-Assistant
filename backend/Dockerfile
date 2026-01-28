# Use Node.js 20 on Alpine Linux
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy the rest of the application
COPY . .

# Expose the port (Railway will set PORT env var, but good for documentation)
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
