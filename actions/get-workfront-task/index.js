/*
* <license header>
*/

const { Core } = require('@adobe/aio-sdk')
const fetch = require('node-fetch')

const WORKFRONT_API_BASE_URL = 'https://origin-dluxtechapacptrsdwf.my.workfront.com/attask/api/v21.0';
const WORKFRONT_SESSION_ID = '094fe1b2fdbc498eaaace42bfe6467c3';
const WORKFRONT_TASK_FIELDS = [
  'DE:Request type',
  'DE:Request title',
  'DE:Requested by',
  'DE:Target date',
  'DE:Request details',
];

async function main (params) {
  const logger = Core.Logger('get-workfront-task', { level: 'info' })

  try {
    logger.info('Action invoked with params:', JSON.stringify(params));
    
    const { taskId, __ow_method } = params;

    if (!taskId) {
      logger.error('Task ID is missing from request');
      return {
        statusCode: 400,
        body: { error: 'Task ID is required' }
      };
    }

    const apiUrl = `${WORKFRONT_API_BASE_URL}/TASK/${encodeURIComponent(taskId)}/search?fields=${WORKFRONT_TASK_FIELDS.join(',')}`;

    logger.info(`Fetching Workfront task: ${taskId} from ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'sessionID': WORKFRONT_SESSION_ID,
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
