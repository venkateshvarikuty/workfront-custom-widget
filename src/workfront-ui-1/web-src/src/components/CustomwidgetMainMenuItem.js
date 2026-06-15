import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  defaultTheme,
  Divider,
  Flex,
  Form,
  Heading,
  Item,
  Picker,
  Provider,
  StatusLight,
  Text,
  TextArea,
  TextField,
  View,
  Well,
} from '@adobe/react-spectrum';
import actionWebInvoke from '../utils';

const TASK_ID_PARAM_NAMES = ['taskId', 'taskID', 'taskid', 'task_id', 'ID', 'id', 'objID', 'objectID'];

const initialForm = {
  title: '',
  requestType: '',
  requestedBy: '',
  dueDate: '',
  description: '',
  campaignName: '',
  brand: '',
  assetOwner: '',
  additionalNotes: '',
  notifyRequester: true,
};

const requestTypes = [
  { id: 'general', label: 'General request' },
  { id: 'creative', label: 'Creative brief' },
  { id: 'approval', label: 'Approval request' },
  { id: 'asset', label: 'Asset update' },
];

const getParamValue = (search) => {
  const params = new URLSearchParams(search);

  for (const name of TASK_ID_PARAM_NAMES) {
    const value = params.get(name);

    if (value?.trim()) {
      return value.trim();
    }
  }

  return '';
};

const getTaskIdFromUrl = () => {
  const fromSearch = getParamValue(window.location.search);

  if (fromSearch) {
    return fromSearch;
  }

  const hash = window.location.hash || '';
  const hashQueryIndex = hash.indexOf('?');

  if (hashQueryIndex >= 0) {
    const fromHashQuery = getParamValue(hash.slice(hashQueryIndex + 1));

    if (fromHashQuery) {
      return fromHashQuery;
    }
  }

  const taskPathMatch = decodeURIComponent(window.location.href).match(/\/TASK\/([a-z0-9]+)/i);
  return taskPathMatch?.[1] || '';
};

const getActionUrl = () => {
  // In development, use the local action server
  if (window.location.hostname === 'localhost') {
    return 'http://localhost:9090/api/v1/web/workfront-custom-widget/default/get-workfront-task';
  }
  
  // In production, use the deployed action URL
  // This should be replaced with the actual deployed action URL
  return 'https://adobeio.adobe.io/api/workfront-custom-widget/default/get-workfront-task';
};

const getWorkfrontTaskRecord = (payload) => {
  if (Array.isArray(payload?.data)) {
    return payload.data[0] || {};
  }

  if (payload?.data && typeof payload.data === 'object') {
    return payload.data;
  }

  if (payload && typeof payload === 'object') {
    return payload;
  }

  return {};
};

const getWorkfrontField = (record, fieldName) => {
  const plainFieldName = fieldName.replace('DE:', '').trim();
  const candidates = [fieldName, fieldName.trim(), plainFieldName];
  const sources = [record, record?.parameterValues, record?.customData, record?.fields];

  for (const source of sources) {
    if (!source || typeof source !== 'object') {
      continue;
    }

    for (const candidate of candidates) {
      if (source[candidate] !== undefined && source[candidate] !== null) {
        return source[candidate];
      }
    }
  }

  return '';
};

const getTextValue = (value) => {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value).trim();
};

const getDateValue = (value) => {
  const textValue = getTextValue(value);
  const dateMatch = textValue.match(/^\d{4}-\d{2}-\d{2}/);

  return dateMatch?.[0] || textValue;
};

const normalizeRequestType = (value) => {
  const textValue = getTextValue(value);

  if (!textValue) {
    return '';
  }

  const matchedType = requestTypes.find(
    (type) =>
      type.id.toLowerCase() === textValue.toLowerCase() ||
      type.label.toLowerCase() === textValue.toLowerCase()
  );

  return matchedType?.id || textValue;
};

const mapTaskRecordToForm = (record) => ({
  ...initialForm,
  title: getTextValue(getWorkfrontField(record, 'DE:Request title')),
  requestType: normalizeRequestType(getWorkfrontField(record, 'DE:Request type')),
  requestedBy: getTextValue(getWorkfrontField(record, 'DE:Requested by')),
  dueDate: getDateValue(getWorkfrontField(record, 'DE:Target date')),
  description: getTextValue(getWorkfrontField(record, 'DE:Request details')),
});

