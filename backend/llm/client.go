package llm

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// GradingRequest represents a request to generate AI feedback
type GradingRequest struct {
	Platform     string  `json:"platform"`
	APIKey       string  `json:"api_key"`
	Prompt       string  `json:"prompt"`
	SystemPrompt string  `json:"system_prompt"`
	TextModel    string  `json:"text_model"`
	AudioModel   string  `json:"audio_model"`
	MaxTokens    int     `json:"max_tokens"`
	Temperature  float64 `json:"temperature"`
}

// GradingResponse represents the AI feedback response
type GradingResponse struct {
	Feedback string `json:"feedback"`
	Error    string `json:"error,omitempty"`
}

// VisionAnalysisRequest represents a request to analyse an image with a vision-capable model
type VisionAnalysisRequest struct {
	Platform    string  `json:"platform"`
	APIKey      string  `json:"api_key"`
	Model       string  `json:"model"`
	Prompt      string  `json:"prompt"`
	ImageBase64 string  `json:"image_base64"`
	MimeType    string  `json:"mime_type"`
	MaxTokens   int     `json:"max_tokens"`
	Temperature float64 `json:"temperature"`
}

// VisionAnalysisResponse represents the result of a vision analysis request
type VisionAnalysisResponse struct {
	Summary string `json:"summary"`
	Error   string `json:"error,omitempty"`
}

// GenerateFeedback routes the request to the appropriate LLM provider
func GenerateFeedback(req GradingRequest) (*GradingResponse, error) {
	// Set defaults
	if req.MaxTokens == 0 {
		req.MaxTokens = 6000
	}
	if req.Temperature == 0 {
		req.Temperature = 0.7
	}

	var feedback string
	var err error

	switch req.Platform {
	case "openai":
		feedback, err = callOpenAI(req)
	case "anthropic":
		feedback, err = callAnthropic(req)
	case "google":
		feedback, err = callGoogleGemini(req)
	default:
		return nil, fmt.Errorf("unsupported platform: %s", req.Platform)
	}

	if err != nil {
		return &GradingResponse{Error: err.Error()}, err
	}

	return &GradingResponse{Feedback: feedback}, nil
}

// AnalyzeImage routes vision analysis to the appropriate provider
func AnalyzeImage(req VisionAnalysisRequest) (*VisionAnalysisResponse, error) {
	if req.MaxTokens == 0 {
		req.MaxTokens = 480
	}
	if req.Temperature == 0 {
		req.Temperature = 0.2
	}

	var summary string
	var err error

	switch req.Platform {
	case "openai":
		summary, err = callOpenAIVision(req)
	default:
		return nil, fmt.Errorf("vision analysis not supported for platform: %s", req.Platform)
	}

	if err != nil {
		return &VisionAnalysisResponse{Error: err.Error()}, err
	}

	return &VisionAnalysisResponse{Summary: summary}, nil
}

// OpenAI API structures
type openAIMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type openAIChoiceMessage struct {
	Role      string           `json:"role"`
	Content   json.RawMessage  `json:"content"`
	ToolCalls []openAIToolCall `json:"tool_calls"`
}

type openAIToolCall struct {
	Type     string `json:"type"`
	Function struct {
		Name      string `json:"name"`
		Arguments string `json:"arguments"`
	} `json:"function"`
}

