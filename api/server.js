const express = require('express');
const cors = require('cors');
const axios = require('axios');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3001;
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://ollama:11434';

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Available models configuration
const AVAILABLE_MODELS = {
  'llama3.2-vision:11b': {
    name: 'Llama 3.2 Vision 11B',
    supportsImages: true,
    description: 'Advanced vision and text understanding'
  }
};

// Query complexity analyzer
function analyzeQueryComplexity(messages) {
  const lastMessage = messages[messages.length - 1];
  const content = lastMessage.content || '';
  const hasImages = lastMessage.images && lastMessage.images.length > 0;
  
  let complexity = 'simple';
  let score = 0;
  
  // Length-based scoring
  if (content.length > 500) score += 2;
  if (content.length > 1000) score += 2;
  if (content.length > 2000) score += 3;
  
  // Content complexity indicators
  const complexityIndicators = [
    /explain.*detail/i, /analyze.*comprehensive/i, /write.*essay/i,
    /create.*story/i, /detailed.*analysis/i, /step.*by.*step/i,
    /comprehensive.*guide/i, /full.*explanation/i, /elaborate/i,
    /extensive/i, /thorough/i, /in.*depth/i, /complete.*breakdown/i,
    /long.*answer/i, /detailed.*response/i, /write.*article/i,
    /provide.*examples/i, /list.*all/i, /explain.*everything/i
  ];
  
  complexityIndicators.forEach(pattern => {
    if (pattern.test(content)) score += 3;
  });
  
  // Image analysis adds complexity
  if (hasImages) score += 2;
  
  // Multiple questions or requests
  const questionMarks = (content.match(/\?/g) || []).length;
  if (questionMarks > 1) score += 2;
  
  // Conversation context length
  if (messages.length > 5) score += 1;
  if (messages.length > 10) score += 2;
  
  if (score >= 8) complexity = 'very_complex';
  else if (score >= 5) complexity = 'complex';
  else if (score >= 2) complexity = 'moderate';
  
  return { complexity, score };
}

// Generate adaptive parameters based on complexity
function getAdaptiveParameters(complexity, hasImages = false) {
  const baseParams = {
    temperature: 0.7,
    top_k: 40,
    top_p: 0.9,
    num_ctx: 4096,
    num_thread: 10,
    low_vram: false,
    use_mlock: true,
    use_mmap: false,
    repeat_penalty: 1.1,
    repeat_last_n: 64
  };
  
  switch (complexity) {
    case 'very_complex':
      return {
        ...baseParams,
        num_predict: hasImages ? 3000 : 4000,
        num_ctx: 8192,
        temperature: 0.8,
        timeout: 600000 // 10 minutes
      };
    case 'complex':
      return {
        ...baseParams,
        num_predict: hasImages ? 2000 : 2500,
        num_ctx: 6144,
        timeout: 300000 // 5 minutes
      };
    case 'moderate':
      return {
        ...baseParams,
        num_predict: hasImages ? 1000 : 1200,
        timeout: 180000 // 3 minutes
      };
    default:
      return {
        ...baseParams,
        num_predict: 500,
        timeout: 120000 // 2 minutes
      };
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get available models
app.get('/api/models', async (req, res) => {
  try {
    // Workaround: Assume models are available since Ollama API has issues
    // Return all configured models as available
    const availableModels = Object.entries(AVAILABLE_MODELS)
      .map(([modelId, config]) => ({
        id: modelId,
        ...config
      }));

    res.json({
      success: true,
      models: availableModels,
      totalAvailable: availableModels.length,
      note: "Models assumed available due to Ollama API limitations"
    });
  } catch (error) {
    console.error('Error fetching models:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch available models',
      details: error.message
    });
  }
});

// Preload model endpoint
app.post('/api/models/preload', async (req, res) => {
  try {
    const { model } = req.body;

    if (!model || !AVAILABLE_MODELS[model]) {
      return res.status(400).json({
        success: false,
        error: 'Invalid model specified'
      });
    }

    console.log(`Preloading model: ${model}`);
    
    // Send a minimal request to warm up the model
    await axios.post(`${OLLAMA_URL}/api/generate`, {
      model,
      prompt: ".",
      stream: false,
      options: {
        num_predict: 1 // Minimal generation to warm up
      }
    }, { timeout: 60000 });

    res.json({
      success: true,
      message: `Model ${model} preloaded successfully`
    });

  } catch (error) {
    console.error('Model preload error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to preload model',
      details: error.message
    });
  }
});

