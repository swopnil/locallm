# Ollama Multi-Model Chat

A modern local LLM chat interface with multiple model support and vision capabilities using Ollama and React.

## ✨ Features

- **Multiple AI Models**: Switch between different Llama models based on your needs
- **Vision Capabilities**: Upload and analyze images with Llama 3.2 Vision 11B
- **Pure Text Models**: Fast conversations with Llama 3.1 8B and Llama 3.2 3B
- **Modern UI**: Beautiful, responsive interface with animations and glassmorphism effects
- **Smart Model Selection**: Automatic model validation and capability detection
- **Containerized Setup**: Full Docker orchestration with health checks
- **Automatic Model Management**: Models download automatically on first run
- **Persistent Storage**: Models cached between restarts
- **API Middleware**: Robust error handling and request routing

## 🚀 Available Models

| Model | Capabilities | Use Case |
|-------|-------------|----------|
| **Llama 3.2 Vision 11B** | Text + Vision | Image analysis, visual Q&A, multimodal tasks |
| **Llama 3.1 8B** | Text Only | Fast conversations, coding, general Q&A |
| **Llama 3.2 3B** | Text Only | Quick responses, lightweight tasks |

## 🎯 Quick Start

### Option 1: Docker Compose (Recommended)

1. **Start all services:**
   ```bash
   docker-compose up --build
   ```

2. **First time setup:** 
   - Multiple models will download automatically (~15-20 minutes total)
   - Llama 3.2 Vision 11B: ~7.8GB
   - Llama 3.1 8B: ~4.7GB  
   - Llama 3.2 3B: ~2.0GB
   
3. **Access the application:** http://localhost:3000

4. **Choose your model:** Click the settings icon to select between available models

**Note:** Models are stored in Docker volumes and persist between restarts. Only the first run downloads models.

### Option 2: Local Development

1. **Start Ollama service:**
   ```bash
   brew services start ollama
   ollama pull llama3.2-vision:11b
   ollama pull llama3.1:8b
   ollama pull llama3.2:3b
   ```

2. **Start the API middleware:**
   ```bash
   cd api
   npm install
   OLLAMA_URL=http://localhost:11434 npm start
   ```

3. **Start the React app:**
   ```bash
   cd ollama-vision-chat
   npm install
   npm start
   ```

4. **Open your browser:** http://localhost:3000

## 🎮 Usage

1. **Select Model**: Click the settings ⚙️ icon to choose your AI model
2. **Text Chat**: Type your message and press Enter or click Send
3. **Image Analysis**: Upload images using the 📎 button (Vision models only)
4. **Model Switching**: Change models based on your task needs

### Model Selection Tips:
- **Use Vision model** for image analysis, describing photos, reading text in images
- **Use 8B model** for coding, detailed explanations, complex reasoning
- **Use 3B model** for quick responses, simple questions, fast iteration

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Server    │    │   Ollama        │
│   (React)       │◄──►│   (Node.js)     │◄──►│   (LLM Engine)  │
│   Port: 3000    │    │   Port: 3001    │    │   Port: 11434   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
          │                       │                       │
          └───────────────────────┼───────────────────────┘
                                  │
                            ┌─────────────┐
                            │   Nginx     │
                            │   (Proxy)   │
                            └─────────────┘
```

**Components:**
- **Frontend**: React with TypeScript, Tailwind CSS, Framer Motion
- **API Middleware**: Express.js server for model management and routing  
- **Backend**: Ollama LLM engine with multiple models
- **Reverse Proxy**: Nginx for request routing and CORS handling
- **Containerization**: Docker Compose orchestration

## 💻 System Requirements

- **Docker & Docker Compose**
- **Memory**: 16GB+ RAM recommended (8GB minimum)
- **Storage**: 20GB+ free disk space for all models
- **CPU**: Multi-core processor recommended

## 🛠️ Development

### Frontend Development:
```bash
cd ollama-vision-chat
npm install
npm start
```

### API Development:
```bash
cd api  
npm install
npm run dev  # Uses nodemon for hot reload
```

### Full Rebuild:
```bash
docker-compose down
docker-compose up --build
```

### Reset Everything:
```bash
docker-compose down -v  # Removes all volumes and models
docker-compose up --build
```

### Restart Services (Preserve Models):
```bash
docker-compose restart
```

## 🐛 Troubleshooting

### Common Issues:

- **Models downloading slowly**: Normal for first run (15-20GB total)
- **Out of memory**: Increase Docker memory limit or disable some models
- **API connection errors**: Ensure all services are healthy (`docker-compose ps`)
- **Model not found**: Check Ollama logs (`docker-compose logs ollama`)

### Health Checks:

- **API Health**: http://localhost:3001/health
- **Available Models**: http://localhost:3001/api/models
- **Docker Status**: `docker-compose ps`

### Logs:
```bash
# All services
docker-compose logs

# Specific service
docker-compose logs ollama
docker-compose logs api
docker-compose logs frontend
```

## 🚦 Service Ports

- **Frontend**: http://localhost:3000
- **API**: http://localhost:3001  
- **Ollama**: http://localhost:11434

## 🔧 Configuration

### Environment Variables:
- `OLLAMA_KEEP_ALIVE=24h`: Keep models loaded
- `OLLAMA_NUM_PARALLEL=3`: Support multiple concurrent requests
- `OLLAMA_MAX_LOADED_MODELS=3`: Maximum models in memory

### Model Management:
Models are automatically pulled on startup. To manually add models:
```bash
docker exec -it ollama-service ollama pull <model-name>
```

## 📝 API Documentation

### Get Available Models
```bash
GET /api/models
```

### Chat with Model
```bash
POST /api/chat
{
  "model": "llama3.1:8b",
  "messages": [{"role": "user", "content": "Hello!"}]
}
```

### Generate Response
```bash
POST /api/generate  
{
  "model": "llama3.2:3b",
  "prompt": "Explain quantum computing"
}
```