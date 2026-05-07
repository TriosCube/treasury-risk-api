FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the API port
EXPOSE 4000

# Start the application
CMD ["npx", "ts-node", "src/index.ts"]