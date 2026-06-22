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

const ACTION_PATH = '/api/v1/web/workfront-custom-widget/get-workfront-task';

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

/* ---------- URL / param helpers ---------- */

const getParamValue = (search) => {
  const params = new URLSearchParams(search);
  for (const name of TASK_ID_PARAM_NAMES) {
    const value = params.get(name);
    if (value?.trim()) return value.trim();
  }
  return '';
};

const getTaskIdFromUrl = () => {
  const fromSearch = getParamValue(window.location.search);
  if (fromSearch) return fromSearch;

  const hash = window.location.hash || '';
  const hashQueryIndex = hash.indexOf('?');
  if (hashQueryIndex >= 0) {
    const fromHash = getParamValue(hash.slice(hashQueryIndex + 1));
    if (fromHash) return fromHash;
  }

  const match = decodeURIComponent(window.location.href).match(/\/TASK\/([a-z0-9]+)/i);
  return match?.[1] || '';
};

/**
 * Derive the Runtime action URL from the current hostname.
 * In local dev (`aio app run`) the action is on localhost:9080;
 * in deployed environments the hostname already contains the namespace.
 */
const getActionUrl = () => {
  if (window.location.hostname === 'localhost') {
    return `http://localhost:9080${ACTION_PATH}`;
  }
  const namespace = window.location.hostname.replace('.adobeio-static.net', '');
  return `https://${namespace}.adobeioruntime.net${ACTION_PATH}`;
};

/* ---------- Workfront response helpers ---------- */

const getWorkfrontTaskRecord = (payload) => {
  if (payload?.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    return payload.data;
  }
  if (Array.isArray(payload?.data)) {
    return payload.data[0] || {};
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
    if (!source || typeof source !== 'object') continue;
    for (const candidate of candidates) {
      if (source[candidate] !== undefined && source[candidate] !== null) {
        return source[candidate];
      }
    }
  }
  return '';
};

const toText = (v) => (v === undefined || v === null ? '' : String(v).trim());

const toDate = (v) => {
  const t = toText(v);
  return t.match(/^\d{4}-\d{2}-\d{2}/)?.[0] || t;
};

const normalizeRequestType = (value) => {
  const text = toText(value);
  if (!text) return '';
  const match = requestTypes.find(
    (t) => t.id.toLowerCase() === text.toLowerCase() || t.label.toLowerCase() === text.toLowerCase(),
  );
  return match?.id || text;
};

const mapTaskRecordToForm = (record) => ({
  ...initialForm,
  title: toText(getWorkfrontField(record, 'DE:Request title')),
  requestType: normalizeRequestType(getWorkfrontField(record, 'DE:Request type')),
  requestedBy: toText(getWorkfrontField(record, 'DE:Requested by')),
  dueDate: toDate(getWorkfrontField(record, 'DE:Target date')),
  description: toText(getWorkfrontField(record, 'DE:Request details')),
});

/* ---------- Component ---------- */