const CustomwidgetMainMenuItem = () => {
  const [form, setForm] = useState(initialForm);
  const [prefilledForm, setPrefilledForm] = useState(initialForm);
  const [taskId, setTaskId] = useState('');
  const [isLoadingTask, setIsLoadingTask] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [submittedOnce, setSubmittedOnce] = useState(false);
  const [submittedRequest, setSubmittedRequest] = useState(null);

  useEffect(() => {
    const nextTaskId = getTaskIdFromUrl();
    setTaskId(nextTaskId);

    if (!nextTaskId) {
      setLoadError('Task ID was not found in the URL.');
      return undefined;
    }

    let shouldUpdateState = true;

    const loadTask = async () => {
      setIsLoadingTask(true);
      setLoadError('');

      try {
        console.log('[CustomWidget] Loading task with ID:', nextTaskId);
        const actionUrl = getActionUrl();
        console.log('[CustomWidget] Action URL:', actionUrl);

        // Call the Runtime Action instead of local proxy
        const payload = await actionWebInvoke(actionUrl, {}, { taskId });
        
        console.log('[CustomWidget] Action response:', payload);

        // The actionWebInvoke utility already parses the response
        let responsePayload;
        if (typeof payload === 'string') {
          try {
            responsePayload = JSON.parse(payload);
          } catch (e) {
            console.error('[CustomWidget] JSON parse error:', e);
            throw new Error('Invalid response from Runtime Action.');
          }
        } else {
          responsePayload = payload;
        }

        // Handle error responses from the action
        if (responsePayload.statusCode && responsePayload.statusCode !== 200) {
          const errorMessage = responsePayload.body?.error || `Runtime Action failed (${responsePayload.statusCode})`;
          console.error('[CustomWidget] Action error:', errorMessage);
          throw new Error(errorMessage);
        }

        // The actual task data is in the body field
        const taskData = responsePayload.body || responsePayload;
        const taskRecord = getWorkfrontTaskRecord(taskData);
        console.log('[CustomWidget] Task record:', taskRecord);

        if (Object.keys(taskRecord).length === 0) {
          throw new Error('No task details were returned for this Task ID.');
        }

        const nextForm = mapTaskRecordToForm(taskRecord);
        console.log('[CustomWidget] Mapped form:', nextForm);

        if (shouldUpdateState) {
          setForm(nextForm);
          setPrefilledForm(nextForm);
          setSubmittedOnce(false);
          setSubmittedRequest(null);
        }
      } catch (error) {
        console.error('[CustomWidget] Load task error:', error);
        if (shouldUpdateState) {
          setLoadError(error.message || 'Unable to load task details from Workfront.');
        }
      } finally {
        if (shouldUpdateState) {
          setIsLoadingTask(false);
        }
      }
    };

    loadTask();

    return () => {
      shouldUpdateState = false;
    };
  }, []);

  const requestTypeOptions = useMemo(() => {
    const hasSelectedType = requestTypes.some((type) => type.id === form.requestType);

    if (!form.requestType || hasSelectedType) {
      return requestTypes;
    }

    return [...requestTypes, { id: form.requestType, label: form.requestType }];
  }, [form.requestType]);

  const selectedType = useMemo(
    () => requestTypeOptions.find((type) => type.id === form.requestType),
    [form.requestType, requestTypeOptions]
  );

  const errors = useMemo(() => {
    const nextErrors = {};

    if (!form.title.trim()) {
      nextErrors.title = 'Enter a request title.';
    }

    if (!form.requestType.trim()) {
      nextErrors.requestType = 'Select a request type.';
    }

    if (!form.requestedBy.trim()) {
      nextErrors.requestedBy = 'Enter the requester name.';
    }

    if (!form.dueDate.trim()) {
      nextErrors.dueDate = 'Enter a target date.';
    }

    if (!form.description.trim()) {
      nextErrors.description = 'Enter request details.';
    }

    return nextErrors;
  }, [form]);

  const hasErrors = Object.keys(errors).length > 0;
  const isFormModified = JSON.stringify(form) !== JSON.stringify(prefilledForm);

  const handleSubmit = () => {
    setSubmittedOnce(true);
    setSubmittedRequest(form);

    // Here you would typically submit the form to your backend
    console.log('[CustomWidget] Form submitted:', form);
    alert('Form submitted successfully!');
  };

  const handleReset = () => {
    setForm(prefilledForm);
    setSubmittedOnce(false);
    setSubmittedRequest(null);
  };

  if (loadError) {
    return (
      <Provider theme={defaultTheme} colorScheme="light">
        <View padding="size-200">
          <Well>
            <Text>Error: {loadError}</Text>
          </Well>
        </View>
      </Provider>
    );
  }

  if (isLoadingTask) {
    return (
      <Provider theme={defaultTheme} colorScheme="light">
        <View padding="size-200">
          <Text>Loading task details...</Text>
        </View>
      </Provider>
    );
  }

  return (
    <Provider theme={defaultTheme} colorScheme="light">
      <View padding="size-200">
        <Heading level={3}>Workfront Task Request</Heading>
        
        {taskId && (
          <Text size="small" UNSAFE_style={{ color: '#666', marginTop: '8px' }}>
            Task ID: {taskId}
          </Text>
        )}

        <Divider size="size-100" marginTop="size-200" marginBottom="size-200" />

        <Form>
          <TextField
            label="Title"
            value={form.title}
            onChange={(value) => setForm({ ...form, title: value })}
            errorMessage={submittedOnce && errors.title ? errors.title : ''}
            validationState={submittedOnce && errors.title ? 'invalid' : 'valid'}
            isRequired
          />

          <Picker
            label="Request Type"
            items={requestTypeOptions}
            selectedKey={form.requestType}
            onSelectionChange={(key) => setForm({ ...form, requestType: key })}
            errorMessage={submittedOnce && errors.requestType ? errors.requestType : ''}
            validationState={submittedOnce && errors.requestType ? 'invalid' : 'valid'}
            isRequired
          >
            {(item) => <Item key={item.id}>{item.label}</Item>}
          </Picker>

          <TextField
            label="Requested By"
            value={form.requestedBy}
            onChange={(value) => setForm({ ...form, requestedBy: value })}
            errorMessage={submittedOnce && errors.requestedBy ? errors.requestedBy : ''}
            validationState={submittedOnce && errors.requestedBy ? 'invalid' : 'valid'}
            isRequired
          />

          <TextField
            label="Target Date"
            value={form.dueDate}
            onChange={(value) => setForm({ ...form, dueDate: value })}
            errorMessage={submittedOnce && errors.dueDate ? errors.dueDate : ''}
            validationState={submittedOnce && errors.dueDate ? 'invalid' : 'valid'}
            isRequired
          />

          <TextArea
            label="Request Details"
            value={form.description}
            onChange={(value) => setForm({ ...form, description: value })}
            errorMessage={submittedOnce && errors.description ? errors.description : ''}
            validationState={submittedOnce && errors.description ? 'invalid' : 'valid'}
            isRequired
            height="style-size-200"
          />

          <TextField
            label="Campaign Name"
            value={form.campaignName}
            onChange={(value) => setForm({ ...form, campaignName: value })}
          />

          <TextField
            label="Brand"
            value={form.brand}
            onChange={(value) => setForm({ ...form, brand: value })}
          />

          <TextField
            label="Asset Owner"
            value={form.assetOwner}
            onChange={(value) => setForm({ ...form, assetOwner: value })}
          />

          <TextArea
            label="Additional Notes"
            value={form.additionalNotes}
            onChange={(value) => setForm({ ...form, additionalNotes: value })}
            height="style-size-200"
          />

          <Flex gap="size-100" marginTop="size-200" alignItems="center">
            <Checkbox
              isSelected={form.notifyRequester}
              onChange={(isSelected) => setForm({ ...form, notifyRequester: isSelected })}
            >
              Notify Requester
            </Checkbox>
          </Flex>

          <Divider size="size-100" marginTop="size-200" marginBottom="size-200" />

          <Flex gap="size-100" direction="row">
            <Button
              variant="primary"
              onPress={handleSubmit}
              isDisabled={submittedOnce && hasErrors}
            >
              Submit
            </Button>
            
            {isFormModified && (
              <Button
                variant="secondary"
                onPress={handleReset}
              >
                Reset
              </Button>
            )}
          </Flex>

          {submittedOnce && hasErrors && (
            <View marginTop="size-100">
              <StatusLight variant="negative">
                Please fix the errors above before submitting.
              </StatusLight>
            </View>
          )}
        </Form>
      </View>
    </Provider>
  );
};

export default CustomwidgetMainMenuItem;