// Unload all models endpoint
app.post('/api/models/unload', async (req, res) => {
  try {
    console.log('Unloading all models to free memory');
    
    // Get currently loaded models
    const response = await axios.get(`${OLLAMA_URL}/api/ps`);
    const loadedModels = response.data.models || [];
    
    if (loadedModels.length === 0) {
      return res.json({
        success: true,
        message: 'No models were loaded',
        unloadedCount: 0
      });
    }

    // Unload each model by making a request with keep_alive=0
    let unloadedCount = 0;
    for (const modelInfo of loadedModels) {
      try {
        await axios.post(`${OLLAMA_URL}/api/generate`, {
          model: modelInfo.name,
          prompt: "",
          stream: false,
          keep_alive: 0 // This will unload the model immediately
        });
        unloadedCount++;
        console.log(`Unloaded model: ${modelInfo.name}`);
      } catch (error) {
        console.warn(`Failed to unload model ${modelInfo.name}:`, error.message);
      }
    }

    res.json({
      success: true,
      message: `Successfully unloaded ${unloadedCount} model(s)`,
      unloadedCount
    });

  } catch (error) {
    console.error('Model unload error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to unload models',
      details: error.message
    });
  }
});

// Switch model endpoint - unloads others and preloads the selected one
app.post('/api/models/switch', async (req, res) => {
  try {
    const { model } = req.body;

    if (!model || !AVAILABLE_MODELS[model]) {
      return res.status(400).json({
        success: false,
        error: 'Invalid model specified'
      });
    }

    console.log(`Switching to model: ${model}`);
    
    // First unload all currently loaded models
    const unloadResponse = await axios.post(`${OLLAMA_URL}/api/ps`);
    const loadedModels = unloadResponse.data.models || [];
    
    let unloadedCount = 0;
    for (const modelInfo of loadedModels) {
      if (modelInfo.name !== model) { // Don't unload if it's already the target model
        try {
          await axios.post(`${OLLAMA_URL}/api/generate`, {
            model: modelInfo.name,
            prompt: "",
            stream: false,
            keep_alive: 0
          });
          unloadedCount++;
          console.log(`Unloaded model: ${modelInfo.name}`);
        } catch (error) {
          console.warn(`Failed to unload model ${modelInfo.name}:`, error.message);
        }
      }
    }

    // Then preload the new model
    await axios.post(`${OLLAMA_URL}/api/generate`, {
      model,
      prompt: ".",
      stream: false,
      options: {
        num_predict: 1
      }
    }, { timeout: 60000 });

    res.json({
      success: true,
      message: `Successfully switched to ${model}. Unloaded ${unloadedCount} other model(s).`,
      activeModel: model,
      unloadedCount
    });

  } catch (error) {
    console.error('Model switch error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to switch model',
      details: error.message
    });
  }
});

// Get currently loaded models
app.get('/api/models/loaded', async (req, res) => {
  try {
    const response = await axios.get(`${OLLAMA_URL}/api/ps`);
    const loadedModels = response.data.models || [];
    
    const modelsWithInfo = loadedModels.map(model => ({
      name: model.name,
      size: model.size,
      sizeVram: model.size_vram,
      digest: model.digest,
      details: model.details
    }));

    res.json({
      success: true,
      loadedModels: modelsWithInfo,
      count: modelsWithInfo.length
    });
  } catch (error) {
    console.error('Error fetching loaded models:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch loaded models',
      details: error.message
    });
  }
});

