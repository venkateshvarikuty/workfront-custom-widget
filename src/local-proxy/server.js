const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = 3001;

// Enable CORS for all requests
app.use(cors());

// Proxy endpoint for Workfront API
app.get('/api/workfront/task', async (req, res) => {
  try {
    const { taskId } = req.query;
    const fields = req.query.fields || 'DE:Request type,DE:Request title,DE:Requested by,DE:Target date,DE:Request details';
    
    if (!taskId) {
      return res.status(400).json({ error: 'Task ID is required' });
    }

    const workfrontUrl = `https://origin-dluxtechapacptrsdwf.my.workfront.com/attask/api/v21.0/TASK/${encodeURIComponent(taskId)}/search?fields=${encodeURIComponent(fields)}`;
    
    console.log(`[Proxy] Fetching Workfront task: ${taskId}`);
    console.log(`[Proxy] Workfront URL: ${workfrontUrl}`);

    const response = await fetch(workfrontUrl, {
      method: 'GET',
      headers: {
        'sessionID': '094fe1b2fdbc498eaaace42bfe6467c3',
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
});
