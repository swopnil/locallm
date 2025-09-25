import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  ImagePlus, 
  X, 
  Bot, 
  User, 
  Sparkles,
  Zap,
  Eye,
  MessageCircle,
  ChevronDown
} from 'lucide-react';
import { Listbox, Transition } from '@headlessui/react';
import clsx from 'clsx';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  image?: string;
  model?: string;
}

interface ModelOption {
  id: string;
  name: string;
  description: string;
  supportsImages?: boolean;
  icon: React.ComponentType<any>;
  color: string;
}

// Helper function to get model icon based on capabilities
const getModelIcon = (modelName: string) => {
  if (modelName.toLowerCase().includes('vision')) return Eye;
  if (modelName.toLowerCase().includes('3.1')) return Zap;
  if (modelName.toLowerCase().includes('3b')) return MessageCircle;
  return Bot;
};

// Helper function to get model color based on type
const getModelColor = (modelName: string) => {
  if (modelName.toLowerCase().includes('vision')) return 'from-blue-600 to-blue-700';
  if (modelName.toLowerCase().includes('3.1')) return 'from-slate-600 to-slate-700';
  if (modelName.toLowerCase().includes('3b')) return 'from-gray-600 to-gray-700';
  return 'from-gray-500 to-slate-500';
};

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelOption | null>(null);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [isPreloadingModel, setIsPreloadingModel] = useState(false);
  const [isSwitchingModel, setIsSwitchingModel] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [loadedModels, setLoadedModels] = useState<string[]>([]);
  const [lastActiveModel, setLastActiveModel] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    loadAvailableModels();
    
    // Check loaded models periodically
    const loadedModelsInterval = setInterval(checkLoadedModels, 10000); // Every 10 seconds
    
    // Set up polling for models if none are available
    const pollInterval = setInterval(() => {
      if (models.length === 0 && !isLoadingModels) {
        loadAvailableModels();
      }
    }, 30000); // Check every 30 seconds

    return () => {
      clearInterval(pollInterval);
      clearInterval(loadedModelsInterval);
    };
  }, [models.length, isLoadingModels]);

  const loadAvailableModels = async () => {
    try {
      setIsLoadingModels(true);
      setApiError(null);

      const response = await axios.get(
        process.env.NODE_ENV === 'development' 
          ? 'http://localhost:3001/api/models' 
          : '/api/models'
      );

      if (response.data.success) {
        const availableModels: ModelOption[] = response.data.models.map((model: any) => ({
          id: model.id,
          name: model.name,
          description: model.description,
          supportsImages: model.supportsImages,
          icon: getModelIcon(model.name),
          color: getModelColor(model.name)
        }));

        setModels(availableModels);
        
        // Set default model (prefer vision model, fallback to first available)
        const defaultModel = availableModels.find(m => m.supportsImages) || availableModels[0];
        if (defaultModel && !selectedModel) {
          setSelectedModel(defaultModel);
          // Model will auto-load when first used for faster startup
        }
      } else {
        throw new Error(response.data.error || 'Failed to load models');
      }
    } catch (error: any) {
      console.error('Error loading models:', error);
      setApiError(error.response?.data?.error || error.message || 'Failed to load models');
      
      // Fallback to default models if API fails
      const fallbackModels: ModelOption[] = [
        {
          id: 'llama3.2-vision:11b',
          name: 'Llama 3.2 Vision 11B',
          description: 'Advanced vision and text understanding',
          supportsImages: true,
          icon: Eye,
          color: 'from-blue-600 to-blue-700'
        }
      ];
      setModels(fallbackModels);
      setSelectedModel(fallbackModels[0]);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const checkLoadedModels = async () => {
    try {
      const response = await axios.get(
        process.env.NODE_ENV === 'development' 
          ? 'http://localhost:3001/api/models/loaded' 
          : '/api/models/loaded'
      );

      if (response.data.success) {
        const loadedModelNames = response.data.loadedModels.map((m: any) => m.name);
        setLoadedModels(loadedModelNames);
      }
    } catch (error) {
      // Silently fail - this is not critical
      console.warn('Failed to check loaded models:', error);
    }
  };

  const handleModelChange = async (model: ModelOption | null) => {
    if (!model || model.id === selectedModel?.id) return;
    
    setIsSwitchingModel(true);
    setApiError(null);
    
    try {
      // Call the optimized switch endpoint that handles unloading other models
      const response = await axios.post(
        process.env.NODE_ENV === 'development' 
          ? 'http://localhost:3001/api/models/switch' 
          : '/api/models/switch',
        { model: model.id },
        { timeout: 60000 }
      );

      if (response.data.success) {
        setSelectedModel(model);
        setLastActiveModel(model.id);
        console.log(`Switched to model: ${model.name}`);
        console.log(`Unloaded ${response.data.unloadedCount} other model(s)`);
        
        // Update loaded models state
        setLoadedModels([model.id]);
      } else {
        throw new Error(response.data.error || 'Failed to switch model');
      }
    } catch (error: any) {
      console.error('Error switching model:', error);
      setApiError(`Failed to switch to ${model.name}: ${error.response?.data?.error || error.message}`);
      
      // Keep the old model selected if switch failed
      console.warn(`Model switch failed, keeping ${selectedModel?.name || 'current'} model`);
    } finally {
      setIsSwitchingModel(false);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() && !selectedImage) return;
    if (!selectedModel) {
      setApiError('No model selected. Please select a model first.');
      return;
    }

    const userMessage: Message = {
      role: 'user',
      content: inputText,
      image: imagePreview || undefined,
      model: selectedModel.name,
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setApiError(null);

    try {
      const requestData: any = {
        model: selectedModel.id,
        messages: [{ 
          role: 'user', 
          content: inputText
        }],
        stream: false,
      };

      // Add image data if present and model supports it
      if (selectedImage && selectedModel.supportsImages) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const base64String = e.target?.result as string;
          const base64Data = base64String.split(',')[1];
          
          requestData.messages[0].images = [base64Data];
          await makeApiRequest(requestData);
        };
        reader.readAsDataURL(selectedImage);
        return; // Exit early as the reader will handle the request
      } else if (selectedImage && !selectedModel.supportsImages) {
        const errorMessage: Message = {
          role: 'assistant',
          content: `The ${selectedModel.name} model does not support image processing. Please select a vision-capable model or remove the image.`,
          model: selectedModel.name,
        };
        setMessages(prev => [...prev, errorMessage]);
        setIsLoading(false);
        return;
      }

      // Handle text-only request
      await makeApiRequest(requestData);

    } catch (error: any) {
      console.error('Error sending message:', error);
      handleApiError(error);
    }

    setInputText('');
    removeImage();
  };

  const makeApiRequest = async (requestData: any) => {
    try {
      const response = await axios.post(
        process.env.NODE_ENV === 'development' 
          ? 'http://localhost:3001/api/chat' 
          : '/api/chat', 
        requestData,
        {
          timeout: 120000, // 2 minute timeout
        }
      );
      
      if (response.data.success) {
        const assistantMessage: Message = {
          role: 'assistant',
          content: response.data.message.content,
          model: selectedModel?.name || 'Unknown',
        };

        setMessages(prev => [...prev, assistantMessage]);
      } else {
        throw new Error(response.data.error || 'Request failed');
      }
    } catch (error: any) {
      throw error; // Re-throw to be handled by sendMessage
    } finally {
      setIsLoading(false);
    }
  };

  const handleApiError = (error: any) => {
    let errorMessage = 'Sorry, there was an error processing your request.';
    
    if (error.response?.data?.error) {
      errorMessage = error.response.data.error;
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Cannot connect to the AI service. Please ensure the backend is running.';
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = 'Request timeout. The model may be taking too long to respond.';
    } else if (error.message) {
      errorMessage = error.message;
    }

    const errorMsg: Message = {
      role: 'assistant',
      content: errorMessage,
      model: selectedModel?.name || 'System',
    };
    
    setMessages(prev => [...prev, errorMsg]);
    setApiError(errorMessage);
    setIsLoading(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-4xl h-[90vh] bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-r from-slate-800 to-slate-900 p-6 text-white relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="p-2 bg-white/20 rounded-xl"
              >
                <Sparkles className="w-6 h-6" />
              </motion.div>
              <div>
                <h1 className="text-2xl font-bold">Swopnil AI Chat</h1>
                {isLoadingModels ? (
                  <p className="text-white/80 text-sm">Setting up AI models...</p>
                ) : models.length > 0 ? (
                  <p className="text-white/80 text-sm">{models.length} model{models.length !== 1 ? 's' : ''} available</p>
                ) : (
                  <p className="text-white/80 text-sm">Waiting for models to download...</p>
                )}
              </div>
            </div>
            {isLoadingModels && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full"
              />
            )}
          </div>
        </motion.div>

        {/* Status Bar */}
        {(isLoadingModels || isSwitchingModel || apiError || models.length === 0) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="border-b border-gray-200 bg-gradient-to-r from-slate-50 to-gray-50 px-6 py-3"
          >
            {isSwitchingModel && (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-4 h-4 border-2 border-slate-600 border-t-transparent rounded-full"
                  />
                  <span className="text-sm text-slate-700">Switching models and optimizing memory...</span>
                </div>
              </div>
            )}
            {isLoadingModels && models.length === 0 && !isSwitchingModel && (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-4 h-4 border-2 border-slate-600 border-t-transparent rounded-full"
                  />
                  <span className="text-sm text-slate-700">Downloading AI models... This may take 15-20 minutes on first run.</span>
                </div>
                <button 
                  onClick={loadAvailableModels}
                  disabled={isLoadingModels}
                  className="text-sm text-slate-700 underline hover:text-slate-800 disabled:opacity-50"
                >
                  Check Again
                </button>
              </div>
            )}
            {!isLoadingModels && models.length === 0 && !apiError && !isSwitchingModel && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-amber-700">No models available yet. Models may still be downloading.</span>
                <button 
                  onClick={loadAvailableModels}
                  className="text-sm text-amber-700 underline hover:text-amber-800"
                >
                  Refresh
                </button>
              </div>
            )}
            {apiError && !isSwitchingModel && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-red-600">{apiError}</p>
                <button 
                  onClick={loadAvailableModels}
                  className="text-sm text-red-700 underline hover:text-red-800"
                >
                  Retry
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <AnimatePresence>
            {messages.map((message, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[70%] ${message.role === 'user' ? 'order-2' : 'order-1'}`}>
                  {message.role === 'assistant' && (
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="w-6 h-6 bg-gradient-to-r from-slate-600 to-slate-700 rounded-full flex items-center justify-center">
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-xs text-gray-500">{message.model}</span>
                    </div>
                  )}
                  <div
                    className={`rounded-2xl px-4 py-3 ${
                      message.role === 'user'
                        ? 'bg-gradient-to-r from-slate-600 to-slate-700 text-white ml-4'
                        : 'bg-gray-100 text-gray-800 mr-4'
                    }`}
                  >
                    {message.image && (
                      <motion.img
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        src={message.image}
                        alt="Uploaded"
                        className="w-full max-w-sm rounded-xl mb-3 shadow-md"
                      />
                    )}
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                  </div>
                </div>
                {message.role === 'user' && (
                  <div className="w-8 h-8 bg-gradient-to-r from-slate-600 to-slate-700 rounded-full flex items-center justify-center ml-3 flex-shrink-0">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="flex items-center space-x-3 bg-gray-100 rounded-2xl px-4 py-3 mr-4">
                <div className="flex space-x-1">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                    className="w-2 h-2 bg-gray-400 rounded-full"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                    className="w-2 h-2 bg-gray-400 rounded-full"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                    className="w-2 h-2 bg-gray-400 rounded-full"
                  />
                </div>
                <span className="text-sm text-gray-600">AI is thinking...</span>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="border-t border-gray-200 bg-gray-50/50 p-6"
        >
          {/* Model Selection Row */}
          {models.length > 0 && (
            <div className="mb-4">
              <Listbox value={selectedModel} onChange={handleModelChange}>
                <div className="relative">
                  <Listbox.Button className="relative w-full max-w-sm bg-white border border-gray-300 rounded-xl py-2 pl-3 pr-8 text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent shadow-sm">
                    {selectedModel ? (
                      <div className="flex items-center space-x-2">
                        <div className={`p-1.5 rounded-lg bg-gradient-to-r ${selectedModel.color}`}>
                          <selectedModel.icon className="w-3 h-3 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="block truncate font-medium text-sm">{selectedModel.name}</span>
                            {loadedModels.includes(selectedModel.id) && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                Loaded
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-500 text-sm">Select AI Model</span>
                    )}
                    <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    </span>
                  </Listbox.Button>
                  <Transition
                    as={React.Fragment}
                    leave="transition ease-in duration-100"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                  >
                    <Listbox.Options className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-xl shadow-lg max-h-96 overflow-auto focus:outline-none">
                      {models.map((model) => (
                        <Listbox.Option
                          key={model.id}
                          className={({ active }) =>
                            clsx(
                              'relative cursor-pointer select-none py-3 px-4',
                              active ? 'bg-slate-50 text-slate-900' : 'text-gray-900'
                            )
                          }
                          value={model}
                        >
                          {({ selected }) => (
                            <div className="flex items-center space-x-3">
                              <div className={`p-2 rounded-lg bg-gradient-to-r ${model.color}`}>
                                <model.icon className="w-4 h-4 text-white" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                  <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                                    {model.name}
                                  </span>
                                  {loadedModels.includes(model.id) && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                      Loaded
                                    </span>
                                  )}
                                  {isSwitchingModel && selected && (
                                    <motion.div
                                      animate={{ rotate: 360 }}
                                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                      className="w-3 h-3 border border-slate-600 border-t-transparent rounded-full"
                                    />
                                  )}
                                </div>
                                <span className="block text-xs text-gray-500 truncate">{model.description}</span>
                                <div className="flex space-x-1 mt-1">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                                    Text
                                  </span>
                                  {model.supportsImages && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                      Vision
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </Listbox.Option>
                      ))}
                    </Listbox.Options>
                  </Transition>
                </div>
              </Listbox>
            </div>
          )}

          {imagePreview && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-4 relative inline-block"
            >
              <img src={imagePreview} alt="Preview" className="w-20 h-20 object-cover rounded-xl shadow-md" />
              <button
                onClick={removeImage}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          )}
          
          <div className="flex items-end space-x-3">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              ref={fileInputRef}
              className="hidden"
            />
            
            {selectedModel?.supportsImages && (
              <motion.button
                whileHover={{ scale: isSwitchingModel ? 1 : 1.05 }}
                whileTap={{ scale: isSwitchingModel ? 1 : 0.95 }}
                onClick={() => fileInputRef.current?.click()}
                disabled={isSwitchingModel}
                className="p-3 bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-xl hover:from-slate-700 hover:to-slate-800 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                title="Upload Image"
              >
                <ImagePlus className="w-5 h-5" />
              </motion.button>
            )}
            
            <div className="flex-1 relative">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  !selectedModel 
                    ? "Select a model to start chatting..."
                    : isSwitchingModel
                      ? "Switching models, please wait..."
                    : selectedModel.supportsImages 
                      ? "Type your message or upload an image..."
                      : "Type your message..."
                }
                disabled={!selectedModel || isSwitchingModel}
                className="w-full resize-none border border-gray-300 rounded-xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent bg-white shadow-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                rows={1}
                style={{ minHeight: '48px' }}
              />
            </div>
            
            <motion.button
              whileHover={{ scale: selectedModel && !isSwitchingModel ? 1.05 : 1 }}
              whileTap={{ scale: selectedModel && !isSwitchingModel ? 0.95 : 1 }}
              onClick={sendMessage}
              disabled={isLoading || isSwitchingModel || (!inputText.trim() && !selectedImage) || !selectedModel}
              className="p-3 bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-xl hover:from-slate-700 hover:to-slate-800 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              <Send className="w-5 h-5" />
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default App;