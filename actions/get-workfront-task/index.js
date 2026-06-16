/*
 * App Builder Runtime Action: get-workfront-task
 *
 * This action acts as a server-side proxy to avoid browser CORS restrictions.
 * Flow:
 *   1. Calls the Workfront Fusion webhook to obtain a sessionID.
 *   2. Uses that sessionID to call the Workfront REST API for task data.
 *   3. Returns the task data JSON back to the browser UI.
 */

const { Core } = require('@adobe/aio-sdk')
const fetch = require('node-fetch')

const WORKFRONT_DOMAIN = 'origin-dluxtechapacptrsdwf.my.workfront.com';
const WORKFRONT_API_BASE_URL = `https://${WORKFRONT_DOMAIN}/attask/api/v21.0`;
const WORKFRONT_FUSION_HOOK_URL = 'https://hook.app.workfrontfusion.com/q3rzxctayhojj63oprhwd900ge1mfoeo';
const WORKFRONT_TASK_FIELDS = [
  'DE:Request type',
  'DE:Request title',
  'DE:Requested by',
  'DE:Target date',
  'DE:Request details',
];

// In-memory cache for sessionID (shared across invocations in the same container)
let cachedSessionId = null;
let sessionExpiry = null;

// Standard CORS headers so the browser UI can read the response
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-ow-extra-logging',
};

/**
 * Get a sessionID from the Workfront Fusion webhook.
 * Caches the result for 50 minutes to reduce calls.
 */
async function getSessionId(logger) {
  if (cachedSessionId && sessionExpiry && Date.now() < sessionExpiry) {
    logger.info('Using cached sessionID');
    return cachedSessionId;
  }

  logger.info('Requesting new sessionID from Workfront Fusion hook');

  const response = await fetch(WORKFRONT_FUSION_HOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(`Fusion hook failed: ${response.status} - ${errorText}`);
    throw new Error(`Failed to get sessionID: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  logger.info('Fusion hook response keys: ' + Object.keys(data).join(', '));

  cachedSessionId = data.sessionID || data.sessionId || data.session_id;

  if (!cachedSessionId) {
    logger.error('No sessionID in response: ' + JSON.stringify(data));
    throw new Error('No sessionID found in Workfront Fusion response');
  }

  // Cache for 50 minutes
  sessionExpiry = Date.now() + 50 * 60 * 1000;

  logger.info('Obtained sessionID: ' + cachedSessionId.substring(0, 10) + '...');
  return cachedSessionId;
}

async function main(params) {
  const logger = Core.Logger('get-workfront-task', { level: 'info' });

  // Handle CORS preflight
  if (params.__ow_method && params.__ow_method.toLowerCase() === 'options') {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: '',
    };
  }

  try {
    // Extract taskId from query params (GET) or body (POST)
    const taskId = params.taskId || params.taskID || params.task_id;

    logger.info('Action invoked. taskId=' + taskId);

    if (!taskId) {
      return {
        statusCode: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: { error: 'Task ID is required. Pass it as ?taskId=<id> or in the POST body.' },
      };
    }

    // Step 1: Get sessionID from Workfront Fusion hook
    let sessionId;
    try {
      sessionId = await getSessionId(logger);
    } catch (error) {
      logger.error('Session error: ' + error.message);
      // Invalidate cache so next call retries
      cachedSessionId = null;
      sessionExpiry = null;
      return {
        statusCode: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: { error: 'Authentication failed: ' + error.message },
      };
    }

    // Step 2: Call Workfront API to get the task data
    const fieldsParam = WORKFRONT_TASK_FIELDS.join(',');
    const apiUrl = `${WORKFRONT_API_BASE_URL}/TASK/${encodeURIComponent(taskId)}?fields=${encodeURIComponent(fieldsParam)}`;

    logger.info('Calling Workfront API: ' + apiUrl);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'sessionID': sessionId,
        'Content-Type': 'application/json',
      },
    });

    const responseText = await response.text();
    logger.info('Workfront API status: ' + response.status);
    logger.info('Workfront API body (first 500 chars): ' + responseText.substring(0, 500));

    let payload;
    try {
      payload = responseText ? JSON.parse(responseText) : {};
    } catch (e) {
      logger.error('Failed to parse Workfront response: ' + e.message);
      return {
        statusCode: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: { error: 'Invalid JSON from Workfront API', raw: responseText.substring(0, 200) },
      };
    }

    if (!response.ok) {
      logger.error('Workfront API error: ' + JSON.stringify(payload));
      // If 401/403, invalidate the cached session so next call gets a fresh one
      if (response.status === 401 || response.status === 403) {
        cachedSessionId = null;
        sessionExpiry = null;
      }
      return {
        statusCode: response.status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: { error: 'Workfront API error', details: payload },
      };
    }

    // Step 3: Return the task data to the browser
    logger.info('Successfully fetched task: ' + taskId);
    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: payload,
    };

  } catch (error) {
    logger.error('Unexpected error: ' + error.message);
    logger.error('Stack: ' + error.stack);
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: { error: 'Internal action error: ' + error.message },
    };
  }
}

exports.main = main;
