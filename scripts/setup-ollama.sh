#!/bin/bash

# Setup Ollama and pull default model
echo "Setting up Ollama..."

# Check if ollama is running in docker
if docker ps | grep -q ollama; then
    echo "Ollama container found. Pulling llama3..."
    docker exec -it ollama ollama pull llama3
else
    echo "Ollama container not found. Starting with docker-compose..."
    docker-compose up -d ollama
    sleep 5
    docker exec -it ollama ollama pull llama3
fi

echo "Ollama is ready!"
