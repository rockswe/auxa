package canvas

import "time"

// User represents a Canvas user
type User struct {
	ID           int    `json:"id"`
	Name         string `json:"name"`
	SortableName string `json:"sortable_name"`
	ShortName    string `json:"short_name"`
	Email        string `json:"email"`
	AvatarURL    string `json:"avatar_url"`
	LoginID      string `json:"login_id"`
}

// Enrollment represents a Canvas course enrollment
type Enrollment struct {
	ID                             int    `json:"id"`
	UserID                         int    `json:"user_id"`
	CourseID                       int    `json:"course_id"`
	Type                           string `json:"type"`
	EnrollmentState                string `json:"enrollment_state"`
	Role                           string `json:"role"`
	RoleID                         int    `json:"role_id"`
	LimitPrivilegesToCourseSection bool   `json:"limit_privileges_to_course_section"`
	User                           User   `json:"user"`
	Grades                         *struct {
		HTMLURL              string  `json:"html_url"`
		CurrentScore         float64 `json:"current_score"`
		CurrentGrade         string  `json:"current_grade"`
		FinalScore           float64 `json:"final_score"`
		FinalGrade           string  `json:"final_grade"`
		UnpostedCurrentScore float64 `json:"unposted_current_score"`
		UnpostedCurrentGrade string  `json:"unposted_current_grade"`
		UnpostedFinalScore   float64 `json:"unposted_final_score"`
		UnpostedFinalGrade   string  `json:"unposted_final_grade"`
	} `json:"grades"`
}

// Course represents a Canvas course
type Course struct {
	ID               int        `json:"id"`
	Name             string     `json:"name"`
	CourseCode       string     `json:"course_code"`
	WorkflowState    string     `json:"workflow_state"`
	AccountID        int        `json:"account_id"`
	StartAt          *time.Time `json:"start_at"`
	EndAt            *time.Time `json:"end_at"`
	EnrollmentTermID int        `json:"enrollment_term_id"`
	TotalStudents    int        `json:"total_students"`
	TimeZone         string     `json:"time_zone"`
}

// Assignment represents a Canvas assignment
type Assignment struct {
	ID                      int         `json:"id"`
	Name                    string      `json:"name"`
	Description             string      `json:"description"`
	DueAt                   *time.Time  `json:"due_at"`
	UnlockAt                *time.Time  `json:"unlock_at"`
	LockAt                  *time.Time  `json:"lock_at"`
	PointsPossible          float64     `json:"points_possible"`
	GradingType             string      `json:"grading_type"`
	SubmissionTypes         []string    `json:"submission_types"`
	WorkflowState           string      `json:"workflow_state"`
	HasSubmittedSubmissions bool        `json:"has_submitted_submissions"`
	CourseID                int         `json:"course_id"`
	HTMLURL                 string      `json:"html_url"`
	NeedsGradingCount       int         `json:"needs_grading_count"`
	Rubric                  []Rubric    `json:"rubric"`
	UseRubricForGrading     bool        `json:"use_rubric_for_grading"`
	RubricSettings          interface{} `json:"rubric_settings"`
}

// Rubric represents a grading rubric criterion
type Rubric struct {
	ID              string  `json:"id"`
	Points          float64 `json:"points"`
	Description     string  `json:"description"`
	LongDescription string  `json:"long_description"`
}

// Submission represents a Canvas submission
type Submission struct {
	ID                 int                 `json:"id"`
	AssignmentID       int                 `json:"assignment_id"`
	UserID             int                 `json:"user_id"`
	SubmittedAt        *time.Time          `json:"submitted_at"`
	Score              float64             `json:"score"`
	Grade              string              `json:"grade"`
	GraderID           int                 `json:"grader_id"`
	GradedAt           *time.Time          `json:"graded_at"`
	WorkflowState      string              `json:"workflow_state"`  // "submitted", "unsubmitted", "graded", etc.
	SubmissionType     string              `json:"submission_type"` // "online_text_entry", "online_upload", "media_recording", etc.
	Body               string              `json:"body"`            // For text submissions
	URL                string              `json:"url"`             // For URL submissions
	PreviewURL         string              `json:"preview_url"`     // Preview URL
	HTMLURL            string              `json:"html_url"`        // HTML URL to view submission
	Attachments        []Attachment        `json:"attachments"`
	MediaComment       *MediaComment       `json:"media_comment"` // For audio/video recordings
	Attempt            int                 `json:"attempt"`
	Late               bool                `json:"late"`
	Missing            bool                `json:"missing"`
	SubmissionComments []SubmissionComment `json:"submission_comments"`
	User               *User               `json:"user"`
}

// Attachment represents a file attachment
type Attachment struct {
	ID          int    `json:"id"`
	Filename    string `json:"filename"`
	DisplayName string `json:"display_name"`
	ContentType string `json:"content-type"`
	URL         string `json:"url"`
	Size        int64  `json:"size"`
	PreviewURL  string `json:"preview_url"`
}

// MediaComment represents an audio/video recording submission
type MediaComment struct {
	ContentType string `json:"content-type"`
	DisplayName string `json:"display_name"`
	MediaID     string `json:"media_id"`
	MediaType   string `json:"media_type"` // "audio" or "video"
	URL         string `json:"url"`
}

// SubmissionComment represents a comment on a submission
type SubmissionComment struct {
	ID        int        `json:"id"`
	AuthorID  int        `json:"author_id"`
	Comment   string     `json:"comment"`
	CreatedAt *time.Time `json:"created_at"`
}

// CourseWithStats extends Course with additional statistics
type CourseWithStats struct {
	Course
	UngradedCount int `json:"ungraded_count"`
}

// AssignmentWithStats extends Assignment with ungraded count
type AssignmentWithStats struct {
	Assignment
	UngradedCount int `json:"ungraded_count"`
}
