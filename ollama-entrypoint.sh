#!/bin/bash

# Set GPU acceleration for Apple Silicon M4 Pro
export OLLAMA_HOST=0.0.0.0
export OLLAMA_MODELS=/root/.ollama/models
export OLLAMA_ORIGINS=*

# Enable Metal Performance Shaders for M4 Pro
export GGML_METAL_ENABLE_DEBUG=0
export PYTORCH_ENABLE_MPS_FALLBACK=1

# Optimize for M4 Pro (12-core GPU, 24GB RAM)
export OLLAMA_NUM_GPU=${OLLAMA_NUM_GPU:-12}
export OLLAMA_CPU_THREADS=${OLLAMA_CPU_THREADS:-12}
export OLLAMA_GPU_MEMORY_FRACTION=${OLLAMA_GPU_MEMORY_FRACTION:-0.8}

# Performance optimizations
export OLLAMA_MAX_VRAM=19200  # 80% of 24GB in MB
export OLLAMA_LOAD_TIMEOUT=300

echo "🚀 Starting Ollama with M4 Pro optimizations..."
echo "   GPU Cores: ${OLLAMA_NUM_GPU}"
echo "   CPU Threads: ${OLLAMA_CPU_THREADS}"
echo "   GPU Memory: ${OLLAMA_GPU_MEMORY_FRACTION} fraction"
echo "   Max VRAM: ${OLLAMA_MAX_VRAM}MB"

# Start Ollama server in the background
ollama serve &

# Wait for Ollama to be ready
echo "Waiting for Ollama server to start..."
until nc -z localhost 11434; do
  sleep 2
done

echo "Ollama server is ready!"

# Define models to pull
declare -a models=(
  "llama3.2-vision:11b"
  "llama3.1:8b"
  "llama3.2:3b"
)

# Function to pull model if it doesn't exist
pull_model_if_missing() {
  local model=$1
  echo "Checking for $model model..."
  sleep 1  # Give server time to process
  
  if ! ollama list | grep -q "$model"; then
    echo "Model $model not found. Pulling..."
    if ollama pull "$model"; then
      echo "✅ Model $model pulled successfully!"
    else
      echo "❌ Failed to pull model $model. It may not be available."
    fi
  else
    echo "✅ Model $model already exists! Skipping download."
  fi
}

# Pull all models
echo "🚀 Setting up AI models..."
sleep 2  # Give server time to initialize

for model in "${models[@]}"; do
  pull_model_if_missing "$model"
done

echo "🎉 Model setup complete! Available models:"
ollama list

# Keep the container running
wait