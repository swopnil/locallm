#!/bin/bash

# Model warmup script for M4 Pro 24GB - aggressive optimization
echo "🔥 Warming up llama3.2-vision:11b model for M4 Pro..."

# Wait for Ollama to be ready
until curl -s http://localhost:11434/ > /dev/null; do
    echo "⏳ Waiting for Ollama to start..."
    sleep 2
done

echo "✅ Ollama is ready"

# Preload model with M4 Pro optimized settings
curl -s -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.2-vision:11b",
    "prompt": "Warmup",
    "stream": false,
    "keep_alive": "60m",
    "options": {
      "num_predict": 5,
      "num_ctx": 8192,
      "num_thread": 12,
      "num_gpu": -1,
      "low_vram": false,
      "f16_kv": false,
      "use_mlock": true,
      "use_mmap": false,
      "num_batch": 2048,
      "numa": false
    }
  }' > /dev/null

echo "🚀 Model warmed up with M4 Pro optimizations - ready for blazing fast responses!"