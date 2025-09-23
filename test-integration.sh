#!/bin/bash

echo "🧪 Testing Ollama Multi-Model Chat Integration"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test functions
test_service() {
    local service_name="$1"
    local url="$2"
    local expected_response="$3"
    
    echo -e "\n${BLUE}Testing ${service_name}...${NC}"
    
    response=$(curl -s "$url" 2>/dev/null)
    if [[ $? -eq 0 ]] && [[ "$response" == *"$expected_response"* ]]; then
        echo -e "${GREEN}✅ ${service_name} is healthy${NC}"
        return 0
    else
        echo -e "${RED}❌ ${service_name} failed${NC}"
        echo "Response: $response"
        return 1
    fi
}

test_json_endpoint() {
    local service_name="$1"
    local url="$2"
    local json_key="$3"
    
    echo -e "\n${BLUE}Testing ${service_name}...${NC}"
    
    response=$(curl -s "$url" 2>/dev/null)
    if [[ $? -eq 0 ]] && echo "$response" | jq -e ".$json_key" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ ${service_name} is healthy${NC}"
        echo "Response: $(echo "$response" | jq .)"
        return 0
    else
        echo -e "${RED}❌ ${service_name} failed${NC}"
        echo "Response: $response"
        return 1
    fi
}

# Check if services are running
echo -e "\n${YELLOW}Checking Docker services...${NC}"
docker-compose ps

echo -e "\n${YELLOW}Running integration tests...${NC}"

# Test 1: Frontend
test_service "Frontend" "http://localhost:3000" "<!doctype html>"

# Test 2: API Health
test_json_endpoint "API Health" "http://localhost:3001/health" "status"

# Test 3: API Models
test_json_endpoint "API Models" "http://localhost:3001/api/models" "success"

# Test 4: Check if any models are available
echo -e "\n${BLUE}Checking available models...${NC}"
models_response=$(curl -s "http://localhost:3001/api/models" 2>/dev/null)
model_count=$(echo "$models_response" | jq -r '.totalAvailable // 0')

if [[ $model_count -gt 0 ]]; then
    echo -e "${GREEN}✅ Found $model_count model(s) available${NC}"
    echo "Available models:"
    echo "$models_response" | jq -r '.models[].name' | sed 's/^/  - /'
    
    # Test 5: Try a simple chat request
    echo -e "\n${BLUE}Testing chat functionality...${NC}"
    first_model=$(echo "$models_response" | jq -r '.models[0].id')
    chat_response=$(curl -s -X POST "http://localhost:3001/api/chat" \
        -H "Content-Type: application/json" \
        -d "{\"model\": \"$first_model\", \"messages\": [{\"role\": \"user\", \"content\": \"Hello, can you respond with just 'Hi there!'?\"}]}" 2>/dev/null)
    
    if echo "$chat_response" | jq -e '.success' > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Chat functionality working${NC}"
        echo "Response: $(echo "$chat_response" | jq -r '.message.content')"
    else
        echo -e "${YELLOW}⏳ Chat not ready yet (model may still be loading)${NC}"
        echo "Response: $chat_response"
    fi
else
    echo -e "${YELLOW}⏳ No models available yet (still downloading)${NC}"
    echo "Check download progress with: docker-compose logs ollama"
fi

echo -e "\n${YELLOW}Service URLs:${NC}"
echo "🌐 Frontend: http://localhost:3000"
echo "🔧 API: http://localhost:3001"
echo "🤖 Ollama: http://localhost:11434"

echo -e "\n${BLUE}Integration test complete!${NC}"