type openAIResponse struct {
	Choices []struct {
		Message openAIChoiceMessage `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

func usesMaxCompletionTokens(model string) bool {
	return !isLegacyChatModel(model)
}

func requiresDefaultTemperature(model string) bool {
	return usesMaxCompletionTokens(model)
}

func isLegacyChatModel(model string) bool {
	model = normalizeModelName(model)
	return strings.HasPrefix(model, "gpt-3.5") ||
		(strings.HasPrefix(model, "gpt-4") &&
			!strings.HasPrefix(model, "gpt-4.1") &&
			!strings.HasPrefix(model, "gpt-4o"))
}

func normalizeModelName(in string) string {
	model := strings.ToLower(strings.TrimSpace(in))
	switch model {
	case "chatgpt-4o-latest":
		return "gpt-4o-mini"
	case "gpt-4o-mini-latest":
		return "gpt-4o-mini"
	}
	return model
}

func extractTextFromMessage(raw json.RawMessage) (string, error) {
	if len(raw) == 0 {
		return "", nil
	}

	var asString string
	if err := json.Unmarshal(raw, &asString); err == nil {
		return asString, nil
	}

	var parts []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	}
	if err := json.Unmarshal(raw, &parts); err == nil && len(parts) > 0 {
		var builder strings.Builder
		for _, part := range parts {
			if part.Text != "" {
				builder.WriteString(part.Text)
			}
		}
		return builder.String(), nil
	}

	return "", fmt.Errorf("unsupported message content structure")
}

// Call OpenAI API
func callOpenAI(req GradingRequest) (string, error) {
	systemContent := "You are a teaching assistant helping to grade student assignments. Provide constructive, detailed feedback."
	if req.SystemPrompt != "" {
		systemContent = req.SystemPrompt
	}

	// Use the specified model or default to a chat-compatible baseline
	model := req.TextModel
	if model == "" {
		model = "gpt-4o-mini"
	}

	normalizedModel := normalizeModelName(model)

	payload := map[string]interface{}{
		"model": normalizedModel,
		"messages": []openAIMessage{
			{Role: "system", Content: systemContent},
			{Role: "user", Content: req.Prompt},
		},
	}

	// Request plain text output for newer models to avoid tool-call only responses
	if !isLegacyChatModel(normalizedModel) {
		payload["response_format"] = map[string]string{"type": "text"}
	}

	temperature := req.Temperature
	if temperature == 0 {
		temperature = 0.7
	}

	if requiresDefaultTemperature(normalizedModel) {
		if temperature != 1 {
			fmt.Printf("[OpenAI] model=%s forcing default temperature 1 (requested %.2f)\n", normalizedModel, temperature)
		}
		temperature = 1
	} else {
		payload["temperature"] = temperature
	}

	paramKey := "max_tokens"
	if usesMaxCompletionTokens(normalizedModel) {
		paramKey = "max_completion_tokens"
	}
	payload[paramKey] = req.MaxTokens

	fmt.Printf("[OpenAI] model=%s param=%s maxTokens=%d temperature=%.2f (explicit=%t)\n",
		normalizedModel,
		paramKey,
		req.MaxTokens,
		temperature,
		!requiresDefaultTemperature(normalizedModel),
	)

	tryRequest := func(bodyPayload map[string]interface{}) ([]byte, *openAIResponse, *http.Response, error) {
		bodyBytes, err := json.Marshal(bodyPayload)
		if err != nil {
			return nil, nil, nil, fmt.Errorf("failed to marshal request: %w", err)
		}

		httpReq, err := http.NewRequest("POST", "https://api.openai.com/v1/chat/completions", bytes.NewBuffer(bodyBytes))
		if err != nil {
			return nil, nil, nil, fmt.Errorf("failed to create request: %w", err)
		}

		httpReq.Header.Set("Content-Type", "application/json")
		httpReq.Header.Set("Authorization", "Bearer "+req.APIKey)

		client := &http.Client{Timeout: 60 * time.Second}
		resp, err := client.Do(httpReq)
		if err != nil {
			return nil, nil, nil, fmt.Errorf("request failed: %w", err)
		}
		defer resp.Body.Close()

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, nil, nil, fmt.Errorf("failed to read response: %w", err)
		}

		var apiResp openAIResponse
		_ = json.Unmarshal(body, &apiResp)

		return body, &apiResp, resp, nil
	}

	body, apiResp, resp, err := tryRequest(payload)
	if err != nil {
		return "", err
	}

	// Retry once if OpenAI complains about the token parameter
	if resp.StatusCode == http.StatusBadRequest && apiResp.Error != nil {
		lowerMsg := strings.ToLower(apiResp.Error.Message)
		fallback := false

		if strings.Contains(lowerMsg, "unsupported parameter: 'max_tokens'") {
			delete(payload, "max_tokens")
			payload["max_completion_tokens"] = req.MaxTokens
			fmt.Printf("[OpenAI] retrying with max_completion_tokens for model=%s\n", normalizedModel)
			fallback = true
		} else if strings.Contains(lowerMsg, "unsupported parameter: 'max_completion_tokens'") {
			delete(payload, "max_completion_tokens")
			payload["max_tokens"] = req.MaxTokens
			fmt.Printf("[OpenAI] retrying with max_tokens for model=%s\n", normalizedModel)
			fallback = true
		} else if strings.Contains(lowerMsg, "unsupported value: 'temperature'") {
			if _, ok := payload["temperature"]; ok {
				delete(payload, "temperature")
				fmt.Printf("[OpenAI] retrying without temperature for model=%s due to API constraints\n", normalizedModel)
				fallback = true
			}
		}

		if fallback {
			body, apiResp, resp, err = tryRequest(payload)
			if err != nil {
				return "", err
			}
		}
	}

	if resp.StatusCode != http.StatusOK {
		if apiResp.Error != nil {
			return "", fmt.Errorf("OpenAI API error: %s", apiResp.Error.Message)
		}
		return "", fmt.Errorf("OpenAI API error: status %d", resp.StatusCode)
	}

	var openAIResp openAIResponse
	if err := json.Unmarshal(body, &openAIResp); err != nil {
		return "", fmt.Errorf("failed to parse response: %w", err)
	}

	if len(openAIResp.Choices) == 0 {
		return "", fmt.Errorf("no response from OpenAI")
	}

	text, err := extractTextFromMessage(openAIResp.Choices[0].Message.Content)
	if err != nil {
		return "", fmt.Errorf("failed to extract content: %w", err)
	}

	text = strings.TrimSpace(text)
	if text == "" {
		if len(openAIResp.Choices[0].Message.ToolCalls) > 0 {
			return "", fmt.Errorf("model attempted to call a tool, which is not supported in this workflow. Please try again or choose a different model.")
		}
		return "", fmt.Errorf("received an empty response from OpenAI. Please try again.")
	}

	return text, nil
}

func callOpenAIVision(req VisionAnalysisRequest) (string, error) {
	systemContent := "You help teaching assistants interpret student-uploaded visuals. Provide concise descriptions that highlight elements relevant to grading."
	userPrompt := strings.TrimSpace(req.Prompt)
	if userPrompt == "" {
		userPrompt = "Describe the image in 2-3 bullet points, focusing on structure, relationships, and labels relevant for grading."
	}

	model := req.Model
	if model == "" {
		model = "gpt-4o-mini"
	}

	normalizedModel := normalizeModelName(model)

	mimeType := strings.TrimSpace(req.MimeType)
	if mimeType == "" {
		mimeType = "image/png"
	}

	imagePayload := strings.TrimSpace(req.ImageBase64)
	if imagePayload == "" {
		return "", fmt.Errorf("image payload missing for vision analysis")
	}
	imageURL := fmt.Sprintf("data:%s;base64,%s", mimeType, imagePayload)

	userContent := []map[string]interface{}{
		{
			"type": "text",
			"text": userPrompt,
		},
		{
			"type": "image_url",
			"image_url": map[string]interface{}{
				"url": imageURL,
			},
		},
	}

	payload := map[string]interface{}{
		"model": normalizedModel,
		"messages": []map[string]interface{}{
			{
				"role": "system",
				"content": []map[string]interface{}{
					{"type": "text", "text": systemContent},
				},
			},
			{
				"role":    "user",
				"content": userContent,
			},
		},
		"response_format": map[string]string{"type": "text"},
	}

	temperature := req.Temperature
	if requiresDefaultTemperature(normalizedModel) {
		if temperature != 1 {
			fmt.Printf("[OpenAI Vision] model=%s forcing default temperature 1 (requested %.2f)\n", normalizedModel, temperature)
		}
		temperature = 1
	} else {
		payload["temperature"] = temperature
	}

	paramKey := "max_tokens"
	if usesMaxCompletionTokens(normalizedModel) {
		paramKey = "max_completion_tokens"
	}
	payload[paramKey] = req.MaxTokens

	tryRequest := func(bodyPayload map[string]interface{}) ([]byte, *openAIResponse, *http.Response, error) {
		bodyBytes, err := json.Marshal(bodyPayload)
		if err != nil {
			return nil, nil, nil, fmt.Errorf("failed to marshal request: %w", err)
		}

		httpReq, err := http.NewRequest("POST", "https://api.openai.com/v1/chat/completions", bytes.NewBuffer(bodyBytes))
		if err != nil {
			return nil, nil, nil, fmt.Errorf("failed to create request: %w", err)
		}

		httpReq.Header.Set("Content-Type", "application/json")
		httpReq.Header.Set("Authorization", "Bearer "+req.APIKey)

		client := &http.Client{Timeout: 60 * time.Second}
		resp, err := client.Do(httpReq)
		if err != nil {
			return nil, nil, nil, fmt.Errorf("request failed: %w", err)
		}
		defer resp.Body.Close()

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, nil, nil, fmt.Errorf("failed to read response: %w", err)
		}

		var apiResp openAIResponse
		_ = json.Unmarshal(body, &apiResp)

		return body, &apiResp, resp, nil
	}

	body, apiResp, resp, err := tryRequest(payload)
	if err != nil {
		return "", err
	}

	if resp.StatusCode == http.StatusBadRequest && apiResp.Error != nil {
		lowerMsg := strings.ToLower(apiResp.Error.Message)
		fallback := false

		if strings.Contains(lowerMsg, "unsupported parameter: 'max_tokens'") {
			delete(payload, "max_tokens")
			payload["max_completion_tokens"] = req.MaxTokens
			fmt.Printf("[OpenAI Vision] retrying with max_completion_tokens for model=%s\n", normalizedModel)
			fallback = true
		} else if strings.Contains(lowerMsg, "unsupported parameter: 'max_completion_tokens'") {
			delete(payload, "max_completion_tokens")
			payload["max_tokens"] = req.MaxTokens
			fmt.Printf("[OpenAI Vision] retrying with max_tokens for model=%s\n", normalizedModel)
			fallback = true
		}

		if fallback {
			body, apiResp, resp, err = tryRequest(payload)
			if err != nil {
				return "", err
			}
		}
	}

	if resp.StatusCode != http.StatusOK {
		if apiResp.Error != nil {
			return "", fmt.Errorf("OpenAI vision API error: %s", apiResp.Error.Message)
		}
		return "", fmt.Errorf("OpenAI vision API error: status %d", resp.StatusCode)
	}

	var openAIResp openAIResponse
	if err := json.Unmarshal(body, &openAIResp); err != nil {
		return "", fmt.Errorf("failed to parse response: %w", err)
	}

	if len(openAIResp.Choices) == 0 {
		return "", fmt.Errorf("no response from OpenAI vision endpoint")
	}

	text, err := extractTextFromMessage(openAIResp.Choices[0].Message.Content)
	if err != nil {
		return "", fmt.Errorf("failed to extract content: %w", err)
	}

	text = strings.TrimSpace(text)
	if text == "" {
		return "", fmt.Errorf("received an empty response from OpenAI vision endpoint")
	}

	return text, nil
}

// Anthropic API structures
type anthropicRequest struct {
	Model     string             `json:"model"`
	MaxTokens int                `json:"max_tokens"`
	Messages  []anthropicMessage `json:"messages"`
}

type anthropicMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type anthropicResponse struct {
	Content []struct {
		Text string `json:"text"`
	} `json:"content"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

// Call Anthropic Claude API
func callAnthropic(req GradingRequest) (string, error) {
	systemContent := "You are a teaching assistant helping to grade student assignments. Provide constructive, detailed feedback."
	if req.SystemPrompt != "" {
		systemContent = req.SystemPrompt
	}

	fullPrompt := systemContent + "\n\n" + req.Prompt

	// Use the specified model or default to claude-sonnet-4-5-20250929
	model := req.TextModel
	if model == "" {
		model = "claude-sonnet-4-5-20250929"
	}

	requestBody := anthropicRequest{
		Model:     model,
		MaxTokens: req.MaxTokens,
		Messages: []anthropicMessage{
			{Role: "user", Content: fullPrompt},
		},
	}

	bodyBytes, err := json.Marshal(requestBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequest("POST", "https://api.anthropic.com/v1/messages", bytes.NewBuffer(bodyBytes))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-api-key", req.APIKey)
	httpReq.Header.Set("anthropic-version", "2023-06-01")

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return "", fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		var errorResp anthropicResponse
		json.Unmarshal(body, &errorResp)
		if errorResp.Error != nil {
			return "", fmt.Errorf("Anthropic API error: %s", errorResp.Error.Message)
		}
		return "", fmt.Errorf("Anthropic API error: status %d", resp.StatusCode)
	}

	var anthropicResp anthropicResponse
	if err := json.Unmarshal(body, &anthropicResp); err != nil {
		return "", fmt.Errorf("failed to parse response: %w", err)
	}

	if len(anthropicResp.Content) == 0 {
		return "", fmt.Errorf("no response from Anthropic")
	}

	return anthropicResp.Content[0].Text, nil
}

// Google Gemini API structures
type geminiRequest struct {
	Contents         []geminiContent `json:"contents"`
	GenerationConfig geminiGenConfig `json:"generationConfig"`
}

type geminiContent struct {
	Parts []geminiPart `json:"parts"`
}

type geminiPart struct {
	Text string `json:"text"`
}

type geminiGenConfig struct {
	Temperature     float64 `json:"temperature"`
	MaxOutputTokens int     `json:"maxOutputTokens"`
}

type geminiResponse struct {
	Candidates []struct {
		Content struct {
			Parts []geminiPart `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

// Call Google Gemini API
func callGoogleGemini(req GradingRequest) (string, error) {
	systemContent := "You are a teaching assistant helping to grade student assignments. Provide constructive, detailed feedback."
	if req.SystemPrompt != "" {
		systemContent = req.SystemPrompt
	}

	fullPrompt := systemContent + "\n\n" + req.Prompt

	// Use the specified model or default to gemini-2.5-pro
	model := req.TextModel
	if model == "" {
		model = "gemini-2.5-pro"
	}

	requestBody := geminiRequest{
		Contents: []geminiContent{
			{
				Parts: []geminiPart{
					{Text: fullPrompt},
				},
			},
		},
		GenerationConfig: geminiGenConfig{
			Temperature:     req.Temperature,
			MaxOutputTokens: req.MaxTokens,
		},
	}

	bodyBytes, err := json.Marshal(requestBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", model, req.APIKey)
	httpReq, err := http.NewRequest("POST", url, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return "", fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		var errorResp geminiResponse
		json.Unmarshal(body, &errorResp)
		if errorResp.Error != nil {
			return "", fmt.Errorf("Google Gemini API error: %s", errorResp.Error.Message)
		}
		return "", fmt.Errorf("Google Gemini API error: status %d", resp.StatusCode)
	}

	var geminiResp geminiResponse
	if err := json.Unmarshal(body, &geminiResp); err != nil {
		return "", fmt.Errorf("failed to parse response: %w", err)
	}

	if len(geminiResp.Candidates) == 0 || len(geminiResp.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("no response from Google Gemini")
	}

	return geminiResp.Candidates[0].Content.Parts[0].Text, nil
}
