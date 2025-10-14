// Dashboard logic for Auxa

let userCredentials = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Check if user is logged in
  userCredentials = await window.secureStorage.getCredentials();
  
  if (!userCredentials || !userCredentials.token || !userCredentials.school) {
    // Redirect back to login if no credentials
    window.location.href = 'index.html';
    return;
  }

  // Initialize navigation
  initNavigation();
  
  // Initialize settings
  initSettings();
  
  // Initialize rubrics
  initRubrics();
  
  // Initialize assignments view
  initAssignmentsView();
  
  // Initialize submissions view
  initSubmissionsView();
  
  // Load courses
  loadCourses();
});

// Navigation between views
function initNavigation() {
  const navButtons = document.querySelectorAll('.nav-btn');
  const views = document.querySelectorAll('.view');
  
  navButtons.forEach(button => {
    button.addEventListener('click', () => {
      const viewName = button.getAttribute('data-view');
      
      // Update active button
      navButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      
      // Update active view
      views.forEach(view => view.classList.remove('active'));
      document.getElementById(`${viewName}-view`).classList.add('active');
    });
  });
}

// Initialize settings view
function initSettings() {
  document.getElementById('settings-token').value = userCredentials.token ? '••••••••••••••••' : '';
  document.getElementById('settings-school').value = userCredentials.school || '';
  
  // Disconnect button
  document.querySelector('.disconnect-btn').addEventListener('click', async () => {
    if (confirm('Are you sure you want to disconnect from Canvas?')) {
      await window.secureStorage.deleteCredentials();
      window.location.href = 'index.html';
    }
  });
  
  // AI Platform settings
  initAISettings();
}

// Initialize AI platform settings
function initAISettings() {
  const platformSelect = document.getElementById('ai-platform-select');
  const apiKeySection = document.getElementById('api-key-section');
  const apiKeyInput = document.getElementById('ai-api-key');
  const systemPromptSection = document.getElementById('system-prompt-section');
  const systemPromptInput = document.getElementById('ai-system-prompt');
  const saveBtn = document.getElementById('save-ai-settings');
  
  // Load saved AI settings
  const savedPlatform = localStorage.getItem('aiPlatform');
  const savedApiKey = localStorage.getItem('aiApiKey');
  const savedSystemPrompt = localStorage.getItem('aiSystemPrompt');
  
  if (savedPlatform) {
    platformSelect.value = savedPlatform;
    apiKeySection.style.display = 'block';
    systemPromptSection.style.display = 'block';
    saveBtn.style.display = 'block';
    
    // Show platform info
    showPlatformInfo(savedPlatform);
    
    if (savedApiKey) {
      apiKeyInput.value = '••••••••••••••••';
      apiKeyInput.setAttribute('data-has-key', 'true');
    }
    
    if (savedSystemPrompt) {
      systemPromptInput.value = savedSystemPrompt;
    }
  }
  
  // Platform selection handler
  platformSelect.addEventListener('change', (e) => {
    const platform = e.target.value;
    
    if (platform) {
      apiKeySection.style.display = 'block';
      systemPromptSection.style.display = 'block';
      saveBtn.style.display = 'block';
      apiKeyInput.value = '';
      apiKeyInput.removeAttribute('data-has-key');
      
      // Show platform-specific warnings/info
      showPlatformInfo(platform);
    } else {
      apiKeySection.style.display = 'none';
      systemPromptSection.style.display = 'none';
      saveBtn.style.display = 'none';
      document.getElementById('platform-warning').style.display = 'none';
    }
  });
  
  // API key input - clear placeholder when typing
  apiKeyInput.addEventListener('focus', () => {
    if (apiKeyInput.getAttribute('data-has-key') === 'true') {
      apiKeyInput.value = '';
      apiKeyInput.removeAttribute('data-has-key');
    }
  });
  
  // Save AI settings
  saveBtn.addEventListener('click', async () => {
    const platform = platformSelect.value;
    const apiKey = apiKeyInput.value.trim();
    const systemPrompt = systemPromptInput.value.trim();
    
    if (!platform) {
      alert('Please select an LLM API platform');
      return;
    }
    
    // If no new key entered and we have an existing key, keep it
    if (!apiKey && apiKeyInput.getAttribute('data-has-key') === 'true') {
      alert('LLM API platform updated (API key unchanged)');
      localStorage.setItem('aiPlatform', platform);
      localStorage.setItem('aiSystemPrompt', systemPrompt);
      return;
    }
    
    if (!apiKey) {
      alert('Please enter your API key');
      return;
    }
    
    // Validate API key format based on platform
    if (!validateApiKey(platform, apiKey)) {
      alert('Invalid API key format for ' + getPlatformName(platform));
      return;
    }
    
    // Save to localStorage (in production, use secure storage like Canvas credentials)
    localStorage.setItem('aiPlatform', platform);
    localStorage.setItem('aiApiKey', apiKey);
    localStorage.setItem('aiSystemPrompt', systemPrompt);
    
    // Update UI
    apiKeyInput.value = '••••••••••••••••';
    apiKeyInput.setAttribute('data-has-key', 'true');
    
    alert('AI settings saved successfully!\n\nPlatform: ' + getPlatformName(platform) + 
          (systemPrompt ? '\nCustom system prompt saved' : '\nUsing default system prompt'));
  });
}

// Validate API key format
function validateApiKey(platform, key) {
  if (!key) return false;
  
  switch(platform) {
    case 'openai':
      return key.startsWith('sk-');
    case 'anthropic':
      return key.startsWith('sk-ant-');
    case 'google':
      return key.length > 20; // Basic validation for Google API keys
    default:
      return false;
  }
}

// Get platform display name
function getPlatformName(platform) {
  const names = {
    'openai': 'OpenAI',
    'anthropic': 'Anthropic (Claude)',
    'google': 'Google (Gemini)'
  };
  return names[platform] || platform;
}

// Show platform-specific information/warnings
function showPlatformInfo(platform) {
  const warningContainer = document.getElementById('platform-warning');
  const anthropicWarning = document.getElementById('anthropic-warning');
  const openaiInfo = document.getElementById('openai-info');
  const googleInfo = document.getElementById('google-info');
  
  // Hide all first
  anthropicWarning.style.display = 'none';
  openaiInfo.style.display = 'none';
  googleInfo.style.display = 'none';
  
  // Show appropriate one
  switch(platform) {
    case 'anthropic':
      warningContainer.style.display = 'block';
      anthropicWarning.style.display = 'block';
      break;
    case 'openai':
      warningContainer.style.display = 'block';
      openaiInfo.style.display = 'block';
      break;
    case 'google':
      warningContainer.style.display = 'block';
      googleInfo.style.display = 'block';
      break;
    default:
      warningContainer.style.display = 'none';
  }
}

