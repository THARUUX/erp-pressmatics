# Use official lightweight Node.js image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy service code
COPY server.js ./

# Expose port
EXPOSE 5001

# Run start script
CMD ["npm", "start"]