// Chat endpoint with model routing and adaptive parameters
app.post('/api/chat', async (req, res) => {
  try {
    const { model, messages, stream = false } = req.body;

    // Validate model
    if (!model || !AVAILABLE_MODELS[model]) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or unsupported model',
        availableModels: Object.keys(AVAILABLE_MODELS)
      });
    }

    const modelConfig = AVAILABLE_MODELS[model];

    // Validate image support
    const hasImages = messages.some(msg => msg.images && msg.images.length > 0);
    if (hasImages && !modelConfig.supportsImages) {
      return res.status(400).json({
        success: false,
        error: `Model ${model} does not support image processing. Please use llama3.2-vision:11b for image analysis.`,
        modelSupportsImages: false
      });
    }

    // Analyze query complexity and get adaptive parameters
    const { complexity, score } = analyzeQueryComplexity(messages);
    const adaptiveParams = getAdaptiveParameters(complexity, hasImages);
    
    console.log(`Query complexity: ${complexity} (score: ${score}), using ${adaptiveParams.num_predict} tokens, ${adaptiveParams.timeout/1000}s timeout`);

    // Check if we need to switch models (unload others first)
    try {
      const loadedResponse = await axios.get(`${OLLAMA_URL}/api/ps`);
      const loadedModels = loadedResponse.data.models || [];
      const isModelLoaded = loadedModels.some(m => m.name === model);
      const hasOtherModelsLoaded = loadedModels.some(m => m.name !== model);

      if (!isModelLoaded || hasOtherModelsLoaded) {
        console.log(`Switching to model ${model} for optimal memory usage`);
        
        // Unload other models first
        for (const loadedModel of loadedModels) {
          if (loadedModel.name !== model) {
            try {
              await axios.post(`${OLLAMA_URL}/api/generate`, {
                model: loadedModel.name,
                prompt: "",
                stream: false,
                keep_alive: 0
              });
              console.log(`Unloaded model: ${loadedModel.name}`);
            } catch (unloadError) {
              console.warn(`Failed to unload model ${loadedModel.name}:`, unloadError.message);
            }
          }
        }
      }
    } catch (error) {
      console.warn('Could not check/switch models:', error.message);
    }

    // Forward request to Ollama with adaptive parameters
    const { timeout, ...options } = adaptiveParams;
    const ollamaResponse = await axios.post(`${OLLAMA_URL}/api/chat`, {
      model,
      messages,
      stream,
      keep_alive: "60m",
      options
    }, {
      timeout,
      responseType: stream ? 'stream' : 'json'
    });

    if (stream) {
      // Handle streaming response with progress tracking
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Transfer-Encoding', 'chunked');
      res.setHeader('X-Query-Complexity', complexity);
      res.setHeader('X-Max-Tokens', adaptiveParams.num_predict.toString());
      ollamaResponse.data.pipe(res);
    } else {
      // Handle regular response
      res.json({
        success: true,
        message: ollamaResponse.data.message,
        model: model,
        modelName: modelConfig.name,
        complexity,
        maxTokens: adaptiveParams.num_predict
      });
    }

  } catch (error) {
    console.error('Chat error:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      res.status(503).json({
        success: false,
        error: 'Ollama service is not available. Please ensure it is running.',
        code: 'SERVICE_UNAVAILABLE'
      });
    } else if (error.response?.status === 404) {
      res.status(404).json({
        success: false,
        error: `Model ${req.body.model} is not available. It may need to be pulled first.`,
        code: 'MODEL_NOT_FOUND'
      });
    } else if (error.code === 'ECONNABORTED') {
      res.status(408).json({
        success: false,
        error: 'Request timeout. The model may be taking too long to respond.',
        code: 'REQUEST_TIMEOUT'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Internal server error while processing chat request',
        details: error.message,
        code: 'INTERNAL_ERROR'
      });
    }
  }
});

// Generate endpoint with adaptive parameters
app.post('/api/generate', async (req, res) => {
  try {
    const { model, prompt, images, stream = false } = req.body;

    if (!model || !AVAILABLE_MODELS[model]) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or unsupported model'
      });
    }

    const modelConfig = AVAILABLE_MODELS[model];

    // Validate image support
    if (images && images.length > 0 && !modelConfig.supportsImages) {
      return res.status(400).json({
        success: false,
        error: `Model ${model} does not support image processing.`
      });
    }

    // Convert prompt to messages format for complexity analysis
    const messages = [{ content: prompt, images: images || [] }];
    const { complexity, score } = analyzeQueryComplexity(messages);
    const adaptiveParams = getAdaptiveParameters(complexity, images && images.length > 0);
    
    console.log(`Generate complexity: ${complexity} (score: ${score}), using ${adaptiveParams.num_predict} tokens`);

    // Check if we need to switch models
    try {
      const loadedResponse = await axios.get(`${OLLAMA_URL}/api/ps`);
      const loadedModels = loadedResponse.data.models || [];
      const isModelLoaded = loadedModels.some(m => m.name === model);
      const hasOtherModelsLoaded = loadedModels.some(m => m.name !== model);

      if (!isModelLoaded || hasOtherModelsLoaded) {
        // Unload other models first
        for (const loadedModel of loadedModels) {
          if (loadedModel.name !== model) {
            try {
              await axios.post(`${OLLAMA_URL}/api/generate`, {
                model: loadedModel.name,
                prompt: "",
                stream: false,
                keep_alive: 0
              });
            } catch (unloadError) {
              console.warn(`Failed to unload model ${loadedModel.name}:`, unloadError.message);
            }
          }
        }
      }
    } catch (error) {
      console.warn('Could not check/switch models:', error.message);
    }

    const { timeout, ...options } = adaptiveParams;
    const requestData = { 
      model, 
      prompt, 
      stream,
      keep_alive: "60m",
      options
    };
    if (images && images.length > 0) {
      requestData.images = images;
    }

    const ollamaResponse = await axios.post(`${OLLAMA_URL}/api/generate`, requestData, {
      timeout,
      responseType: stream ? 'stream' : 'json'
    });

    if (stream) {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Transfer-Encoding', 'chunked');
      res.setHeader('X-Query-Complexity', complexity);
      res.setHeader('X-Max-Tokens', adaptiveParams.num_predict.toString());
      ollamaResponse.data.pipe(res);
    } else {
      res.json({
        success: true,
        response: ollamaResponse.data.response,
        model: model,
        modelName: modelConfig.name,
        complexity,
        maxTokens: adaptiveParams.num_predict
      });
    }

  } catch (error) {
    console.error('Generate error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to generate response',
      details: error.message
    });
  }
});

