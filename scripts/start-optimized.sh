#!/bin/bash

# Optimized startup script for M4 Pro 24GB
echo "🚀 Starting optimized Ollama for M4 Pro..."

# Kill any existing Ollama processes
pkill -f ollama 2>/dev/null || true
sleep 2

# Start Ollama with maximum M4 Pro optimizations
export OLLAMA_MAX_LOADED_MODELS=1
export OLLAMA_KEEP_ALIVE=60m
export OLLAMA_NUM_PARALLEL=12
export OLLAMA_FLASH_ATTENTION=true
export OLLAMA_LLM_LIBRARY=metal
export OLLAMA_CONTEXT_LENGTH=8192
export OLLAMA_GPU_OVERHEAD=0

# Start in background
ollama serve &
OLLAMA_PID=$!

echo "⏳ Waiting for Ollama to be ready..."
sleep 5

# Warm up the model
/Users/swopnil/local_llm/scripts/warmup-model.sh

echo "✅ Ollama optimized for M4 Pro and ready!"
echo "📊 Model will stay loaded for 60 minutes"
echo "🎯 Expected response time: 10-15 seconds"