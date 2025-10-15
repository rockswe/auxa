package llm

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// GradingRequest represents a request to generate AI feedback
type GradingRequest struct {
	Platform     string  `json:"platform"`
	APIKey       string  `json:"api_key"`
	Prompt       string  `json:"prompt"`
	SystemPrompt string  `json:"system_prompt"`
	MaxTokens    int     `json:"max_tokens"`
	Temperature  float64 `json:"temperature"`
}

// GradingResponse represents the AI feedback response
type GradingResponse struct {
	Feedback string `json:"feedback"`
	Error    string `json:"error,omitempty"`
}

// GenerateFeedback routes the request to the appropriate LLM provider
func GenerateFeedback(req GradingRequest) (*GradingResponse, error) {
	// Set defaults
	if req.MaxTokens == 0 {
		req.MaxTokens = 2000
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

// OpenAI API structures
type openAIRequest struct {
	Model       string          `json:"model"`
	Messages    []openAIMessage `json:"messages"`
	Temperature float64         `json:"temperature"`
	MaxTokens   int             `json:"max_tokens"`
}

type openAIMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type openAIResponse struct {
	Choices []struct {
		Message openAIMessage `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

// Call OpenAI API
func callOpenAI(req GradingRequest) (string, error) {
	systemContent := "You are an expert teaching assistant helping to grade student assignments. Provide constructive, detailed feedback."
	if req.SystemPrompt != "" {
		systemContent = req.SystemPrompt
	}

	requestBody := openAIRequest{
		Model: "gpt-4o",
		Messages: []openAIMessage{
			{Role: "system", Content: systemContent},
			{Role: "user", Content: req.Prompt},
		},
		Temperature: req.Temperature,
		MaxTokens:   req.MaxTokens,
	}

	bodyBytes, err := json.Marshal(requestBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequest("POST", "https://api.openai.com/v1/chat/completions", bytes.NewBuffer(bodyBytes))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+req.APIKey)

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
		var errorResp openAIResponse
		json.Unmarshal(body, &errorResp)
		if errorResp.Error != nil {
			return "", fmt.Errorf("OpenAI API error: %s", errorResp.Error.Message)
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

	return openAIResp.Choices[0].Message.Content, nil
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
	systemContent := "You are an expert teaching assistant helping to grade student assignments. Provide constructive, detailed feedback."
	if req.SystemPrompt != "" {
		systemContent = req.SystemPrompt
	}

	fullPrompt := systemContent + "\n\n" + req.Prompt

	requestBody := anthropicRequest{
		Model:     "claude-3-5-sonnet-20241022",
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
	systemContent := "You are an expert teaching assistant helping to grade student assignments. Provide constructive, detailed feedback."
	if req.SystemPrompt != "" {
		systemContent = req.SystemPrompt
	}

	fullPrompt := systemContent + "\n\n" + req.Prompt

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

	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=%s", req.APIKey)
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