// Response resumption endpoint for interrupted long responses
app.post('/api/chat/resume', async (req, res) => {
  try {
    const { model, messages, partial_response, stream = false } = req.body;

    if (!model || !AVAILABLE_MODELS[model]) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or unsupported model'
      });
    }

    // Create a continuation prompt
    const lastMessage = messages[messages.length - 1];
    const continuationPrompt = `Please continue this response where it was interrupted:\n\n"${partial_response}"\n\nContinue from exactly where it left off without repeating any content:`;
    
    const continuationMessages = [
      ...messages.slice(0, -1),
      { role: lastMessage.role, content: continuationPrompt }
    ];

    // Use complex parameters for resumption since this is likely a long response
    const adaptiveParams = getAdaptiveParameters('complex', false);
    
    console.log(`Resuming interrupted response with ${adaptiveParams.num_predict} tokens`);

    const { timeout, ...options } = adaptiveParams;
    const ollamaResponse = await axios.post(`${OLLAMA_URL}/api/chat`, {
      model,
      messages: continuationMessages,
      stream,
      keep_alive: "60m",
      options
    }, {
      timeout,
      responseType: stream ? 'stream' : 'json'
    });

    if (stream) {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Transfer-Encoding', 'chunked');
      res.setHeader('X-Response-Mode', 'resumption');
      ollamaResponse.data.pipe(res);
    } else {
      res.json({
        success: true,
        message: ollamaResponse.data.message,
        mode: 'resumption',
        model: model
      });
    }

  } catch (error) {
    console.error('Resume error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to resume response',
      details: error.message
    });
  }
});

// Progressive streaming endpoint with chunked delivery
app.post('/api/chat/progressive', async (req, res) => {
  try {
    const { model, messages, chunk_size = 500 } = req.body;

    if (!model || !AVAILABLE_MODELS[model]) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or unsupported model'
      });
    }

    const { complexity } = analyzeQueryComplexity(messages);
    const adaptiveParams = getAdaptiveParameters(complexity, false);
    
    // Force streaming for progressive delivery
    const { timeout, ...options } = adaptiveParams;
    
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('X-Progressive-Mode', 'true');
    res.setHeader('X-Chunk-Size', chunk_size.toString());

    const ollamaResponse = await axios.post(`${OLLAMA_URL}/api/chat`, {
      model,
      messages,
      stream: true,
      keep_alive: "60m",
      options
    }, {
      timeout,
      responseType: 'stream'
    });

    let buffer = '';
    let chunkCount = 0;

    ollamaResponse.data.on('data', (chunk) => {
      try {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.trim()) {
            const data = JSON.parse(line);
            if (data.message && data.message.content) {
              buffer += data.message.content;
              
              // Send chunks when buffer reaches chunk_size
              while (buffer.length >= chunk_size) {
                const chunkToSend = buffer.substring(0, chunk_size);
                buffer = buffer.substring(chunk_size);
                res.write(`CHUNK_${chunkCount++}: ${chunkToSend}\n\n`);
              }
            }
            if (data.done) {
              // Send remaining buffer
              if (buffer.length > 0) {
                res.write(`CHUNK_${chunkCount++}: ${buffer}\n\n`);
              }
              res.write('DONE\n');
              res.end();
            }
          }
        }
      } catch (parseError) {
        console.warn('Parse error in progressive streaming:', parseError.message);
      }
    });

    ollamaResponse.data.on('error', (error) => {
      console.error('Stream error:', error);
      res.write(`ERROR: ${error.message}\n`);
      res.end();
    });

  } catch (error) {
    console.error('Progressive streaming error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to start progressive streaming',
      details: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    details: err.message
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Ollama API middleware running on port ${PORT}`);
  console.log(`📡 Connecting to Ollama at: ${OLLAMA_URL}`);
  console.log(`🤖 Available models: ${Object.keys(AVAILABLE_MODELS).join(', ')}`);
});