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
import formConfig from '../forms/wellcom-brief.json';
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

const getParamValue = (search) => {
  const params = new URLSearchParams(search);
  const lowerNames = TASK_ID_PARAM_NAMES.map((name) => name.toLowerCase());
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
  } catch (error) {
    console.error('Failed to parse referrer:', error);
  }

  return '';
};

const getActionUrl = () => {
  if (window.location.hostname === 'localhost') {
    return `http://localhost:9080${ACTION_PATH}`;
  }
  const namespace = window.location.hostname.replace('.adobeio-static.net', '');
  return `https://${namespace}.adobeioruntime.net${ACTION_PATH}`;
};

const WellcomBriefForm = () => {
  const [form, setForm] = useState(initialForm);
  const [prefilledForm, setPrefilledForm] = useState(initialForm);
  const [taskId, setTaskId] = useState('');
  const [submittedOnce, setSubmittedOnce] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [isTaskCompleted, setIsTaskCompleted] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);

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

    return () => {
      active = false;
    };
  }, []);

  // Fetch task status to check if already completed
  useEffect(() => {
    if (!taskId) return;
    let active = true;

    const checkTaskStatus = async () => {
      setIsLoadingStatus(true);
      try {
        const payload = await actionWebInvoke(
          getActionUrl(),
          {},
          { taskId },
          { method: 'GET' },
        );
        const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
        const status = data?.data?.status || data?.status || '';
        if (active && status === 'CPL') {
          setIsTaskCompleted(true);
        }
      } catch (error) {
        console.warn('Could not check task status:', error);
      } finally {
        if (active) setIsLoadingStatus(false);
      }
    };

    checkTaskStatus();
    return () => { active = false; };
  }, [taskId]);

  const errors = useMemo(() => {
    const e = {};
    formConfig.sections.forEach((section) => {
      section.fields.forEach((field) => {
        if (field.required) {
          const value = form[field.name];
          if (field.type === 'checkbox') {
            if (!value) {
              e[field.name] = 'This field is required.';
            }
          } else if (field.type === 'multiselect') {
            if (!Array.isArray(value) || value.length === 0) {
              e[field.name] = `Select at least one ${field.label.toLowerCase()}.`;
            }
          } else if (typeof value !== 'string' || !value.trim()) {
            e[field.name] = `Enter a valid ${field.label.toLowerCase()}.`;
          }
        }
      });
    });
    return e;
  }, [form]);

  const hasErrors = Object.keys(errors).length > 0;
  const isFormModified = JSON.stringify(form) !== JSON.stringify(prefilledForm);

  const buildWorkfrontPayload = () => {
    const updates = {};
    formConfig.sections.forEach((section) => {
      section.fields.forEach((field) => {
        const wfKey = field.workfrontField;
        if (!wfKey) return;
        const value = form[field.name];
        if (field.type === 'multiselect') {
          const joined = Array.isArray(value) ? value.join(', ') : (value || '');
          if (joined) updates[wfKey] = joined;
        } else {
          const str = value !== undefined && value !== null ? String(value).trim() : '';
          if (str) updates[wfKey] = str;
        }
      });
    });
    return updates;
  };

  const handleSubmit = async () => {
    setSubmittedOnce(true);
    if (!hasErrors) {
      setIsSubmitting(true);
      setSubmitError('');
      try {
        // Step 1 — Save brief fields
        const payload = await actionWebInvoke(
          getActionUrl(),
          {},
          {
            taskId,
            updates: buildWorkfrontPayload(),
          },
          { method: 'PUT' },
        );

        const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
        if (data && data.error) throw new Error(data.error);

        // Step 2 — Set task status to Complete (CPL)
        const statusPayload = await actionWebInvoke(
          getActionUrl(),
          {},
          {
            taskId,
            updates: { status: 'CPL' },
          },
          { method: 'PUT' },
        );

        const statusData = typeof statusPayload === 'string' ? JSON.parse(statusPayload) : statusPayload;
        if (statusData && statusData.error) {
          console.warn('Brief saved but failed to close task:', statusData.error);
        }

        setIsSuccess(true);
      } catch (error) {
        setSubmitError(error.message || 'Unable to submit the brief to Workfront.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleReset = () => {
    setForm(prefilledForm);
    setSubmittedOnce(false);
    setIsSuccess(false);
    setIsSubmitting(false);
    setSubmitError('');
  };

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

        {isLoadingStatus ? (
          <Text>Loading task status...</Text>
        ) : isTaskCompleted ? (
          <Well marginTop="size-200" marginBottom="size-200">
            <Heading level={4}>Brief Already Submitted</Heading>
            <Text>This brief has already been submitted. We'll get back to you in case of any further queries.</Text>
          </Well>
        ) : isSuccess ? (
          <Well variant="positive" marginTop="size-200" marginBottom="size-200">
            <Heading level={4}>Brief Submitted Successfully!</Heading>
            <Text>Thank you for submitting the new brief.</Text>
          </Well>
        ) : (
          <Form>
            <FormRenderer
              config={formConfig}
              formData={form}
              onChange={(name, value) => setForm((current) => ({ ...current, [name]: value }))}
              errors={errors}
              submittedOnce={submittedOnce}
            />

            <Divider size="S" marginTop="size-200" marginBottom="size-200" />

            <Flex gap="size-100" direction="row">
              <Button
                variant="primary"
                onPress={handleSubmit}
                isDisabled={isSubmitting || (submittedOnce && hasErrors)}
              >
                Submit Brief
              </Button>

              {isFormModified && !isSubmitting && (
                <Button variant="secondary" onPress={handleReset}>
                  Reset
                </Button>
              )}

              {isSubmitting && <Text>Submitting brief to Workfront...</Text>}
            </Flex>

            {submitError && (
              <View marginTop="size-100">
                <StatusLight variant="negative">{submitError}</StatusLight>
              </View>
            )}

            {submittedOnce && hasErrors && (
              <View marginTop="size-100">
                <StatusLight variant="negative">
                  Please fix the highlighted errors before submitting.
                </StatusLight>
              </View>
            )}
          </Form>
        )}
      </View>
    </Provider>
  );
};

export default WellcomBriefForm;
