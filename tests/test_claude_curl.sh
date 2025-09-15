#!/bin/bash

# Claude API cURL Test Script
# This script tests the Claude API using the exact official cURL format

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '#' | awk '/=/ {print $1}')
fi

# Check if API key is set
if [ -z "$CLAUDE_API_KEY" ]; then
    echo -e "${RED}❌ Error: CLAUDE_API_KEY not found in environment variables${NC}"
    echo -e "${YELLOW}💡 Make sure your .env file contains: CLAUDE_API_KEY=sk-ant-...${NC}"
    exit 1
fi

echo -e "${CYAN}🤖 Claude API cURL Test Suite${NC}"
echo -e "${CYAN}================================${NC}"
echo -e "${BLUE}API Key: ${CLAUDE_API_KEY:0:10}...${NC}"
echo ""

# Test function for a single model
test_claude_model() {
    local model="$1"
    local model_name="$2"
    local is_claude4="$3"

    echo -e "${BLUE}Testing $model_name ($model)...${NC}"

    # Build the request payload
    local request_data='{
        "model": "'$model'",
        "max_tokens": 20,
        "messages": [
            {"role": "user", "content": "Say \"Hello!\" in exactly one word."}
        ]
    }'

    # Add temperature for non-Opus 4.1 models
    if [ "$model" != "claude-opus-4-1-20250805" ]; then
        request_data='{
            "model": "'$model'",
            "max_tokens": 20,
            "temperature": 0.7,
            "messages": [
                {"role": "user", "content": "Say \"Hello!\" in exactly one word."}
            ]
        }'
    fi

    # Build headers - add beta header for Claude 4 models
    local headers=(
        -H "x-api-key: $CLAUDE_API_KEY"
        -H "anthropic-version: 2023-06-01"
        -H "content-type: application/json"
    )

    if [ "$is_claude4" = "true" ]; then
        headers+=(-H "anthropic-beta: interleaved-thinking-2025-05-14")
        echo -e "  ${YELLOW}ℹ️  Using beta headers for Claude 4 model${NC}"
    fi

    echo -e "  📤 Request payload:"
    echo "$request_data" | jq '.' 2>/dev/null || echo "$request_data"
    echo ""

    # Make the API call and capture response
    local start_time=$(date +%s%3N)
    local response=$(curl -s -w "\n%{http_code}" \
        https://api.anthropic.com/v1/messages \
        "${headers[@]}" \
        -d "$request_data")
    local end_time=$(date +%s%3N)

    # Split response and status code
    local http_code=$(echo "$response" | tail -n1)
    local response_body=$(echo "$response" | head -n -1)
    local response_time=$((end_time - start_time))

    echo -e "  📥 Response (${response_time}ms):"

    # Check HTTP status
    if [ "$http_code" = "200" ]; then
        echo -e "  ${GREEN}✅ HTTP 200 OK${NC}"

        # Parse and validate response
        local content=$(echo "$response_body" | jq -r '.content[0].text' 2>/dev/null)
        local input_tokens=$(echo "$response_body" | jq -r '.usage.input_tokens' 2>/dev/null)
        local output_tokens=$(echo "$response_body" | jq -r '.usage.output_tokens' 2>/dev/null)

        if [ "$content" != "null" ] && [ "$content" != "" ]; then
            echo -e "  ${GREEN}✅ Valid response structure${NC}"
            echo -e "  💬 Response: \"$content\""
            echo -e "  🔢 Tokens: $input_tokens input, $output_tokens output"
            echo -e "  ⏱️  Response time: ${response_time}ms"
            return 0
        else
            echo -e "  ${RED}❌ Invalid response structure${NC}"
            echo "  Response body: $response_body"
            return 1
        fi
    else
        echo -e "  ${RED}❌ HTTP $http_code${NC}"

        # Try to parse error message
        local error_message=$(echo "$response_body" | jq -r '.error.message' 2>/dev/null)
        if [ "$error_message" != "null" ] && [ "$error_message" != "" ]; then
            echo -e "  ${RED}Error: $error_message${NC}"
        else
            echo "  Response body: $response_body"
        fi

        # Provide helpful hints
        case "$http_code" in
            401)
                echo -e "  ${YELLOW}💡 Hint: Check your API key is valid${NC}"
                ;;
            404)
                echo -e "  ${YELLOW}💡 Hint: Model may not be available or endpoint incorrect${NC}"
                ;;
            400)
                echo -e "  ${YELLOW}💡 Hint: Request format may be incorrect${NC}"
                ;;
            429)
                echo -e "  ${YELLOW}💡 Hint: Rate limit exceeded${NC}"
                ;;
            500|502|503|504)
                echo -e "  ${YELLOW}💡 Hint: Server error, try again later${NC}"
                ;;
        esac
        return 1
    fi
}

