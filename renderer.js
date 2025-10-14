// Frontend logic for the Electron app

document.addEventListener('DOMContentLoaded', async () => {
  // Check if user is already logged in
  const credentials = await window.secureStorage.getCredentials();
  
  if (credentials && credentials.token && credentials.school) {
    // Already logged in, redirect to dashboard
    window.location.href = 'dashboard.html';
    return;
  }

  const connectBtn = document.getElementById('connect-btn');
  const tokenInput = document.getElementById('canvas-token');
  const schoolLinkInput = document.getElementById('school-link');

  // Button click handler
  connectBtn.addEventListener('click', async () => {
    const token = tokenInput.value.trim();
    const schoolLink = schoolLinkInput.value.trim();

    // Store credentials securely using OS keychain
    await window.secureStorage.saveCredentials(token, schoolLink);

    // Navigate to main app
    window.location.href = 'dashboard.html';
  });
});

