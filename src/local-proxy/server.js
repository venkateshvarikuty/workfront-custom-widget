const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

// Load .env file
const envPath = path.join(__dirname, '../../.env');
console.log('[Proxy] Loading .env from:', envPath);
require('dotenv').config({ path: envPath });

// Debug: Check if environment variables are loaded
console.log('[Proxy] WORKFRONT_DOMAIN:', process.env.WORKFRONT_DOMAIN || 'NOT SET');

const app = express();
const PORT = 3001;

// Enable CORS for all requests
app.use(cors());

// SessionID cache
let sessionId = null;
let sessionExpiry = null;

// Get sessionID from Workfront Fusion hook
async function getSessionId() {
  // Check if we have a valid cached sessionID
  if (sessionId && sessionExpiry && Date.now() < sessionExpiry) {
    console.log('[Session] Using cached sessionID');
    return sessionId;
  }

  console.log('[Session] Requesting new sessionID from Workfront Fusion hook');

  const fusionHookUrl = 'https://hook.app.workfrontfusion.com/q3rzxctayhojj63oprhwd900ge1mfoeo';
  
  const response = await fetch(fusionHookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Session] SessionID request failed:', errorText);
    throw new Error(`Failed to get sessionID: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  
  // Assuming the response contains a sessionID field
  // You may need to adjust this based on the actual response structure
  sessionId = data.sessionID || data.sessionId || data.session_id;
  
  if (!sessionId) {
    console.error('[Session] No sessionID found in response:', data);
    throw new Error('No sessionID found in Workfront Fusion response');
  }
  
  // Cache for 1 hour (adjust as needed)
  sessionExpiry = Date.now() + 3600000;
  
  console.log('[Session] Successfully obtained sessionID');
  return sessionId;
}

// Proxy endpoint for Workfront API
app.get('/api/workfront/task', async (req, res) => {
  try {
    const { taskId } = req.query;
    const fields = req.query.fields || 'DE:Request type,DE:Request title,DE:Requested by,DE:Target date,DE:Request details';
    
    if (!taskId) {
      return res.status(400).json({ error: 'Task ID is required' });
    }

    // Get sessionID from Workfront Fusion hook
    let currentSessionId;
    try {
      currentSessionId = await getSessionId();
    } catch (error) {
      console.error('[Proxy] Session error:', error);
      return res.status(500).json({ error: error.message });
    }

    const workfrontUrl = `https://${process.env.WORKFRONT_DOMAIN || 'origin-dluxtechapacptrsdwf.my.workfront.com'}/attask/api/v21.0/TASK/${encodeURIComponent(taskId)}/search?fields=${encodeURIComponent(fields)}`;
    
    console.log(`[Proxy] Fetching Workfront task: ${taskId}`);
    console.log(`[Proxy] Workfront URL: ${workfrontUrl}`);
    console.log(`[Proxy] Using sessionID: ${currentSessionId.substring(0, 10)}...`);

    const response = await fetch(workfrontUrl, {
      method: 'GET',
      headers: {
        'sessionID': currentSessionId,
        'Content-Type': 'application/json'
      }
    });

    const responseText = await response.text();
    console.log(`[Proxy] Workfront response status: ${response.status}`);

    let payload;
    try {
      payload = responseText ? JSON.parse(responseText) : {};
    } catch (e) {
      console.error('[Proxy] JSON parse error:', e);
      return res.status(response.status).json({ error: 'Invalid response from Workfront API' });
    }

    if (!response.ok) {
      console.error('[Proxy] Workfront API error:', payload);
      return res.status(response.status).json(payload);
    }

    console.log('[Proxy] Successfully fetched task');
    res.json(payload);
  } catch (error) {
    console.error('[Proxy] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`[Proxy] Local proxy server running on http://localhost:${PORT}`);
  console.log(`[Proxy] Proxying Workfront API requests to bypass CORS`);
  console.log(`[Proxy] Using sessionID authentication via Workfront Fusion hook`);
});
