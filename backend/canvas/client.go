package canvas

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type Client struct {
	Token      string
	SchoolURL  string
	BaseURL    string
	HTTPClient *http.Client
}

// NewClient creates a new Canvas API client
func NewClient(token, schoolURL string) *Client {
	// Ensure schoolURL doesn't have protocol
	schoolURL = strings.TrimPrefix(schoolURL, "https://")
	schoolURL = strings.TrimPrefix(schoolURL, "http://")

	return &Client{
		Token:     token,
		SchoolURL: schoolURL,
		BaseURL:   fmt.Sprintf("https://%s/api/v1", schoolURL),
		HTTPClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// makeRequest performs an HTTP request to Canvas API
func (c *Client) makeRequest(method, endpoint string, params url.Values) ([]byte, error) {
	urlStr := fmt.Sprintf("%s%s", c.BaseURL, endpoint)

	if len(params) > 0 {
		urlStr += "?" + params.Encode()
	}

	req, err := http.NewRequest(method, urlStr, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.Token))
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("API error (status %d): %s", resp.StatusCode, string(body))
	}

	return body, nil
}

// GetUserProfile fetches the current user's profile (for connection testing)
func (c *Client) GetUserProfile() (*User, error) {
	body, err := c.makeRequest("GET", "/users/self", nil)
	if err != nil {
		return nil, err
	}

	var user User
	if err := json.Unmarshal(body, &user); err != nil {
		return nil, fmt.Errorf("failed to parse user: %w", err)
	}

	return &user, nil
}

// GetTACourses fetches all courses where the user is a TA (current term only)
func (c *Client) GetTACourses() ([]Course, error) {
	params := url.Values{}
	params.Add("enrollment_type", "ta")
	params.Add("enrollment_state", "active") // Only active enrollments
	params.Add("state[]", "available")
	params.Add("state[]", "unpublished")
	params.Add("include[]", "total_students")
	params.Add("include[]", "term")
	params.Add("per_page", "100")

	body, err := c.makeRequest("GET", "/courses", params)
	if err != nil {
		return nil, err
	}

	var courses []Course
	if err := json.Unmarshal(body, &courses); err != nil {
		return nil, fmt.Errorf("failed to parse courses: %w", err)
	}

	return courses, nil
}

// GetCourseAssignments fetches all assignments for a course
func (c *Client) GetCourseAssignments(courseID string) ([]Assignment, error) {
	params := url.Values{}
	params.Add("per_page", "100")

	endpoint := fmt.Sprintf("/courses/%s/assignments", courseID)
	body, err := c.makeRequest("GET", endpoint, params)
	if err != nil {
		return nil, err
	}

	var assignments []Assignment
	if err := json.Unmarshal(body, &assignments); err != nil {
		return nil, fmt.Errorf("failed to parse assignments: %w", err)
	}

	return assignments, nil
}

// GetAssignmentSubmissions fetches all submissions for an assignment
func (c *Client) GetAssignmentSubmissions(courseID, assignmentID string) ([]Submission, error) {
	params := url.Values{}
	params.Add("include[]", "submission_history")
	params.Add("include[]", "submission_comments")
	params.Add("include[]", "rubric_assessment")
	params.Add("include[]", "assignment")
	params.Add("include[]", "user")
	params.Add("include[]", "visibility")
	params.Add("per_page", "100")

	endpoint := fmt.Sprintf("/courses/%s/assignments/%s/submissions", courseID, assignmentID)
	body, err := c.makeRequest("GET", endpoint, params)
	if err != nil {
		return nil, err
	}

	var submissions []Submission
	if err := json.Unmarshal(body, &submissions); err != nil {
		return nil, fmt.Errorf("failed to parse submissions: %w", err)
	}

	return submissions, nil
}

// GetUngradedSubmissions fetches only ungraded submissions for an assignment
func (c *Client) GetUngradedSubmissions(courseID, assignmentID string) ([]Submission, error) {
	allSubmissions, err := c.GetAssignmentSubmissions(courseID, assignmentID)
	if err != nil {
		return nil, err
	}

	// Filter for ungraded submissions
	var ungradedSubmissions []Submission
	for _, submission := range allSubmissions {
		// Check if submission is ungraded
		// Ungraded: grader_id is null/0, no grade posted, and workflow_state is "submitted"
		if submission.WorkflowState == "submitted" &&
			(submission.GraderID == 0 || submission.GraderID == -1) &&
			submission.Grade == "" &&
			submission.Score == 0 {
			ungradedSubmissions = append(ungradedSubmissions, submission)
		}
	}

	return ungradedSubmissions, nil
}

// GetCoursesWithUngradedCount fetches TA courses and counts ungraded submissions
func (c *Client) GetCoursesWithUngradedCount() ([]CourseWithStats, error) {
	courses, err := c.GetTACourses()
	if err != nil {
		return nil, err
	}

	var coursesWithStats []CourseWithStats
	for _, course := range courses {
		stats := CourseWithStats{
			Course:        course,
			UngradedCount: 0,
		}

		// Get assignments for this course
		assignments, err := c.GetCourseAssignments(fmt.Sprintf("%d", course.ID))
		if err != nil {
			// Log error but continue with other courses
			fmt.Printf("Error fetching assignments for course %d: %v\n", course.ID, err)
			continue
		}

		// Count ungraded submissions across all assignments
		for _, assignment := range assignments {
			ungraded, err := c.GetUngradedSubmissions(
				fmt.Sprintf("%d", course.ID),
				fmt.Sprintf("%d", assignment.ID),
			)
			if err != nil {
				fmt.Printf("Error fetching ungraded for assignment %d: %v\n", assignment.ID, err)
				continue
			}
			stats.UngradedCount += len(ungraded)
		}

		coursesWithStats = append(coursesWithStats, stats)
	}

	return coursesWithStats, nil
}

// GetCourseEnrollments fetches active student enrollments for a course
func (c *Client) GetCourseEnrollments(courseID string) ([]Enrollment, error) {
	url := fmt.Sprintf("%s/api/v1/courses/%s/enrollments?type[]=StudentEnrollment&state[]=active&per_page=100", c.BaseURL, courseID)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+c.Token)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("canvas API error: %s - %s", resp.Status, string(body))
	}

	var enrollments []Enrollment
	if err := json.NewDecoder(resp.Body).Decode(&enrollments); err != nil {
		return nil, err
	}

	return enrollments, nil
}
