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
import { attach } from '@adobe/uix-guest';
import { extensionId } from './Constants';
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
  const lowerNames = TASK_ID_PARAM_NAMES.map(n => n.toLowerCase());
  for (const [key, value] of params.entries()) {
    if (lowerNames.includes(key.toLowerCase()) && value?.trim()) {
      return value.trim();
    }
  }
  for (const [, value] of params.entries()) {
    const cleaned = value?.trim();
    if (cleaned && /^[a-f0-9]{32}$/i.test(cleaned)) {
      return cleaned;
    }
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
  if (match?.[1]) return match[1];

  try {
    const referrer = document.referrer;
    if (referrer) {
      const refMatch = decodeURIComponent(referrer).match(/\/task\/([a-z0-9]+)/i);
      if (refMatch?.[1]) return refMatch[1];
    }
  } catch (e) {
    console.error('Failed to parse referrer:', e);
  }

  return '';
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
  const [submittedOnce, setSubmittedOnce] = useState(false);

  useEffect(() => {
    let active = true;

    const nextTaskId = getTaskIdFromUrl();
    if (nextTaskId) {
      setTaskId(nextTaskId);
    }

    const connectToHost = async () => {
      try {
        const guestConnection = await attach({ id: extensionId });
        if (!active) return;

        const objID = guestConnection.sharedContext.get('objID');
        if (objID) {
          setTaskId(objID);
        }
      } catch (error) {
        console.warn('Could not attach to Workfront host (this is expected during direct/local testing):', error);
      }
    };

    connectToHost();

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
