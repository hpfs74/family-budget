# Use the official AWS Lambda Node.js runtime as base
FROM public.ecr.aws/lambda/nodejs:18

# Set working directory
WORKDIR ${LAMBDA_TASK_ROOT}

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./

# The CMD is already set in the base image to run Lambda
CMD ["index.handler"]