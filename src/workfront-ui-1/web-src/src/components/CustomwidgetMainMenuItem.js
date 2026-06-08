import React, { useMemo, useState } from 'react';
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

const initialForm = {
  title: '',
  requestType: 'general',
  requestedBy: '',
  dueDate: '',
  description: '',
  notifyRequester: true,
};

const requestTypes = [
  { id: 'general', label: 'General request' },
  { id: 'creative', label: 'Creative brief' },
  { id: 'approval', label: 'Approval request' },
  { id: 'asset', label: 'Asset update' },
];

const CustomwidgetMainMenuItem = () => {
  const [form, setForm] = useState(initialForm);
  const [submittedOnce, setSubmittedOnce] = useState(false);
  const [submittedRequest, setSubmittedRequest] = useState(null);

  const selectedType = useMemo(
    () => requestTypes.find((type) => type.id === form.requestType),
    [form.requestType]
  );

  const errors = useMemo(() => {
    const nextErrors = {};

    if (!form.title.trim()) {
      nextErrors.title = 'Enter a request title.';
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
      ...form,
      requestTypeLabel: selectedType?.label || 'General request',
      submittedAt: new Date().toLocaleString(),
    });
  };

  const handleReset = () => {
    setForm(initialForm);
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
                Generic Workfront Form
              </Heading>
              <Text>
                Capture a generic request, validate the required fields, and preview the payload that can later be sent to Workfront or an App Builder action.
              </Text>
            </Flex>

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
                    >
                      {requestTypes.map((type) => (
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
                      Type: {selectedType?.label || 'General request'}
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