// Load courses from Canvas API via backend
async function loadCourses() {
  const coursesList = document.getElementById('courses-list');
  
  try {
    const response = await fetch('http://localhost:3000/api/courses', {
      headers: {
        'Authorization': userCredentials.token,
        'X-School-URL': userCredentials.school
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch courses');
    }

    const courses = await response.json();
    
    // Clear loading message
    coursesList.innerHTML = '';
    
    if (courses.length === 0) {
      coursesList.innerHTML = `
        <div class="empty-message">
          <p>No TA courses found</p>
          <p style="font-size: 14px; color: #888;">You are not currently a TA for any courses</p>
        </div>
      `;
      return;
    }
    
    // Display courses
    for (const course of courses) {
      // Fetch ungraded count for each course
      const ungradedCount = await getUngradedCountForCourse(course.id);
      
      const courseData = {
        id: course.id,
        name: course.name,
        code: course.course_code,
        ungraded: ungradedCount,
        total: course.total_students || 0
      };
      
      const courseCard = createCourseCard(courseData);
      coursesList.appendChild(courseCard);
    }
  } catch (error) {
    console.error('Error loading courses:', error);
    coursesList.innerHTML = `
      <div class="empty-message">
        <p>Failed to load courses</p>
        <p style="font-size: 14px; color: #888;">Make sure the backend server is running on port 3000</p>
      </div>
    `;
  }
}

// Get ungraded submission count for a course
async function getUngradedCountForCourse(courseId) {
  try {
    // Get all assignments for the course
    const response = await fetch(`http://localhost:3000/api/courses/${courseId}/assignments`, {
      headers: {
        'Authorization': userCredentials.token,
        'X-School-URL': userCredentials.school
      }
    });

    if (!response.ok) {
      return 0;
    }

    const assignments = await response.json();
    let totalUngraded = 0;

    // Sum up needs_grading_count from all assignments
    for (const assignment of assignments) {
      totalUngraded += assignment.needs_grading_count || 0;
    }

    return totalUngraded;
  } catch (error) {
    console.error(`Error fetching ungraded count for course ${courseId}:`, error);
    return 0;
  }
}

// Create a course card element
function createCourseCard(course) {
  const card = document.createElement('div');
  card.className = 'course-card';
  card.onclick = () => openCourse(course);
  
  card.innerHTML = `
    <div class="course-name">${course.name}</div>
    <div class="course-code">${course.code}</div>
    <div class="course-stats">
      <div class="stat-item">
        <div class="stat-label">Ungraded</div>
        <div class="stat-value">${course.ungraded}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">Total Students</div>
        <div class="stat-value">${course.total}</div>
      </div>
    </div>
  `;
  
  return card;
}

// Open course details - show assignments with ungraded submissions
async function openCourse(course) {
  console.log('Opening course:', course);
  
  // Switch to assignments view
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('assignments-view').classList.add('active');
  
  // Update header
  document.getElementById('assignment-course-title').textContent = course.name;
  document.getElementById('assignment-course-subtitle').textContent = `${course.code} - Assignments with ungraded submissions`;
  
  // Load assignments
  await loadCourseAssignmentsView(course.id);
}

// Initialize assignments view
function initAssignmentsView() {
  const backBtn = document.getElementById('back-to-courses');
  
  backBtn.addEventListener('click', () => {
    // Switch back to courses view
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('courses-view').classList.add('active');
  });
}

// Initialize submissions view
function initSubmissionsView() {
  const backBtn = document.getElementById('back-to-assignments');
  
  backBtn.addEventListener('click', () => {
    // Switch back to assignments view
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('assignments-view').classList.add('active');
  });
}

// Load assignments for a course (only those with ungraded submissions)
async function loadCourseAssignmentsView(courseId) {
  const assignmentsList = document.getElementById('assignments-list');
  assignmentsList.innerHTML = '<div class="loading-message"><p>Loading assignments...</p></div>';
  
  try {
    // Fetch assignments
    const response = await fetch(`http://localhost:3000/api/courses/${courseId}/assignments`, {
      headers: {
        'Authorization': userCredentials.token,
        'X-School-URL': userCredentials.school
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch assignments');
    }
    
    const assignments = await response.json();
    
    // Filter assignments with ungraded submissions
    const ungradedAssignments = assignments.filter(a => a.needs_grading_count > 0);
    
    if (ungradedAssignments.length === 0) {
      assignmentsList.innerHTML = `
        <div class="empty-message">
          <p>No assignments with ungraded submissions</p>
          <p style="font-size: 14px; color: #888; margin-top: 8px;">All caught up! 🎉</p>
        </div>
      `;
      return;
    }
    
    // Display assignments
    assignmentsList.innerHTML = '';
    ungradedAssignments.forEach(assignment => {
      const assignmentCard = createAssignmentCard(assignment, courseId);
      assignmentsList.appendChild(assignmentCard);
    });
    
  } catch (error) {
    console.error('Error loading assignments:', error);
    assignmentsList.innerHTML = `
      <div class="empty-message">
        <p>Failed to load assignments</p>
        <p style="font-size: 14px; color: #888; margin-top: 8px;">Please try again</p>
      </div>
    `;
  }
}

// Create assignment card element
function createAssignmentCard(assignment, courseId) {
  const card = document.createElement('div');
  card.className = 'assignment-card';
  
  // Format due date
  let dueText = 'No due date';
  if (assignment.due_at) {
    const dueDate = new Date(assignment.due_at);
    const now = new Date();
    const isPast = dueDate < now;
    dueText = isPast ? 
      `Due: ${dueDate.toLocaleDateString()} (past due)` : 
      `Due: ${dueDate.toLocaleDateString()}`;
  }
  
  // Escape assignment name for onclick
  const escapedName = assignment.name.replace(/'/g, "\\'").replace(/"/g, '\\"');
  
  card.innerHTML = `
    <div class="assignment-header">
      <div class="assignment-info">
        <div class="assignment-name">${assignment.name}</div>
        <div class="assignment-meta">
          <div class="assignment-meta-item">
            <span>Points: ${assignment.points_possible || 0}</span>
          </div>
          <div class="assignment-meta-item">
            <span>Type: ${formatSubmissionType(assignment.submission_types)}</span>
          </div>
        </div>
      </div>
      <div class="assignment-badge ${assignment.needs_grading_count > 10 ? 'warning' : ''}">
        ${assignment.needs_grading_count}
      </div>
    </div>
    <div class="assignment-footer">
      <div class="assignment-due">${dueText}</div>
      <div class="assignment-actions">
        <button class="assignment-action-btn" onclick="startGrading(${courseId}, ${assignment.id}, '${escapedName}')">
          Start Grading
        </button>
      </div>
    </div>
  `;
  
  return card;
}

// Format submission types for display
function formatSubmissionType(types) {
  if (!types || types.length === 0) return 'Unknown';
  if (types.includes('online_text_entry')) return 'Text';
  if (types.includes('online_upload')) return 'File Upload';
  if (types.includes('online_url')) return 'URL';
  return types[0].replace('online_', '').replace('_', ' ');
}

// Start grading - load submissions for an assignment
async function startGrading(courseId, assignmentId, assignmentName) {
  console.log('Starting grading for assignment:', assignmentId, 'in course:', courseId);
  
  // Switch to submissions view
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('submissions-view').classList.add('active');
  
  // Update header
  document.getElementById('submissions-assignment-title').textContent = assignmentName || 'Assignment Submissions';
  document.getElementById('submissions-assignment-subtitle').textContent = 'Review and grade ungraded submissions';
  
  // Load submissions
  await loadSubmissionsView(courseId, assignmentId);
}

// Load submissions for an assignment
async function loadSubmissionsView(courseId, assignmentId) {
  const submissionsList = document.getElementById('submissions-list');
  submissionsList.innerHTML = '<div class="loading-message"><p>Loading submissions...</p></div>';
  
  try {
    // Fetch ungraded submissions
    const response = await fetch(`http://localhost:3000/api/courses/${courseId}/assignments/${assignmentId}/ungraded`, {
      headers: {
        'Authorization': userCredentials.token,
        'X-School-URL': userCredentials.school
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch submissions');
    }
    
    const submissions = await response.json();
    
    if (submissions.length === 0) {
      submissionsList.innerHTML = `
        <div class="empty-message">
          <p>No ungraded submissions</p>
          <p style="font-size: 14px; color: #888; margin-top: 8px;">All submissions have been graded! 🎉</p>
        </div>
      `;
      return;
    }
    
    // Display submissions
    submissionsList.innerHTML = '';
    submissions.forEach(submission => {
      const submissionCard = createSubmissionCard(submission, courseId, assignmentId);
      submissionsList.appendChild(submissionCard);
    });
    
  } catch (error) {
    console.error('Error loading submissions:', error);
    submissionsList.innerHTML = `
      <div class="empty-message">
        <p>Failed to load submissions</p>
        <p style="font-size: 14px; color: #888; margin-top: 8px;">Please try again</p>
      </div>
    `;
  }
}

// Create submission card element
function createSubmissionCard(submission, courseId, assignmentId) {
  const card = document.createElement('div');
  card.className = 'submission-card';
  
  // Format submission date
  let submittedText = 'Not submitted';
  if (submission.submitted_at) {
    const submittedDate = new Date(submission.submitted_at);
    submittedText = `Submitted: ${submittedDate.toLocaleString()}`;
  }
  
  // Get student info
  const studentName = submission.user ? submission.user.name : 'Unknown Student';
  const studentEmail = submission.user ? submission.user.email : '';
  
  // Determine submission content preview
  const contentPreview = getSubmissionContentPreview(submission);
  
  card.innerHTML = `
    <div class="submission-header">
      <div class="submission-student-info">
        <div class="submission-student-name">${studentName}</div>
        <div class="submission-student-email">${studentEmail}</div>
      </div>
      <div class="submission-meta">
        <span class="submission-status ${submission.late ? 'late' : ''}">${submission.late ? '⚠️ Late' : '✓ On Time'}</span>
        ${submission.attempt > 1 ? `<span class="submission-attempt">Attempt ${submission.attempt}</span>` : ''}
      </div>
    </div>
    <div class="submission-info">
      <div class="submission-date">${submittedText}</div>
      <div class="submission-type-badge">${formatSubmissionTypeBadge(submission.submission_type)}</div>
    </div>
    <div class="submission-content-preview">
      ${contentPreview}
    </div>
    <div class="submission-actions">
      <button class="submission-action-btn primary" onclick="gradeSubmission(${courseId}, ${assignmentId}, ${submission.id}, ${submission.user_id})">
        Grade Submission
      </button>
      <button class="submission-action-btn secondary" onclick="viewSubmissionDetails(${JSON.stringify(submission).replace(/"/g, '&quot;')})">
        View Details
      </button>
    </div>
  `;
  
  return card;
}

// Get submission content preview based on type
function getSubmissionContentPreview(submission) {
  switch (submission.submission_type) {
    case 'online_text_entry':
      // Show text preview
      const textPreview = submission.body ? 
        submission.body.replace(/<[^>]*>/g, '').substring(0, 200) + '...' : 
        'No content';
      return `
        <div class="content-preview-text">
          <strong>Text Submission:</strong><br>
          ${textPreview}
        </div>
      `;
      
    case 'online_upload':
      // Show file attachments
      if (submission.attachments && submission.attachments.length > 0) {
        const fileList = submission.attachments.map(file => 
          `<div class="attachment-item">📎 ${file.filename} (${formatFileSize(file.size)})</div>`
        ).join('');
        return `
          <div class="content-preview-files">
            <strong>Uploaded Files (${submission.attachments.length}):</strong><br>
            ${fileList}
          </div>
        `;
      }
      return '<div class="content-preview-text">No files attached</div>';
      
    case 'media_recording':
      // Show media recording info
      if (submission.media_comment) {
        const mediaType = submission.media_comment.media_type || 'media';
        return `
          <div class="content-preview-media">
            <strong>${mediaType === 'video' ? '🎥' : '🎵'} ${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} Recording</strong><br>
            ${submission.media_comment.display_name || 'Media file'}
          </div>
        `;
      }
      return '<div class="content-preview-text">Media recording</div>';
      
    case 'online_url':
      // Show URL
      return `
        <div class="content-preview-url">
          <strong>URL Submission:</strong><br>
          <a href="${submission.url}" target="_blank">${submission.url}</a>
        </div>
      `;
      
    default:
      return `<div class="content-preview-text">Submission type: ${submission.submission_type}</div>`;
  }
}

// Format submission type as badge
function formatSubmissionTypeBadge(type) {
  const typeMap = {
    'online_text_entry': '📝 Text Entry',
    'online_upload': '📁 File Upload',
    'media_recording': '🎥 Media Recording',
    'online_url': '🔗 URL Submission'
  };
  return typeMap[type] || type;
}

// Format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Grade submission - Open grading modal
let currentGradingContext = null;
let currentMonacoEditor = null;

async function gradeSubmission(courseId, assignmentId, submissionId, userId) {
  try {
    // Fetch full submission details
    const response = await fetch(`http://localhost:3000/api/courses/${courseId}/assignments/${assignmentId}/submissions`, {
      headers: {
        'Authorization': userCredentials.token,
        'X-School-URL': userCredentials.school
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch submission details');
    }
    
    const submissions = await response.json();
    const submission = submissions.find(s => s.id === submissionId);
    
    if (!submission) {
      alert('Submission not found');
      return;
    }
    
    // Fetch assignment details for rubric and points
    const assignmentResponse = await fetch(`http://localhost:3000/api/courses/${courseId}/assignments`, {
      headers: {
        'Authorization': userCredentials.token,
        'X-School-URL': userCredentials.school
      }
    });
    
    const assignments = await assignmentResponse.json();
    const assignment = assignments.find(a => a.id === assignmentId);
    
    // Store context
    currentGradingContext = {
      courseId,
      assignmentId,
      submissionId,
      userId,
      submission,
      assignment
    };
    
    // Open modal and load content
    await openGradingModal(submission, assignment);
    
  } catch (error) {
    console.error('Error loading submission for grading:', error);
    alert('Failed to load submission. Please try again.');
  }
}

// Open grading modal
async function openGradingModal(submission, assignment) {
  const modal = document.getElementById('grading-modal');
  
  // Set header info
  document.getElementById('grading-student-name').textContent = submission.user ? submission.user.name : 'Unknown Student';
  document.getElementById('grading-assignment-name').textContent = assignment ? assignment.name : 'Assignment';
  
  // Set max score
  document.getElementById('grading-max-score').value = assignment ? assignment.points_possible : 100;
  
  // Load rubric
  loadRubricForGrading(currentGradingContext.courseId, currentGradingContext.assignmentId);
  
  // Clear previous content
  document.getElementById('grading-preview-content').innerHTML = '<div class="loading-message"><p>Loading submission...</p></div>';
  document.getElementById('grading-file-list').innerHTML = '';
  document.getElementById('grading-feedback').value = '';
  document.getElementById('grading-score').value = '';
  
  // Show modal
  modal.style.display = 'flex';
  
  // Load submission content
  await loadSubmissionContent(submission);
}

// Close grading modal
function closeGradingModal() {
  const modal = document.getElementById('grading-modal');
  modal.style.display = 'none';
  
  // Clean up Monaco editor
  if (currentMonacoEditor) {
    currentMonacoEditor.dispose();
    currentMonacoEditor = null;
  }
  
  currentGradingContext = null;
}

// Load rubric for grading
function loadRubricForGrading(courseId, assignmentId) {
  const rubricDisplay = document.getElementById('grading-rubric-content');
  
  // Get rubrics from localStorage
  const rubrics = JSON.parse(localStorage.getItem('rubrics') || '[]');
  const rubric = rubrics.find(r => r.assignmentId === assignmentId);
  
  if (rubric) {
    if (rubric.type === 'text') {
      rubricDisplay.innerHTML = `<div style="white-space: pre-wrap;">${rubric.content}</div>`;
    } else {
      rubricDisplay.innerHTML = `<p>📄 ${rubric.fileName}</p><p style="font-size: 12px; color: #888; margin-top: 8px;">File-based rubric stored</p>`;
    }
  } else {
    rubricDisplay.innerHTML = '<p style="color: #888;">No rubric found for this assignment</p>';
  }
}

// Load submission content based on type
async function loadSubmissionContent(submission) {
  const contentArea = document.getElementById('grading-preview-content');
  const fileListArea = document.getElementById('grading-file-list');
  
  try {
    if (submission.submission_type === 'online_text_entry') {
      // Text submission
      fileListArea.innerHTML = '';
      contentArea.innerHTML = `
        <div class="preview-container">
          <div class="preview-text-content">${submission.body || 'No content'}</div>
        </div>
      `;
    } 
    else if (submission.submission_type === 'online_upload') {
      // File upload submission
      if (submission.attachments && submission.attachments.length > 0) {
        // Create file tabs
        fileListArea.innerHTML = submission.attachments.map((file, index) => 
          `<div class="grading-file-tab ${index === 0 ? 'active' : ''}" onclick="switchSubmissionFile(${index})">${file.filename}</div>`
        ).join('');
        
        // Load first file
        await renderSubmissionFile(submission.attachments[0], 0);
      } else {
        contentArea.innerHTML = '<div class="preview-container"><p>No files attached</p></div>';
      }
    }
    else if (submission.submission_type === 'media_recording') {
      // Media recording
      fileListArea.innerHTML = '';
      if (submission.media_comment) {
        const mediaType = submission.media_comment.media_type || 'video';
        const mediaUrl = submission.media_comment.url;
        contentArea.innerHTML = `
          <div class="preview-container">
            <div class="preview-media-content">
              ${mediaType === 'video' ? 
                `<video controls src="${mediaUrl}">Your browser does not support the video tag.</video>` :
                `<audio controls src="${mediaUrl}">Your browser does not support the audio tag.</audio>`
              }
            </div>
          </div>
        `;
      } else {
        contentArea.innerHTML = '<div class="preview-container"><p>Media file not available</p></div>';
      }
    }
    else if (submission.submission_type === 'online_url') {
      // URL submission
      fileListArea.innerHTML = '';
      contentArea.innerHTML = `
        <div class="preview-container">
          <h3>Submitted URL:</h3>
          <p><a href="${submission.url}" target="_blank">${submission.url}</a></p>
          <iframe src="${submission.url}" style="width: 100%; height: 600px; border: 1px solid #ddd; border-radius: 8px; margin-top: 16px;"></iframe>
        </div>
      `;
    }
    else {
      contentArea.innerHTML = `<div class="preview-container"><p>Unsupported submission type: ${submission.submission_type}</p></div>`;
    }
  } catch (error) {
    console.error('Error loading submission content:', error);
    contentArea.innerHTML = '<div class="preview-container"><p style="color: #f44336;">Error loading submission content</p></div>';
  }
}

// Switch between files in multi-file submission
async function switchSubmissionFile(index) {
  const submission = currentGradingContext.submission;
  const attachments = submission.attachments;
  
  if (!attachments || index >= attachments.length) return;
  
  // Update active tab
  const tabs = document.querySelectorAll('.grading-file-tab');
  tabs.forEach((tab, i) => {
    tab.classList.toggle('active', i === index);
  });
  
  // Load file
  await renderSubmissionFile(attachments[index], index);
}

// Render individual submission file based on extension
async function renderSubmissionFile(attachment, index) {
  const contentArea = document.getElementById('grading-preview-content');
  const filename = attachment.filename;
  const fileUrl = attachment.url;
  const extension = filename.split('.').pop().toLowerCase();
  
  contentArea.innerHTML = '<div class="loading-message"><p>Loading file...</p></div>';
  
  try {
    // Fetch file content
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error('Failed to fetch file');
    
    // Route to appropriate renderer based on file type
    if (extension === 'pdf') {
      await renderPDFFile(response, contentArea);
    } 
    else if (['xlsx', 'xls'].includes(extension)) {
      await renderExcelFile(response, contentArea);
    }
    else if (extension === 'csv') {
      await renderCSVFile(response, contentArea);
    }
    else if (extension === 'docx') {
      await renderDocxFile(response, contentArea);
    }
    else if (extension === 'md') {
      await renderMarkdownFile(response, contentArea);
    }
    else if (extension === 'json') {
      await renderJSONFile(response, contentArea);
    }
    else if (extension === 'txt' || extension === 'tex') {
      await renderTextFile(response, contentArea, extension === 'tex');
    }
    else if (extension === 'ipynb') {
      await renderJupyterFile(response, contentArea);
    }
    else if (isCodeFile(extension)) {
      await renderCodeFile(response, contentArea, extension);
    }
    else if (isImageFile(extension)) {
      await renderImageFile(fileUrl, contentArea);
    }
    else if (isMediaFile(extension)) {
      await renderMediaFile(fileUrl, contentArea, extension);
    }
    else if (extension === 'pptx') {
      renderPPTXPlaceholder(contentArea, filename);
    }
    else {
      renderUnsupportedFile(contentArea, filename, fileUrl);
    }
  } catch (error) {
    console.error('Error rendering file:', error);
    contentArea.innerHTML = `<div class="preview-container"><p style="color: #f44336;">Error loading file: ${error.message}</p></div>`;
  }
}

// Check if file is a code file
function isCodeFile(ext) {
  const codeExtensions = ['py', 'js', 'ts', 'jsx', 'tsx', 'go', 'c', 'cpp', 'h', 'hpp', 'java', 'cs', 'php', 'rb', 'rs', 'swift', 'kt', 'scala', 'r', 'sh', 'bash', 'sql', 'html', 'css', 'scss', 'sass', 'xml', 'yaml', 'yml'];
  return codeExtensions.includes(ext);
}

// Check if file is an image
function isImageFile(ext) {
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext);
}

// Check if file is media
function isMediaFile(ext) {
  return ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm', 'ogg', 'mov', 'avi'].includes(ext);
}

// Render PDF file
async function renderPDFFile(response, container) {
  const arrayBuffer = await response.arrayBuffer();
  const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  
  container.innerHTML = `
    <div class="preview-container">
      <div class="pdf-controls">
        <button class="pdf-nav-btn" onclick="changeGradingPDFPage(-1)">←</button>
        <span class="pdf-page-info" id="grading-pdf-page-info">Page 1 of 1</span>
        <button class="pdf-nav-btn" onclick="changeGradingPDFPage(1)">→</button>
      </div>
      <div class="pdf-container">
        <canvas id="grading-pdf-canvas" class="pdf-canvas"></canvas>
      </div>
    </div>
  `;
  
  // Load PDF with PDF.js
  const loadingTask = pdfjsLib.getDocument(url);
  const pdf = await loadingTask.promise;
  
  window.currentGradingPDF = {
    pdf: pdf,
    currentPage: 1,
    totalPages: pdf.numPages
  };
  
  document.getElementById('grading-pdf-page-info').textContent = `Page 1 of ${pdf.numPages}`;
  await renderGradingPDFPage(1);
}

// Render PDF page
async function renderGradingPDFPage(pageNumber) {
  const state = window.currentGradingPDF;
  if (!state) return;
  
  const page = await state.pdf.getPage(pageNumber);
  const canvas = document.getElementById('grading-pdf-canvas');
  if (!canvas) return;
  
  const context = canvas.getContext('2d');
  const container = canvas.parentElement;
  const containerWidth = container.clientWidth;
  const viewport = page.getViewport({ scale: 1 });
  const scale = Math.min((containerWidth - 40) / viewport.width, 2.0);
  const scaledViewport = page.getViewport({ scale: scale });
  const outputScale = window.devicePixelRatio || 1;
  
  canvas.width = Math.floor(scaledViewport.width * outputScale);
  canvas.height = Math.floor(scaledViewport.height * outputScale);
  canvas.style.width = Math.floor(scaledViewport.width) + 'px';
  canvas.style.height = Math.floor(scaledViewport.height) + 'px';
  
  const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;
  
  await page.render({
    canvasContext: context,
    viewport: scaledViewport,
    transform: transform
  }).promise;
}

// Change PDF page
async function changeGradingPDFPage(delta) {
  const state = window.currentGradingPDF;
  if (!state) return;
  
  const newPage = state.currentPage + delta;
  if (newPage < 1 || newPage > state.totalPages) return;
  
  state.currentPage = newPage;
  document.getElementById('grading-pdf-page-info').textContent = `Page ${newPage} of ${state.totalPages}`;
  await renderGradingPDFPage(newPage);
}

// Render Excel file
async function renderExcelFile(response, container) {
  const arrayBuffer = await response.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const htmlTable = XLSX.utils.sheet_to_html(worksheet);
  
  container.innerHTML = `
    <div class="preview-container">
      <div class="preview-spreadsheet-content">
        <h3 style="margin-bottom: 12px;">Sheet: ${sheetName}</h3>
        ${htmlTable}
      </div>
    </div>
  `;
}

// Render CSV file
async function renderCSVFile(response, container) {
  const text = await response.text();
  const workbook = XLSX.read(text, { type: 'string' });
  
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const htmlTable = XLSX.utils.sheet_to_html(worksheet);
  
  container.innerHTML = `
    <div class="preview-container">
      <div class="preview-spreadsheet-content">
        ${htmlTable}
      </div>
    </div>
  `;
}

// Render DOCX file
async function renderDocxFile(response, container) {
  const arrayBuffer = await response.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
  
  container.innerHTML = `
    <div class="preview-container">
      <div class="preview-markdown-content">
        ${result.value}
      </div>
    </div>
  `;
}

// Render Markdown file
async function renderMarkdownFile(response, container) {
  const text = await response.text();
  const html = marked.parse(text);
  
  container.innerHTML = `
    <div class="preview-container">
      <div class="preview-markdown-content">
        ${html}
      </div>
    </div>
  `;
}

// Render JSON file
async function renderJSONFile(response, container) {
  const text = await response.text();
  const json = JSON.parse(text);
  const formatted = JSON.stringify(json, null, 2);
  
  container.innerHTML = `
    <div class="preview-container">
      <div id="monaco-editor-container"></div>
    </div>
  `;
  
  setTimeout(() => {
    initMonacoEditor(formatted, 'json');
  }, 100);
}

// Render text file
async function renderTextFile(response, container, isLatex = false) {
  const text = await response.text();
  
  container.innerHTML = `
    <div class="preview-container">
      <div class="preview-text-content">${text}</div>
    </div>
  `;
}

// Render Jupyter Notebook
async function renderJupyterFile(response, container) {
  const text = await response.text();
  const notebook = JSON.parse(text);
  
  let html = '<div class="preview-container"><div class="preview-markdown-content">';
  
  notebook.cells.forEach((cell, index) => {
    html += `<div style="margin-bottom: 24px; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px;">`;
    html += `<div style="font-size: 12px; color: #888; margin-bottom: 8px;">Cell ${index + 1} [${cell.cell_type}]</div>`;
    
    if (cell.cell_type === 'markdown') {
      const markdownContent = Array.isArray(cell.source) ? cell.source.join('') : cell.source;
      html += marked.parse(markdownContent);
    } else if (cell.cell_type === 'code') {
      const codeContent = Array.isArray(cell.source) ? cell.source.join('') : cell.source;
      html += `<pre style="background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto;"><code>${escapeHtml(codeContent)}</code></pre>`;
      
      if (cell.outputs && cell.outputs.length > 0) {
        html += '<div style="margin-top: 12px; padding: 12px; background: #fafafa; border-left: 3px solid #4CAF50; border-radius: 4px;">';
        html += '<div style="font-size: 11px; color: #666; margin-bottom: 8px;">Output:</div>';
        cell.outputs.forEach(output => {
          if (output.text) {
            const outputText = Array.isArray(output.text) ? output.text.join('') : output.text;
            html += `<pre style="margin: 0; white-space: pre-wrap;">${escapeHtml(outputText)}</pre>`;
          }
        });
        html += '</div>';
      }
    }
    html += '</div>';
  });
  
  html += '</div></div>';
  container.innerHTML = html;
}

// Render code file with Monaco Editor
async function renderCodeFile(response, container, extension) {
  const text = await response.text();
  
  container.innerHTML = `
    <div class="preview-container">
      <div id="monaco-editor-container"></div>
    </div>
  `;
  
  setTimeout(() => {
    initMonacoEditor(text, getMonacoLanguage(extension));
  }, 100);
}

// Initialize Monaco Editor
function initMonacoEditor(content, language) {
  // Clean up previous editor
  if (currentMonacoEditor) {
    currentMonacoEditor.dispose();
    currentMonacoEditor = null;
  }
  
  require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' } });
  require(['vs/editor/editor.main'], function() {
    const container = document.getElementById('monaco-editor-container');
    if (!container) return;
    
    currentMonacoEditor = monaco.editor.create(container, {
      value: content,
      language: language,
      theme: 'vs',
      readOnly: true,
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      fontSize: 14,
      lineNumbers: 'on',
      renderWhitespace: 'selection',
      wordWrap: 'on'
    });
  });
}

// Get Monaco language from file extension
function getMonacoLanguage(ext) {
  const languageMap = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'py': 'python',
    'go': 'go',
    'c': 'c',
    'cpp': 'cpp',
    'h': 'c',
    'hpp': 'cpp',
    'java': 'java',
    'cs': 'csharp',
    'php': 'php',
    'rb': 'ruby',
    'rs': 'rust',
    'swift': 'swift',
    'kt': 'kotlin',
    'scala': 'scala',
    'r': 'r',
    'sh': 'shell',
    'bash': 'shell',
    'sql': 'sql',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'sass': 'sass',
    'xml': 'xml',
    'yaml': 'yaml',
    'yml': 'yaml',
    'json': 'json'
  };
  return languageMap[ext] || 'plaintext';
}

// Render image file
async function renderImageFile(url, container) {
  container.innerHTML = `
    <div class="preview-container">
      <div class="preview-image-content">
        <img src="${url}" alt="Submitted image" />
      </div>
    </div>
  `;
}

// Render media file
async function renderMediaFile(url, container, extension) {
  const isVideo = ['mp4', 'webm', 'mov', 'avi', 'mpeg'].includes(extension);
  
  container.innerHTML = `
    <div class="preview-container">
      <div class="preview-media-content">
        ${isVideo ? 
          `<video controls src="${url}" style="max-width: 100%; max-height: 600px;">Your browser does not support the video tag.</video>` :
          `<audio controls src="${url}" style="width: 100%;">Your browser does not support the audio tag.</audio>`
        }
      </div>
    </div>
  `;
}

// Render PPTX placeholder
function renderPPTXPlaceholder(container, filename) {
  container.innerHTML = `
    <div class="preview-container">
      <div style="text-align: center; padding: 60px 20px;">
        <div style="font-size: 64px; margin-bottom: 20px;">📊</div>
        <h3>${filename}</h3>
        <p style="color: #888; margin-top: 12px;">PowerPoint preview not available</p>
        <p style="color: #888; font-size: 14px; margin-top: 8px;">File will be sent to AI for analysis</p>
      </div>
    </div>
  `;
}

// Render unsupported file
function renderUnsupportedFile(container, filename, url) {
  container.innerHTML = `
    <div class="preview-container">
      <div style="text-align: center; padding: 60px 20px;">
        <div style="font-size: 64px; margin-bottom: 20px;">📄</div>
        <h3>${filename}</h3>
        <p style="color: #888; margin-top: 12px;">Preview not available for this file type</p>
        <a href="${url}" download style="display: inline-block; margin-top: 20px; padding: 12px 24px; background: #000; color: white; text-decoration: none; border-radius: 8px;">Download File</a>
      </div>
    </div>
  `;
}

// Helper: Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Submit grade (placeholder)
function submitGrade() {
  const score = document.getElementById('grading-score').value;
  const feedback = document.getElementById('grading-feedback').value;
  
  if (!score) {
    alert('Please enter a score');
    return;
  }
  
  alert(`Grade submission:\nScore: ${score}\nFeedback: ${feedback.substring(0, 100)}...\n\n(Grade submission to Canvas API to be implemented)`);
  
  closeGradingModal();
}

// View submission details (placeholder for now)
function viewSubmissionDetails(submission) {
  alert(`View details for submission\n\nStudent: ${submission.user ? submission.user.name : 'Unknown'}\nType: ${submission.submission_type}\n\n(Detailed view to be implemented)`);
}

// Get system prompt for AI grading
function getSystemPrompt() {
  return localStorage.getItem('aiSystemPrompt') || '';
}

// Get AI configuration
function getAIConfig() {
  return {
    platform: localStorage.getItem('aiPlatform') || null,
    apiKey: localStorage.getItem('aiApiKey') || null,
    systemPrompt: localStorage.getItem('aiSystemPrompt') || ''
  };
}

// ========== RUBRICS FUNCTIONALITY ==========

let allCourses = [];
let courseAssignments = [];
let selectedAssignment = null;
let editingRubricId = null;

// Initialize rubrics view
function initRubrics() {
  const createBtn = document.getElementById('create-rubric-btn');
  const cancelBtn = document.getElementById('cancel-rubric-btn');
  const saveBtn = document.getElementById('save-rubric-btn');
  const courseSelect = document.getElementById('course-select');
  const assignmentSelect = document.getElementById('assignment-select');
  const typeButtons = document.querySelectorAll('.type-btn');
  
  // Create button
  createBtn.addEventListener('click', () => {
    showRubricForm();
    loadTACourses();
  });
  
  // Cancel button
  cancelBtn.addEventListener('click', () => {
    hideRubricForm();
  });
  
  // Save button
  saveBtn.addEventListener('click', () => {
    saveRubric();
  });
  
  // Course selection
  courseSelect.addEventListener('change', (e) => {
    handleCourseSelection(e.target.value);
  });
  
  // Assignment selection
  assignmentSelect.addEventListener('change', (e) => {
    handleAssignmentSelection(e.target.value);
  });
  
  // Rubric type toggle
  typeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      typeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const type = btn.getAttribute('data-type');
      toggleRubricType(type);
    });
  });
  
  // Load saved rubrics
  loadSavedRubrics();
}

// Show rubric form
function showRubricForm(rubric = null) {
  editingRubricId = rubric ? rubric.id : null;
  
  document.getElementById('rubric-form').style.display = 'block';
  document.getElementById('assignment-group').style.display = 'none';
  document.getElementById('assignment-details').style.display = 'none';
  document.getElementById('create-rubric-btn').style.display = 'none';
  
  // Update title
  document.getElementById('form-title').textContent = rubric ? 'Edit Rubric' : 'Create New Rubric';
  
  // If editing, populate form
  if (rubric) {
    populateFormForEdit(rubric);
  }
}

// Hide rubric form
function hideRubricForm() {
  document.getElementById('rubric-form').style.display = 'none';
  document.getElementById('assignment-group').style.display = 'none';
  document.getElementById('assignment-details').style.display = 'none';
  document.getElementById('create-rubric-btn').style.display = 'block';
  
  // Reset form
  editingRubricId = null;
  document.getElementById('course-select').value = '';
  document.getElementById('assignment-select').value = '';
  document.getElementById('points-input').value = '';
  document.getElementById('rubric-text').value = '';
  document.getElementById('rubric-file').value = '';
  
  // Reset rubric type to text
  document.querySelectorAll('.type-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector('.type-btn[data-type="text"]').classList.add('active');
  document.getElementById('text-rubric').style.display = 'block';
  document.getElementById('file-rubric').style.display = 'none';
}

// Load TA courses into dropdown
async function loadTACourses() {
  const courseSelect = document.getElementById('course-select');
  courseSelect.innerHTML = '<option value="">Loading courses...</option>';
  
  try {
    const response = await fetch('http://localhost:3000/api/courses', {
      headers: {
        'Authorization': userCredentials.token,
        'X-School-URL': userCredentials.school
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch courses');
    }
    
    allCourses = await response.json();
    
    // Populate dropdown
    courseSelect.innerHTML = '<option value="">Select a course...</option>';
    allCourses.forEach((course, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = course.name;
      courseSelect.appendChild(option);
    });
    
  } catch (error) {
    console.error('Error loading courses:', error);
    courseSelect.innerHTML = '<option value="">Error loading courses</option>';
  }
}

// Handle course selection
async function handleCourseSelection(index) {
  if (index === '') {
    document.getElementById('assignment-group').style.display = 'none';
    document.getElementById('assignment-details').style.display = 'none';
    return;
  }
  
  const selectedCourse = allCourses[parseInt(index)];
  
  // Show assignment dropdown and load assignments
  document.getElementById('assignment-group').style.display = 'block';
  await loadCourseAssignments(selectedCourse.id, selectedCourse.name);
}

// Load assignments for selected course
async function loadCourseAssignments(courseId, courseName) {
  const assignmentSelect = document.getElementById('assignment-select');
  assignmentSelect.innerHTML = '<option value="">Loading assignments...</option>';
  
  try {
    const response = await fetch(`http://localhost:3000/api/courses/${courseId}/assignments`, {
      headers: {
        'Authorization': userCredentials.token,
        'X-School-URL': userCredentials.school
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch assignments');
    }
    
    courseAssignments = await response.json();
    
    // Populate dropdown
    assignmentSelect.innerHTML = '<option value="">Select an assignment...</option>';
    courseAssignments.forEach((assignment, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = assignment.name;
      assignmentSelect.appendChild(option);
    });
    
    // Store course name in assignments for later use
    courseAssignments.forEach(assignment => {
      assignment.courseName = courseName;
    });
    
  } catch (error) {
    console.error('Error loading assignments:', error);
    assignmentSelect.innerHTML = '<option value="">Error loading assignments</option>';
  }
}

// Handle assignment selection
function handleAssignmentSelection(index) {
  if (index === '') {
    document.getElementById('assignment-details').style.display = 'none';
    return;
  }
  
  selectedAssignment = courseAssignments[parseInt(index)];
  
  // Show assignment details
  document.getElementById('assignment-details').style.display = 'block';
  
  // Auto-populate points
  document.getElementById('points-input').value = selectedAssignment.points_possible || 100;
}

// Populate form for editing
async function populateFormForEdit(rubric) {
  // Load courses first
  await loadTACourses();
  
  // Find and select the course
  const courseIndex = allCourses.findIndex(c => c.name === rubric.courseName);
  if (courseIndex !== -1) {
    document.getElementById('course-select').value = courseIndex;
    
    // Load assignments for this course
    await handleCourseSelection(courseIndex.toString());
    
    // Find and select the assignment
    const assignmentIndex = courseAssignments.findIndex(a => a.id === rubric.assignmentId);
    if (assignmentIndex !== -1) {
      document.getElementById('assignment-select').value = assignmentIndex;
      handleAssignmentSelection(assignmentIndex.toString());
    }
  }
  
  // Set points
  document.getElementById('points-input').value = rubric.points;
  
  // Set rubric type and content
  document.querySelectorAll('.type-btn').forEach(btn => btn.classList.remove('active'));
  
  if (rubric.type === 'text') {
    document.querySelector('.type-btn[data-type="text"]').classList.add('active');
    document.getElementById('text-rubric').style.display = 'block';
    document.getElementById('file-rubric').style.display = 'none';
    document.getElementById('rubric-text').value = rubric.content;
  } else {
    document.querySelector('.type-btn[data-type="file"]').classList.add('active');
    document.getElementById('text-rubric').style.display = 'none';
    document.getElementById('file-rubric').style.display = 'block';
    // Note: Can't pre-populate file input for security reasons
  }
}

// Toggle rubric type (text/file)
function toggleRubricType(type) {
  const textRubric = document.getElementById('text-rubric');
  const fileRubric = document.getElementById('file-rubric');
  
  if (type === 'text') {
    textRubric.style.display = 'block';
    fileRubric.style.display = 'none';
  } else {
    textRubric.style.display = 'none';
    fileRubric.style.display = 'block';
  }
}

// Save rubric
async function saveRubric() {
  if (!selectedAssignment) {
    alert('Please select an assignment');
    return;
  }
  
  const points = document.getElementById('points-input').value;
  const rubricType = document.querySelector('.type-btn.active').getAttribute('data-type');
  
  let rubricContent = null;
  let rubricFileName = null;
  
  if (rubricType === 'text') {
    rubricContent = document.getElementById('rubric-text').value.trim();
    if (!rubricContent) {
      alert('Please enter rubric content');
      return;
    }
  } else {
    const fileInput = document.getElementById('rubric-file');
    
    // If editing and no new file selected, keep existing file
    if (editingRubricId && (!fileInput.files || fileInput.files.length === 0)) {
      const rubrics = JSON.parse(localStorage.getItem('rubrics') || '[]');
      const existingRubric = rubrics.find(r => r.id === editingRubricId);
      if (existingRubric) {
        rubricContent = existingRubric.content;
        rubricFileName = existingRubric.fileName;
      }
    } else if (fileInput.files && fileInput.files.length > 0) {
      rubricFileName = fileInput.files[0].name;
      // Read file content
      const file = fileInput.files[0];
      const reader = new FileReader();
      
      await new Promise((resolve, reject) => {
        reader.onload = (e) => {
          rubricContent = e.target.result;
          resolve();
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    } else {
      alert('Please upload a rubric file');
      return;
    }
  }
  
  // Get rubrics from localStorage
  const rubrics = JSON.parse(localStorage.getItem('rubrics') || '[]');
  
  if (editingRubricId) {
    // Update existing rubric
    const index = rubrics.findIndex(r => r.id === editingRubricId);
    if (index !== -1) {
      rubrics[index] = {
        ...rubrics[index],
        assignmentId: selectedAssignment.id,
        assignmentName: selectedAssignment.name,
        courseName: selectedAssignment.courseName,
        points: parseFloat(points),
        type: rubricType,
        content: rubricContent,
        fileName: rubricFileName,
        updatedAt: new Date().toISOString()
      };
    }
  } else {
    // Create new rubric
    const rubric = {
      id: Date.now(),
      assignmentId: selectedAssignment.id,
      assignmentName: selectedAssignment.name,
      courseName: selectedAssignment.courseName,
      points: parseFloat(points),
      type: rubricType,
      content: rubricContent,
      fileName: rubricFileName,
      createdAt: new Date().toISOString()
    };
    rubrics.push(rubric);
  }
  
  // Save to localStorage
  localStorage.setItem('rubrics', JSON.stringify(rubrics));
  
  // Hide form and refresh list
  hideRubricForm();
  loadSavedRubrics();
  
  alert(editingRubricId ? 'Rubric updated successfully!' : 'Rubric saved successfully!');
}

// Load and display saved rubrics
function loadSavedRubrics() {
  const rubricsList = document.getElementById('rubrics-list');
  const rubrics = JSON.parse(localStorage.getItem('rubrics') || '[]');
  
  if (rubrics.length === 0) {
    rubricsList.innerHTML = '<p style="color: #666; text-align: center; padding: 40px;">No rubrics created yet</p>';
    return;
  }
  
  rubricsList.innerHTML = '';
  rubrics.forEach(rubric => {
    const rubricItem = document.createElement('div');
    rubricItem.className = 'rubric-item';
    rubricItem.innerHTML = `
      <div class="rubric-header">
        <div>
          <div class="rubric-assignment">${rubric.assignmentName}</div>
          <div style="font-size: 14px; color: #888; margin-top: 4px;">${rubric.courseName}</div>
        </div>
        <div style="text-align: right;">
          <div class="rubric-points">${rubric.points} points</div>
          <div class="rubric-type">${rubric.type === 'text' ? 'Text' : 'File: ' + rubric.fileName}</div>
        </div>
      </div>
      <div class="rubric-content-container">
        ${renderRubricContent(rubric)}
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px;">
        <div style="font-size: 12px; color: #aaa;">
          Created: ${new Date(rubric.createdAt).toLocaleString()}
          ${rubric.updatedAt ? `<br>Updated: ${new Date(rubric.updatedAt).toLocaleString()}` : ''}
        </div>
        <div class="rubric-actions">
          <button class="rubric-action-btn edit-btn" onclick="editRubric(${rubric.id})">Edit</button>
          <button class="rubric-action-btn delete-btn" onclick="deleteRubric(${rubric.id})">Delete</button>
        </div>
      </div>
    `;
    rubricsList.appendChild(rubricItem);
    
    // If it's a PDF file, render it after DOM insertion
    if (rubric.type === 'file' && rubric.fileName && rubric.fileName.toLowerCase().endsWith('.pdf')) {
      renderPDF(rubric.id, rubric.content);
    }
  });
}

// Render rubric content based on type
function renderRubricContent(rubric) {
  if (rubric.type === 'text') {
    // Display text content
    return `
      <div class="rubric-text-content">
        ${rubric.content.replace(/\n/g, '<br>')}
      </div>
    `;
  } else {
    // Display file viewer
    const isPDF = rubric.fileName && rubric.fileName.toLowerCase().endsWith('.pdf');
    const isDOCX = rubric.fileName && (rubric.fileName.toLowerCase().endsWith('.docx') || rubric.fileName.toLowerCase().endsWith('.doc'));
    
    if (isPDF) {
      return `
        <div class="rubric-file-viewer">
          <div class="pdf-controls">
            <button class="pdf-nav-btn" onclick="changePDFPage(${rubric.id}, -1)">←</button>
            <span class="pdf-page-info" id="page-info-${rubric.id}">Page 1 of 1</span>
            <button class="pdf-nav-btn" onclick="changePDFPage(${rubric.id}, 1)">→</button>
          </div>
          <div class="pdf-container">
            <canvas id="pdf-canvas-${rubric.id}" class="pdf-canvas"></canvas>
          </div>
        </div>
      `;
    } else if (isDOCX) {
      return `
        <div class="rubric-file-viewer">
          <div class="file-preview-notice">
            <p>📄 ${rubric.fileName}</p>
            <p style="font-size: 12px; color: #888; margin-top: 8px;">DOCX preview not available - file stored</p>
          </div>
        </div>
      `;
    } else {
      return `
        <div class="rubric-file-viewer">
          <div class="file-preview-notice">
            <p>📄 ${rubric.fileName}</p>
            <p style="font-size: 12px; color: #888; margin-top: 8px;">File stored successfully</p>
          </div>
        </div>
      `;
    }
  }
}

// PDF rendering state
const pdfStates = {};

// Render PDF using PDF.js
async function renderPDF(rubricId, dataUrl) {
  try {
    // Load PDF
    const loadingTask = pdfjsLib.getDocument(dataUrl);
    const pdf = await loadingTask.promise;
    
    // Store PDF state
    pdfStates[rubricId] = {
      pdf: pdf,
      currentPage: 1,
      totalPages: pdf.numPages
    };
    
    // Update page info
    document.getElementById(`page-info-${rubricId}`).textContent = `Page 1 of ${pdf.numPages}`;
    
    // Render first page
    await renderPDFPage(rubricId, 1);
  } catch (error) {
    console.error('Error loading PDF:', error);
    const canvas = document.getElementById(`pdf-canvas-${rubricId}`);
    if (canvas) {
      canvas.parentElement.innerHTML = '<p style="color: #f44336; text-align: center; padding: 20px;">Error loading PDF</p>';
    }
  }
}

// Render a specific page of a PDF
async function renderPDFPage(rubricId, pageNumber) {
  const state = pdfStates[rubricId];
  if (!state) return;
  
  const page = await state.pdf.getPage(pageNumber);
  const canvas = document.getElementById(`pdf-canvas-${rubricId}`);
  if (!canvas) return;
  
  const context = canvas.getContext('2d');
  
  // Calculate scale to fit container nicely
  const container = canvas.parentElement;
  const containerWidth = container.clientWidth;
  const viewport = page.getViewport({ scale: 1 });
  const scale = Math.min((containerWidth - 40) / viewport.width, 2.0); // Max scale of 2.0, 20px margin on each side
  
  const scaledViewport = page.getViewport({ scale: scale });
  
  // Account for device pixel ratio for high-DPI displays (Retina, etc.)
  const outputScale = window.devicePixelRatio || 1;
  
  // Set canvas size accounting for pixel ratio
  canvas.width = Math.floor(scaledViewport.width * outputScale);
  canvas.height = Math.floor(scaledViewport.height * outputScale);
  
  // Set display size (CSS pixels)
  canvas.style.width = Math.floor(scaledViewport.width) + 'px';
  canvas.style.height = Math.floor(scaledViewport.height) + 'px';
  
  // Scale the context to account for the pixel ratio
  const transform = outputScale !== 1 
    ? [outputScale, 0, 0, outputScale, 0, 0] 
    : null;
  
  const renderContext = {
    canvasContext: context,
    viewport: scaledViewport,
    transform: transform
  };
  
  await page.render(renderContext).promise;
}

// Change PDF page
async function changePDFPage(rubricId, delta) {
  const state = pdfStates[rubricId];
  if (!state) return;
  
  const newPage = state.currentPage + delta;
  
  // Check bounds
  if (newPage < 1 || newPage > state.totalPages) {
    return;
  }
  
  state.currentPage = newPage;
  
  // Update page info
  document.getElementById(`page-info-${rubricId}`).textContent = `Page ${newPage} of ${state.totalPages}`;
  
  // Render new page
  await renderPDFPage(rubricId, newPage);
}

// Edit rubric
function editRubric(rubricId) {
  const rubrics = JSON.parse(localStorage.getItem('rubrics') || '[]');
  const rubric = rubrics.find(r => r.id === rubricId);
  
  if (rubric) {
    showRubricForm(rubric);
  }
}

// Delete rubric
function deleteRubric(rubricId) {
  if (!confirm('Are you sure you want to delete this rubric?')) {
    return;
  }
  
  const rubrics = JSON.parse(localStorage.getItem('rubrics') || '[]');
  const filteredRubrics = rubrics.filter(r => r.id !== rubricId);
  
  localStorage.setItem('rubrics', JSON.stringify(filteredRubrics));
  loadSavedRubrics();
  
  alert('Rubric deleted successfully!');
}

