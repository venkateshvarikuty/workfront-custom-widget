import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
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
  View,
  Well,
} from '@adobe/react-spectrum';
import { attach } from '@adobe/uix-guest';
import { extensionId } from './Constants';
import actionWebInvoke from '../utils';

const STATUS_OPTIONS = [
  { id: 'NEW', label: 'New' },
  { id: 'INP', label: 'In Progress' },
  { id: 'CPL', label: 'Complete' },
];

const TASK_ID_PARAM_NAMES = ['taskId', 'taskID', 'taskid', 'task_id', 'ID', 'id', 'objID', 'objectID'];
const ACTION_PATH = '/api/v1/web/workfront-custom-widget/get-workfront-task';

/* ---------- URL / param helpers ---------- */

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

/* ---------- Component ---------- */

const TaskStatusForm = () => {
  const [taskId, setTaskId] = useState('');
  const [currentStatus, setCurrentStatus] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Resolve task ID from URL or Workfront host
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

  // Fetch current task status on load
  useEffect(() => {
    if (!taskId) return;
    let active = true;

    const fetchStatus = async () => {
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
        if (active && status) {
          setCurrentStatus(status);
          setSelectedStatus(status);
        }
      } catch (error) {
        console.warn('Could not fetch task status:', error);
      } finally {
        if (active) setIsLoadingStatus(false);
      }
    };

    fetchStatus();
    return () => { active = false; };
  }, [taskId]);

  const statusLabel = useMemo(() => {
    const found = STATUS_OPTIONS.find((opt) => opt.id === currentStatus);
    return found ? found.label : currentStatus;
  }, [currentStatus]);

  const hasChanged = selectedStatus && selectedStatus !== currentStatus;

  const handleSubmit = async () => {
    if (!selectedStatus || !taskId) return;
    setIsSubmitting(true);
    setSubmitError('');
    try {
      const payload = await actionWebInvoke(
        getActionUrl(),
        {},
        {
          taskId,
          updates: { status: selectedStatus },
        },
        { method: 'PUT' },
      );

      const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
      if (data && data.error) throw new Error(data.error);

      setCurrentStatus(selectedStatus);
      setIsSuccess(true);
    } catch (error) {
      setSubmitError(error.message || 'Unable to update task status in Workfront.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusOptions = useMemo(() => {
    const hasSelected = STATUS_OPTIONS.some((opt) => opt.id === selectedStatus);
    if (!selectedStatus || hasSelected) return STATUS_OPTIONS;
    return [...STATUS_OPTIONS, { id: selectedStatus, label: selectedStatus }];
  }, [selectedStatus]);

  return (
    <Provider theme={defaultTheme} colorScheme="light">
      <View padding="size-200">
        <Heading level={3}>Task Status</Heading>

        {taskId && (
          <Text UNSAFE_style={{ color: '#666', marginTop: '8px', fontSize: '0.85em' }}>
            Task ID: {taskId}
          </Text>
        )}

        <Divider size="S" marginTop="size-200" marginBottom="size-200" />

        {isLoadingStatus ? (
          <Text>Loading task status...</Text>
        ) : isSuccess ? (
          <Well variant="positive" marginTop="size-200" marginBottom="size-200">
            <Heading level={4}>Status Updated Successfully!</Heading>
            <Text>Task status has been updated to <strong>{statusLabel}</strong>.</Text>
          </Well>
        ) : (
          <Form>
            {currentStatus && (
              <View marginBottom="size-200">
                <Text>
                  Current Status: <strong>{statusLabel}</strong>
                </Text>
              </View>
            )}

            <Picker
              label="Status"
              items={statusOptions}
              selectedKey={selectedStatus}
              onSelectionChange={(key) => {
                setSelectedStatus(key);
                setIsSuccess(false);
              }}
              width="100%"
              isRequired
            >
              {(item) => <Item key={item.id}>{item.label}</Item>}
            </Picker>

            <Divider size="S" marginTop="size-200" marginBottom="size-200" />

            <Flex gap="size-150" alignItems="center">
              <Button
                variant="primary"
                onPress={handleSubmit}
                isDisabled={isSubmitting || !hasChanged || !taskId}
              >
                Update Status
              </Button>
              {isSubmitting && <Text>Updating status...</Text>}
            </Flex>

            {submitError && (
              <View marginTop="size-100">
                <StatusLight variant="negative">{submitError}</StatusLight>
              </View>
            )}
          </Form>
        )}
      </View>
    </Provider>
  );
};

export default TaskStatusForm;
