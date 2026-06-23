import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  defaultTheme,
  Divider,
  Flex,
  Form,
  Heading,
  Provider,
  StatusLight,
  Text,
  View,
  Well,
} from '@adobe/react-spectrum';
import actionWebInvoke from '../utils';
import formConfig from '../forms/screen-network-brief.json';
import FormRenderer from './FormRenderer';

const TASK_ID_PARAM_NAMES = ['taskId', 'taskID', 'taskid', 'task_id', 'ID', 'id', 'objID', 'objectID'];

const ACTION_PATH = '/api/v1/web/workfront-custom-widget/get-workfront-task';

const getInitialFormState = (config) => {
  const state = {};
  config.sections.forEach((section) => {
    section.fields.forEach((field) => {
      state[field.name] = field.defaultValue !== undefined ? field.defaultValue : (field.type === 'checkbox' ? false : '');
    });
  });
  return state;
};

const initialForm = getInitialFormState(formConfig);

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

const mapTaskRecordToForm = (record, config) => {
  const mapped = {};
  config.sections.forEach((section) => {
    section.fields.forEach((field) => {
      if (field.workfrontField) {
        const rawValue = getWorkfrontField(record, field.workfrontField);
        if (field.type === 'date') {
          mapped[field.name] = toDate(rawValue);
        } else if (field.type === 'checkbox') {
          mapped[field.name] = rawValue === true || String(rawValue).toLowerCase() === 'true';
        } else {
          mapped[field.name] = toText(rawValue);
        }
      } else {
        mapped[field.name] = field.defaultValue !== undefined ? field.defaultValue : (field.type === 'checkbox' ? false : '');
      }
    });
  });
  return mapped;
};

/* ---------- Component ---------- */

const ScreenNetworkBrief = () => {
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

        const nextForm = mapTaskRecordToForm(taskRecord, formConfig);

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

  const errors = useMemo(() => {
    const e = {};
    formConfig.sections.forEach((section) => {
      section.fields.forEach((field) => {
        if (field.required) {
          const val = form[field.name];
          if (field.type === 'checkbox') {
            if (!val) {
              e[field.name] = 'Acknowledgement is required.';
            }
          } else if (typeof val !== 'string' || !val.trim()) {
            e[field.name] = `Enter a valid ${field.label.toLowerCase()}.`;
          }
        }
      });
    });
    return e;
  }, [form]);

  const hasErrors = Object.keys(errors).length > 0;
  const isFormModified = JSON.stringify(form) !== JSON.stringify(prefilledForm);

  const handleSubmit = () => {
    setSubmittedOnce(true);
    if (!hasErrors) {
      console.log('Submitting Screen Network Brief Data:', form);
      // TODO: submit the form to your backend
    }
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
        <Heading level={3}>{formConfig.title}</Heading>

        {taskId && (
          <Text UNSAFE_style={{ color: '#666', marginTop: '8px', fontSize: '0.85em' }}>
            Task ID: {taskId}
          </Text>
        )}

        <Divider size="S" marginTop="size-200" marginBottom="size-200" />

        <Form>
          <FormRenderer
            config={formConfig}
            formData={form}
            onChange={(name, val) => setForm({ ...form, [name]: val })}
            errors={errors}
            submittedOnce={submittedOnce}
          />

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

export default ScreenNetworkBrief;
