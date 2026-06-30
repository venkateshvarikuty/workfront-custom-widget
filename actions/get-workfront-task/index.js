/*
 * App Builder Runtime Action: get-workfront-task
 *
 * Server-side proxy that fetches Workfront task data on behalf of the browser UI.
 *
 * Flow:
 *   1. Calls the Workfront Fusion webhook to obtain a sessionID.
 *   2. Uses that sessionID to call the Workfront REST API for task data.
 *   3. Returns the task data JSON back to the browser UI.
 */

const { Core } = require('@adobe/aio-sdk');
const fetch = require('node-fetch');

const WORKFRONT_DOMAIN = 'origin-dluxtechapacptrsdwf.my.workfront.com';
const WORKFRONT_API_BASE_URL = `https://${WORKFRONT_DOMAIN}/attask/api/v21.0`;
const WORKFRONT_FUSION_HOOK_URL = 'https://hook.app.workfrontfusion.com/q3rzxctayhojj63oprhwd900ge1mfoeo';
const WORKFRONT_TASK_FIELDS = [
  'DE:Request type',
  'DE:Request title',
  'DE:Requested by',
  'DE:Target date',
  'DE:Request details',
  'DE:bookingId',
  'DE:channels',
  'DE:leadBrand',
  'DE:campaignStartDate',
  'DE:campaignEndDate',
];

// Session cache (shared across warm invocations in the same container)
let cachedSessionId = null;
let sessionExpiry = null;

// Response headers — CORS is handled automatically by I/O Runtime
// for web actions with `final: true`. Do NOT set Access-Control-Allow-Origin here.
const RESPONSE_HEADERS = {
  'Content-Type': 'application/json',
};

/**
 * Obtain a sessionID from the Workfront Fusion webhook.
 * Caches the result for 50 minutes to reduce outbound calls.
 */
async function getSessionId(logger) {
  if (cachedSessionId && sessionExpiry && Date.now() < sessionExpiry) {
    logger.info('Using cached sessionID');
    return cachedSessionId;
  }

  logger.info('Requesting new sessionID from Fusion webhook');

  const response = await fetch(WORKFRONT_FUSION_HOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(`Fusion webhook failed: ${response.status}`);
    throw new Error(`Failed to get sessionID: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  cachedSessionId = data.sessionID || data.sessionId || data.session_id;

  if (!cachedSessionId) {
    logger.error('No sessionID in Fusion response');
    throw new Error('No sessionID found in Workfront Fusion response');
  }

  sessionExpiry = Date.now() + 50 * 60 * 1000;
  logger.info('Obtained new sessionID');
  return cachedSessionId;
}

async function main(params) {
  const logger = Core.Logger('get-workfront-task', { level: 'info' });

  // Handle CORS preflight
  if (params.__ow_method && params.__ow_method.toLowerCase() === 'options') {
    return { statusCode: 204, headers: RESPONSE_HEADERS, body: '' };
  }

  try {
    const taskId = params.taskId || params.taskID || params.task_id;
    logger.info(`Action invoked, taskId=${taskId}`);

    if (!taskId) {
      return {
        statusCode: 400,
        headers: RESPONSE_HEADERS,
        body: { error: 'Task ID is required. Pass it as ?taskId=<id>.' },
      };
    }

    // Step 1 — Authenticate via Fusion webhook
    let sessionId;
    try {
      sessionId = await getSessionId(logger);
    } catch (error) {
      logger.error('Session error: ' + error.message);
      cachedSessionId = null;
      sessionExpiry = null;
      return {
        statusCode: 502,
        headers: RESPONSE_HEADERS,
        body: { error: 'Authentication failed: ' + error.message },
      };
    }

    const method = (params.__ow_method || 'get').toLowerCase();

    // Step 2 — Fetch or update task data from Workfront
    let response;
    if (method === 'put') {
      const updates = params.updates || {};
      logger.info(`Updating Workfront task ${taskId}`);

      const apiUrl = `${WORKFRONT_API_BASE_URL}/TASK/${encodeURIComponent(taskId)}`;
      response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          sessionID: sessionId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
    } else {
      const fieldsParam = WORKFRONT_TASK_FIELDS.join(',');
      const apiUrl = `${WORKFRONT_API_BASE_URL}/TASK/${encodeURIComponent(taskId)}?fields=${encodeURIComponent(fieldsParam)}`;

      logger.info('Calling Workfront API');
      response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          sessionID: sessionId,
          'Content-Type': 'application/json',
        },
      });
    }

    const responseText = await response.text();
    logger.info(`Workfront API responded with status ${response.status}`);

    let payload;
    try {
      payload = responseText ? JSON.parse(responseText) : {};
    } catch (e) {
      logger.error('Failed to parse Workfront response');
      return {
        statusCode: 502,
        headers: RESPONSE_HEADERS,
        body: { error: 'Invalid JSON from Workfront API' },
      };
    }

    if (!response.ok) {
      logger.error('Workfront API error: ' + response.status);
      if (response.status === 401 || response.status === 403) {
        cachedSessionId = null;
        sessionExpiry = null;
      }
      return {
        statusCode: response.status,
        headers: RESPONSE_HEADERS,
        body: { error: 'Workfront API error', details: payload },
      };
    }

    // Step 3 — Return task data
    logger.info(`Successfully processed ${method.toUpperCase()} for task ${taskId}`);
    return { statusCode: 200, headers: RESPONSE_HEADERS, body: payload };

  } catch (error) {
    logger.error('Unexpected error: ' + error.message);
    return {
      statusCode: 500,
      headers: RESPONSE_HEADERS,
      body: { error: 'Internal action error: ' + error.message },
    };
  }
}

exports.main = main;
