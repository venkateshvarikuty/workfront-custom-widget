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

const WORKFRONT_API_BASE_URL = 'https://origin-dluxtechapacptrsdwf.my.workfront.com/attask/api/v21.0';
const WORKFRONT_SESSION_ID = '094fe1b2fdbc498eaaace42bfe6467c3';
const WORKFRONT_TASK_FIELDS = [
  'DE:Request type',
  'DE:Request title',
  'DE:Requested by',
  'DE:Target date',
  'DE:Request details',
];
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

const getWorkfrontTaskUrl = (taskId) => {
  const params = new URLSearchParams({
    taskId: taskId,
    fields: WORKFRONT_TASK_FIELDS.join(','),
  });

  return `http://localhost:3001/api/workfront/task?${params.toString()}`;
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
        const apiUrl = getWorkfrontTaskUrl(nextTaskId);
        console.log('[CustomWidget] Proxy API URL:', apiUrl);

        const response = await fetch(apiUrl, {
          method: 'GET',
        });

        const responseText = await response.text();
        console.log('[CustomWidget] Response status:', response.status);
        console.log('[CustomWidget] Response text (first 200 chars):', responseText.substring(0, 200));

        let payload;
        try {
          payload = responseText ? JSON.parse(responseText) : {};
        } catch (e) {
          console.error('[CustomWidget] JSON parse error:', e);
          throw new Error('Invalid response from proxy server. Make sure the proxy server is running on port 3001.');
        }

        if (!response.ok) {
          console.error('[CustomWidget] Proxy error:', payload);
          throw new Error(payload?.error || `Proxy request failed (${response.status})`);
        }

        const taskRecord = getWorkfrontTaskRecord(payload);
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

    if (form.description.trim().length < 20) {
      nextErrors.description = 'Add at least 20 characters of context.';
    }

    return nextErrors;
  }, [form]);

  const updateField = (field, value) => {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
    setSubmittedRequest(null);
  };

  const showError = (field) => submittedOnce && errors[field];

  const handleSubmit = (event) => {
    event.preventDefault();
    setSubmittedOnce(true);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setSubmittedRequest({
      id: `WF-FORM-${Date.now().toString().slice(-6)}`,
      taskId,
      ...form,
      requestTypeLabel: selectedType?.label || form.requestType,
      submittedAt: new Date().toLocaleString(),
    });
  };

  const handleReset = () => {
    setForm(prefilledForm);
    setSubmittedOnce(false);
    setSubmittedRequest(null);
  };

  return (
    <Provider theme={defaultTheme} colorScheme="light">
      <View padding="size-400" backgroundColor="gray-50" minHeight="100vh">
        <View
          backgroundColor="gray-50"
          borderColor="gray-300"
          borderRadius="small"
          borderWidth="thin"
          maxWidth="960px"
          padding="size-400"
        >
          <Flex direction="column" gap="size-300">
            <Flex direction="column" gap="size-75">
              <StatusLight variant="info">Local POC widget</StatusLight>
              <Heading level={1} margin="size-0">
                Workfront Task Form
              </Heading>
              <Text>
                Review the task details loaded from Workfront, then complete the remaining request fields.
              </Text>
            </Flex>

            {(isLoadingTask || loadError || taskId) && (
              <View
                backgroundColor={loadError ? 'red-100' : 'blue-100'}
                borderColor={loadError ? 'red-400' : 'blue-400'}
                borderRadius="small"
                borderWidth="thin"
                padding="size-200"
              >
                <StatusLight variant={loadError ? 'negative' : isLoadingTask ? 'info' : 'positive'}>
                  {loadError || (isLoadingTask ? 'Loading task details from Workfront' : `Loaded task ${taskId}`)}
                </StatusLight>
              </View>
            )}

            <Divider size="S" />

            <Flex direction={{ base: 'column', M: 'row' }} gap="size-400" alignItems="start">
              <View flex="1 1 540px" minWidth="size-0">
                <Form onSubmit={handleSubmit} width="100%" necessityIndicator="label">
                  <Flex direction="column" gap="size-250">
                    <TextField
                      label="Request title"
                      value={form.title}
                      onChange={(value) => updateField('title', value)}
                      isRequired
                      validationState={showError('title') ? 'invalid' : undefined}
                      errorMessage={errors.title}
                    />

                    <Picker
                      label="Request type"
                      selectedKey={form.requestType}
                      onSelectionChange={(key) => updateField('requestType', key)}
                      isRequired
                      validationState={showError('requestType') ? 'invalid' : undefined}
                      errorMessage={errors.requestType}
                    >
                      {requestTypeOptions.map((type) => (
                        <Item key={type.id}>{type.label}</Item>
                      ))}
                    </Picker>

                    <Flex direction={{ base: 'column', M: 'row' }} gap="size-200">
                      <TextField
                        label="Requested by"
                        value={form.requestedBy}
                        onChange={(value) => updateField('requestedBy', value)}
                        isRequired
                        validationState={showError('requestedBy') ? 'invalid' : undefined}
                        errorMessage={errors.requestedBy}
                        width="100%"
                      />
                      <TextField
                        label="Target date"
                        value={form.dueDate}
                        onChange={(value) => updateField('dueDate', value)}
                        placeholder="YYYY-MM-DD"
                        isRequired
                        validationState={showError('dueDate') ? 'invalid' : undefined}
                        errorMessage={errors.dueDate}
                        width="100%"
                      />
                    </Flex>

                    <TextArea
                      label="Request details"
                      value={form.description}
                      onChange={(value) => updateField('description', value)}
                      isRequired
                      validationState={showError('description') ? 'invalid' : undefined}
                      errorMessage={errors.description}
                      width="100%"
                    />

                    <Divider size="S" />

                    <Heading level={3} margin="size-0">
                      Additional details
                    </Heading>

                    <Flex direction={{ base: 'column', M: 'row' }} gap="size-200">
                      <TextField
                        label="Campaign name"
                        value={form.campaignName}
                        onChange={(value) => updateField('campaignName', value)}
                        width="100%"
                      />
                      <TextField
                        label="Brand"
                        value={form.brand}
                        onChange={(value) => updateField('brand', value)}
                        width="100%"
                      />
                    </Flex>

                    <TextField
                      label="Asset owner"
                      value={form.assetOwner}
                      onChange={(value) => updateField('assetOwner', value)}
                      width="100%"
                    />

                    <TextArea
                      label="Additional notes"
                      value={form.additionalNotes}
                      onChange={(value) => updateField('additionalNotes', value)}
                      width="100%"
                    />

                    <Checkbox
                      isSelected={form.notifyRequester}
                      onChange={(isSelected) => updateField('notifyRequester', isSelected)}
                    >
                      Notify requester when submitted
                    </Checkbox>

                    <Flex gap="size-150" wrap>
                      <Button variant="accent" type="submit">
                        Submit request
                      </Button>
                      <Button variant="secondary" type="button" onPress={handleReset}>
                        Reset
                      </Button>
                    </Flex>
                  </Flex>
                </Form>
              </View>

              <View flex="1 1 320px" minWidth="size-0" width="100%">
                <Well>
                  <Flex direction="column" gap="size-150">
                    <Heading level={2} margin="size-0">
                      Draft preview
                    </Heading>
                    <Text>
                      Title: {form.title || 'Untitled request'}
                    </Text>
                    <Text>
                      Type: {selectedType?.label || form.requestType || 'Not provided'}
                    </Text>
                    <Text>
                      Requester: {form.requestedBy || 'Not provided'}
                    </Text>
                    <Text>
                      Target date: {form.dueDate || 'Not provided'}
                    </Text>
                    <Text>
                      Notification: {form.notifyRequester ? 'Enabled' : 'Disabled'}
                    </Text>
                    <Divider size="S" />
                    <Text>
                      Campaign: {form.campaignName || 'Not provided'}
                    </Text>
                    <Text>
                      Brand: {form.brand || 'Not provided'}
                    </Text>
                    <Text>
                      Asset owner: {form.assetOwner || 'Not provided'}
                    </Text>
                    {submittedRequest && (
                      <View
                        backgroundColor="green-100"
                        borderColor="green-400"
                        borderRadius="small"
                        borderWidth="thin"
                        padding="size-200"
                      >
                        <Flex direction="column" gap="size-75">
                          <StatusLight variant="positive">Ready to send</StatusLight>
                          <Text>
                            {submittedRequest.id} submitted at {submittedRequest.submittedAt}
                          </Text>
                        </Flex>
                      </View>
                    )}
                  </Flex>
                </Well>
              </View>
            </Flex>
          </Flex>
        </View>
      </View>
    </Provider>
  );
};

export default CustomwidgetMainMenuItem;
