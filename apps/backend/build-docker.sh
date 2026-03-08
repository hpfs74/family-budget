#!/bin/bash

# Docker build script for Lambda functions
set -e

echo "Building Lambda functions with Docker..."

# Build the Lambda bundle using Docker
docker build -f Dockerfile.build -t budget-app-lambda-builder .

# Create a container to extract the bundle
docker create --name temp-container budget-app-lambda-builder

# Create dist directory if it doesn't exist
mkdir -p dist-docker

# Copy the built bundle from the container
docker cp temp-container:/bundle/. dist-docker/

# Clean up the temporary container
docker rm temp-container

echo "Lambda functions built successfully in dist-docker/"
echo "Built files:"
ls -la dist-docker/