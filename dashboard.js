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
        <button class="assignment-action-btn" onclick="startGrading(${courseId}, ${assignment.id})">
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

// Start grading (placeholder)
function startGrading(courseId, assignmentId) {
  alert(`Start grading flow for assignment ${assignmentId} in course ${courseId}\n\nThis will load submissions for grading.\n(To be implemented)`);
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