# Test basic connectivity with most reliable model
echo -e "${CYAN}🔌 Testing Basic Connectivity${NC}"
echo "================================"

if test_claude_model "claude-3-5-haiku-20241022" "Claude 3.5 Haiku (Most Reliable)" "false"; then
    echo -e "${GREEN}✅ Basic connectivity: WORKING${NC}"
    basic_connectivity=true
else
    echo -e "${RED}❌ Basic connectivity: FAILED${NC}"
    basic_connectivity=false
fi
echo ""

# If basic connectivity fails, stop here
if [ "$basic_connectivity" = false ]; then
    echo -e "${RED}❌ Basic connectivity failed. Check your API key and network connection.${NC}"
    exit 1
fi

# Test all Claude models
echo -e "${CYAN}🧪 Testing All Claude Models${NC}"
echo "============================="

declare -A claude_models=(
    ["claude-opus-4-1-20250805"]="Claude Opus 4.1 (Latest & Most Powerful)|true"
    ["claude-sonnet-4-20250514"]="Claude Sonnet 4 (Best Balance)|true"
    ["claude-3-5-haiku-20241022"]="Claude 3.5 Haiku (Fast & Economical)|false"
    ["claude-3-5-sonnet-20241022"]="Claude 3.5 Sonnet (Legacy)|false"
    ["claude-3-5-sonnet-20240620"]="Claude 3.5 Sonnet (Legacy)|false"
)

successful_models=()
failed_models=()
claude4_working=()

for model in "${!claude_models[@]}"; do
    IFS='|' read -r model_name is_claude4 <<< "${claude_models[$model]}"

    if test_claude_model "$model" "$model_name" "$is_claude4"; then
        successful_models+=("$model")
        if [ "$is_claude4" = "true" ]; then
            claude4_working+=("$model")
        fi
    else
        failed_models+=("$model")
    fi
    echo ""
done

# Generate summary
echo -e "${CYAN}📊 Test Summary${NC}"
echo "================"
echo -e "${GREEN}✅ Successful: ${#successful_models[@]}/${#claude_models[@]}${NC}"
echo -e "${RED}❌ Failed: ${#failed_models[@]}/${#claude_models[@]}${NC}"

if [ ${#successful_models[@]} -gt 0 ]; then
    echo ""
    echo -e "${GREEN}Working models:${NC}"
    for model in "${successful_models[@]}"; do
        IFS='|' read -r model_name is_claude4 <<< "${claude_models[$model]}"
        if [ "$is_claude4" = "true" ]; then
            echo -e "  🆕 $model - $model_name"
        else
            echo -e "  📜 $model - $model_name"
        fi
    done
fi

if [ ${#failed_models[@]} -gt 0 ]; then
    echo ""
    echo -e "${RED}Failed models:${NC}"
    for model in "${failed_models[@]}"; do
        IFS='|' read -r model_name is_claude4 <<< "${claude_models[$model]}"
        echo -e "  ❌ $model - $model_name"
    done
fi

echo ""
echo -e "${CYAN}🔍 Analysis:${NC}"

if [ ${#claude4_working[@]} -gt 0 ]; then
    echo -e "${GREEN}✅ Claude 4 models are available and working!${NC}"
    echo -e "${GREEN}🎉 Recommended: Use Claude 4 models for best performance${NC}"
else
    echo -e "${YELLOW}⚠️  Claude 4 models are not available yet${NC}"
    echo -e "${YELLOW}📝 Recommendation: Use Claude 3.5 models instead${NC}"
fi

if [ ${#successful_models[@]} -eq 0 ]; then
    echo -e "${RED}❌ No models are working. Check your API key and account status.${NC}"
    exit 1
elif [ ${#successful_models[@]} -eq ${#claude_models[@]} ]; then
    echo -e "${GREEN}🎉 All models are working perfectly!${NC}"
fi

echo ""
echo -e "${CYAN}✅ Test completed successfully!${NC}"