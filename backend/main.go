package main

import (
	"log"
	"net/http"

	"auxa/canvas"
	"auxa/llm"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	router := gin.Default()

	// Enable CORS for Electron app
	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:*", "file://*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
		AllowWildcard:    true,
	}))

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Canvas API routes
	api := router.Group("/api")
	{
		api.POST("/connect", connectToCanvas)
		api.GET("/courses", getTACourses)
		api.GET("/courses/:course_id/assignments", getCourseAssignments)
		api.GET("/courses/:course_id/assignments/:assignment_id/submissions", getAssignmentSubmissions)
		api.GET("/courses/:course_id/assignments/:assignment_id/ungraded", getUngradedSubmissions)

		// LLM API routes
		api.POST("/llm/generate-feedback", generateAIFeedback)
	}

	log.Println("Server starting on http://localhost:3000")
	if err := router.Run(":3000"); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}

// Connect and validate Canvas credentials
func connectToCanvas(c *gin.Context) {
	var req struct {
		Token     string `json:"token" binding:"required"`
		SchoolURL string `json:"school_url" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	client := canvas.NewClient(req.Token, req.SchoolURL)

	// Test connection by fetching user profile
	profile, err := client.GetUserProfile()
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Failed to connect to Canvas: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Connected successfully",
		"user":    profile,
	})
}

// Get courses where user is a TA
func getTACourses(c *gin.Context) {
	token := c.GetHeader("Authorization")
	schoolURL := c.GetHeader("X-School-URL")

	if token == "" || schoolURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing credentials"})
		return
	}

	client := canvas.NewClient(token, schoolURL)
	courses, err := client.GetTACourses()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, courses)
}

// Get assignments for a course
func getCourseAssignments(c *gin.Context) {
	courseID := c.Param("course_id")
	token := c.GetHeader("Authorization")
	schoolURL := c.GetHeader("X-School-URL")

	if token == "" || schoolURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing credentials"})
		return
	}

	client := canvas.NewClient(token, schoolURL)
	assignments, err := client.GetCourseAssignments(courseID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, assignments)
}

// Get all submissions for an assignment
func getAssignmentSubmissions(c *gin.Context) {
	courseID := c.Param("course_id")
	assignmentID := c.Param("assignment_id")
	token := c.GetHeader("Authorization")
	schoolURL := c.GetHeader("X-School-URL")

	if token == "" || schoolURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing credentials"})
		return
	}

	client := canvas.NewClient(token, schoolURL)
	submissions, err := client.GetAssignmentSubmissions(courseID, assignmentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, submissions)
}

// Get only ungraded submissions for an assignment
func getUngradedSubmissions(c *gin.Context) {
	courseID := c.Param("course_id")
	assignmentID := c.Param("assignment_id")
	token := c.GetHeader("Authorization")
	schoolURL := c.GetHeader("X-School-URL")

	if token == "" || schoolURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing credentials"})
		return
	}

	client := canvas.NewClient(token, schoolURL)
	submissions, err := client.GetUngradedSubmissions(courseID, assignmentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, submissions)
}

// Generate AI feedback for grading
func generateAIFeedback(c *gin.Context) {
	var req llm.GradingRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate required fields
	if req.Platform == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Platform is required"})
		return
	}

	if req.APIKey == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "API key is required"})
		return
	}

	if req.Prompt == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Prompt is required"})
		return
	}

	// Generate feedback
	response, err := llm.GenerateFeedback(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":    err.Error(),
			"feedback": "",
		})
		return
	}

	c.JSON(http.StatusOK, response)
}