const CustomwidgetMainMenuItem = () => {
  const [form, setForm] = useState(initialForm);
  const [prefilledForm, setPrefilledForm] = useState(initialForm);
  const [taskId, setTaskId] = useState('');
  const [isLoadingTask, setIsLoadingTask] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [submittedOnce, setSubmittedOnce] = useState(false);

  useEffect(() => {
    const nextTaskId = getTaskIdFromUrl();
    setTaskId(nextTaskId);

    if (!nextTaskId) {
      setLoadError('Task ID was not found in the URL.');
      return undefined;
    }

    let active = true;

    const loadTask = async () => {
      setIsLoadingTask(true);
      setLoadError('');

      try {
        const payload = await actionWebInvoke(
          getActionUrl(),
          {},
          { taskId: nextTaskId },
          { method: 'GET' },
        );

        let data = typeof payload === 'string' ? JSON.parse(payload) : payload;

        if (data.error) throw new Error(data.error);

        const taskRecord = getWorkfrontTaskRecord(data);
        if (Object.keys(taskRecord).length === 0) {
          throw new Error('No task details were returned for this Task ID.');
        }

        const nextForm = mapTaskRecordToForm(taskRecord);

        if (active) {
          setForm(nextForm);
          setPrefilledForm(nextForm);
          setSubmittedOnce(false);
        }
      } catch (error) {
        if (active) {
          setLoadError(error.message || 'Unable to load task details from Workfront.');
        }
      } finally {
        if (active) setIsLoadingTask(false);
      }
    };

    loadTask();
    return () => { active = false; };
  }, []);

  const requestTypeOptions = useMemo(() => {
    const hasSelected = requestTypes.some((t) => t.id === form.requestType);
    if (!form.requestType || hasSelected) return requestTypes;
    return [...requestTypes, { id: form.requestType, label: form.requestType }];
  }, [form.requestType]);

  const errors = useMemo(() => {
    const e = {};
    if (!form.title.trim()) e.title = 'Enter a request title.';
    if (!form.requestType.trim()) e.requestType = 'Select a request type.';
    if (!form.requestedBy.trim()) e.requestedBy = 'Enter the requester name.';
    if (!form.dueDate.trim()) e.dueDate = 'Enter a target date.';
    if (!form.description.trim()) e.description = 'Enter request details.';
    return e;
  }, [form]);

  const hasErrors = Object.keys(errors).length > 0;
  const isFormModified = JSON.stringify(form) !== JSON.stringify(prefilledForm);

  const handleSubmit = () => {
    setSubmittedOnce(true);
    // TODO: submit the form to your backend
  };

  const handleReset = () => {
    setForm(prefilledForm);
    setSubmittedOnce(false);
  };

  /* --- Render --- */

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
          <Text>Loading task details…</Text>
        </View>
      </Provider>
    );
  }

  return (
    <Provider theme={defaultTheme} colorScheme="light">
      <View padding="size-200">
        <Heading level={3}>Workfront Task Request</Heading>

        {taskId && (
          <Text UNSAFE_style={{ color: '#666', marginTop: '8px', fontSize: '0.85em' }}>
            Task ID: {taskId}
          </Text>
        )}

        <Divider size="S" marginTop="size-200" marginBottom="size-200" />

        <Form>
          <TextField
            label="Title"
            value={form.title}
            onChange={(v) => setForm({ ...form, title: v })}
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
            onChange={(v) => setForm({ ...form, requestedBy: v })}
            errorMessage={submittedOnce && errors.requestedBy ? errors.requestedBy : ''}
            validationState={submittedOnce && errors.requestedBy ? 'invalid' : 'valid'}
            isRequired
          />

          <TextField
            label="Target Date"
            value={form.dueDate}
            onChange={(v) => setForm({ ...form, dueDate: v })}
            errorMessage={submittedOnce && errors.dueDate ? errors.dueDate : ''}
            validationState={submittedOnce && errors.dueDate ? 'invalid' : 'valid'}
            isRequired
          />

          <TextArea
            label="Request Details"
            value={form.description}
            onChange={(v) => setForm({ ...form, description: v })}
            errorMessage={submittedOnce && errors.description ? errors.description : ''}
            validationState={submittedOnce && errors.description ? 'invalid' : 'valid'}
            isRequired
          />

          <TextField
            label="Campaign Name"
            value={form.campaignName}
            onChange={(v) => setForm({ ...form, campaignName: v })}
          />

          <TextField
            label="Brand"
            value={form.brand}
            onChange={(v) => setForm({ ...form, brand: v })}
          />

          <TextField
            label="Asset Owner"
            value={form.assetOwner}
            onChange={(v) => setForm({ ...form, assetOwner: v })}
          />

          <TextArea
            label="Additional Notes"
            value={form.additionalNotes}
            onChange={(v) => setForm({ ...form, additionalNotes: v })}
          />

          <Flex gap="size-100" marginTop="size-200" alignItems="center">
            <Checkbox
              isSelected={form.notifyRequester}
              onChange={(checked) => setForm({ ...form, notifyRequester: checked })}
            >
              Notify Requester
            </Checkbox>
          </Flex>

          <Divider size="S" marginTop="size-200" marginBottom="size-200" />

          <Flex gap="size-100" direction="row">
            <Button
              variant="primary"
              onPress={handleSubmit}
              isDisabled={submittedOnce && hasErrors}
            >
              Submit
            </Button>

            {isFormModified && (
              <Button variant="secondary" onPress={handleReset}>
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
