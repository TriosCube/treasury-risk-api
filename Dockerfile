FROM node:22-bookworm-slim

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the TypeScript code
RUN npm run build

# Expose the API port
EXPOSE 4000

# Start the application
CMD ["npm", "start"]