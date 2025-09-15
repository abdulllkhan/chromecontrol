# Claude API cURL Examples

## Basic Test (Claude 3.5 Haiku - Most Reliable)

```bash
curl https://api.anthropic.com/v1/messages \
     --header "x-api-key: YOUR_API_KEY_HERE" \
     --header "anthropic-version: 2023-06-01" \
     --header "content-type: application/json" \
     --data '{
         "model": "claude-3-5-haiku-20241022",
         "max_tokens": 20,
         "temperature": 0.7,
         "messages": [
             {"role": "user", "content": "Say \"Hello!\" in exactly one word."}
         ]
     }'
```

## Claude Sonnet 4 Test (Latest Recommended)

```bash
curl https://api.anthropic.com/v1/messages \
     --header "x-api-key: YOUR_API_KEY_HERE" \
     --header "anthropic-version: 2023-06-01" \
     --header "anthropic-beta: interleaved-thinking-2025-05-14" \
     --header "content-type: application/json" \
     --data '{
         "model": "claude-sonnet-4-20250514",
         "max_tokens": 50,
         "temperature": 0.7,
         "messages": [
             {"role": "user", "content": "Explain quantum computing in one sentence."}
         ]
     }'
```

## Claude Opus 4.1 Test (Most Powerful - No Temperature)

```bash
curl https://api.anthropic.com/v1/messages \
     --header "x-api-key: YOUR_API_KEY_HERE" \
     --header "anthropic-version: 2023-06-01" \
     --header "anthropic-beta: interleaved-thinking-2025-05-14" \
     --header "content-type: application/json" \
     --data '{
         "model": "claude-opus-4-1-20250805",
         "max_tokens": 100,
         "messages": [
             {"role": "user", "content": "Write a creative haiku about programming."}
         ]
     }'
```

## Using Environment Variable

First, set your API key:
```bash
export CLAUDE_API_KEY="sk-ant-your-api-key-here"
```

Then use it in cURL:
```bash
curl https://api.anthropic.com/v1/messages \
     --header "x-api-key: $CLAUDE_API_KEY" \
     --header "anthropic-version: 2023-06-01" \
     --header "content-type: application/json" \
     --data '{
         "model": "claude-3-5-haiku-20241022",
         "max_tokens": 20,
         "messages": [
             {"role": "user", "content": "Hi"}
         ]
     }'
```

## Expected Response Format

```json
{
  "id": "msg_01...",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "Hello!"
    }
  ],
  "model": "claude-3-5-haiku-20241022",
  "stop_reason": "end_turn",
  "stop_sequence": null,
  "usage": {
    "input_tokens": 12,
    "output_tokens": 2
  }
}
```

## Common Error Responses

### 401 Unauthorized
```json
{
  "type": "error",
  "error": {
    "type": "authentication_error",
    "message": "invalid x-api-key"
  }
}
```

### 404 Model Not Found
```json
{
  "type": "error",
  "error": {
    "type": "not_found_error",
    "message": "model not found"
  }
}
```

### 400 Bad Request
```json
{
  "type": "error",
  "error": {
    "type": "invalid_request_error",
    "message": "messages: field required"
  }
}
```

## Key Points

1. **Required Headers:**
   - `x-api-key`: Your Claude API key (starts with `sk-ant-`)
   - `anthropic-version`: Use `2023-06-01` (current stable)
   - `content-type`: Must be `application/json`

2. **Claude 4 Models:**
   - Add `anthropic-beta: interleaved-thinking-2025-05-14` header
   - Claude Opus 4.1 may have temperature restrictions

3. **Request Body:**
   - `model`: Specific Claude model identifier
   - `max_tokens`: Maximum tokens to generate (required)
   - `messages`: Array of message objects with `role` and `content`
   - `temperature`: Optional, controls randomness (0-1)

4. **Testing Order:**
   1. Start with Claude 3.5 Haiku (most reliable)
   2. Test Claude Sonnet 4 (best balance)
   3. Try Claude Opus 4.1 (most powerful)

5. **Troubleshooting:**
   - Check API key is correct and has proper permissions
   - Verify account has access to Claude 4 models
   - Ensure network connectivity to api.anthropic.com
   - Claude 4 models may not be available in all regions yet