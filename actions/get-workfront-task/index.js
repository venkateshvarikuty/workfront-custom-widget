/*
* <license header>
*/

const { Core } = require('@adobe/aio-sdk')
const fetch = require('node-fetch')

const WORKFRONT_API_BASE_URL = 'https://origin-dluxtechapacptrsdwf.my.workfront.com/attask/api/v21.0';
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

// Get sessionID from Workfront Fusion hook with caching
async function getSessionId(logger) {
  // Check if we have a valid cached sessionID
  if (cachedSessionId && sessionExpiry && Date.now() < sessionExpiry) {
    logger.info('Using cached sessionID');
    return cachedSessionId;
  }

  logger.info('Requesting new sessionID from Workfront Fusion hook');

  const response = await fetch(WORKFRONT_FUSION_HOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(`SessionID request failed: ${response.status} - ${errorText}`);
    throw new Error(`Failed to get sessionID: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  
  // Try to find sessionID in various possible field names
  cachedSessionId = data.sessionID || data.sessionId || data.session_id;
  
  if (!cachedSessionId) {
    logger.error('No sessionID found in response:', JSON.stringify(data));
    throw new Error('No sessionID found in Workfront Fusion response');
  }
  
  // Cache for 1 hour (3600000 ms)
  sessionExpiry = Date.now() + 3600000;
  
  logger.info('Successfully obtained sessionID');
  return cachedSessionId;
}

async function main (params) {
  const logger = Core.Logger('get-workfront-task', { level: 'info' })

  try {
    logger.info('Action invoked with params:', JSON.stringify(params));
    
    const { taskId } = params;

    if (!taskId) {
      logger.error('Task ID is missing from request');
      return {
        statusCode: 400,
        body: { error: 'Task ID is required' }
      };
    }

    // Get sessionID from Workfront Fusion hook
    let sessionId;
    try {
      sessionId = await getSessionId(logger);
    } catch (error) {
      logger.error('Failed to get sessionID:', error.message);
      return {
        statusCode: 500,
        body: { error: `Authentication failed: ${error.message}` }
      };
    }

    const apiUrl = `${WORKFRONT_API_BASE_URL}/TASK/${encodeURIComponent(taskId)}/search?fields=${WORKFRONT_TASK_FIELDS.join(',')}`;

    logger.info(`Fetching Workfront task: ${taskId} from ${apiUrl}`);
    logger.info(`Using sessionID: ${sessionId.substring(0, 10)}...`);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'sessionID': sessionId,
        'Content-Type': 'application/json'
      }
    });

    const responseText = await response.text();
    logger.info(`Workfront API response status: ${response.status}`);
    
    const payload = responseText ? JSON.parse(responseText) : {};
    logger.info('Workfront API response payload:', JSON.stringify(payload).substring(0, 500));

    if (!response.ok) {
      logger.error(`Workfront API error: ${response.status} - ${JSON.stringify(payload)}`);
      return {
        statusCode: response.status,
        body: payload
      };
    }

    logger.info(`Successfully fetched task: ${taskId}`);
    return {
      statusCode: 200,
      body: payload
    };

  } catch (error) {
    logger.error(`Error: ${error.message}`);
    logger.error(`Error stack: ${error.stack}`);
    return {
      statusCode: 500,
      body: { error: error.message }
    };
  }
}

exports.main = main
