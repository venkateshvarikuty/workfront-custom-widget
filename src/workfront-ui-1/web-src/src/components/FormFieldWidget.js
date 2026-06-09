import React, { useEffect, useState } from 'react';
import {
  defaultTheme,
  Flex,
  Provider,
  Text,
  TextField,
  TextArea,
  Picker,
  Item,
  View,
  Heading,
  Button,
  Well,
} from '@adobe/react-spectrum';

/**
 * FormFieldWidget - Custom field widget for Workfront forms
 * Displays data and allows form interactions
 */
const FormFieldWidget = () => {
  const [fieldValue, setFieldValue] = useState('');
  const [fieldData, setFieldData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Get URL parameters to identify the field and context
  const getFieldContext = () => {
    const params = new URLSearchParams(window.location.search);
    return {
      fieldId: params.get('fieldId'),
      objectId: params.get('objectId'),
      objectType: params.get('objectType'),
      fieldType: params.get('fieldType'),
    };
  };

  // Initialize field with context data
  useEffect(() => {
    const context = getFieldContext();
    if (context.fieldId) {
      setLoading(true);
      try {
        // Fetch field data based on context
        // This would typically call a backend action or Workfront API
        setFieldData({
          fieldId: context.fieldId,
          objectId: context.objectId,
          objectType: context.objectType,
          fieldType: context.fieldType,
          value: fieldValue,
        });
        setLoading(false);
      } catch (err) {
        setError('Failed to load field data');
        setLoading(false);
      }
    }
  }, []);

  // Handle field value changes
  const handleFieldChange = (newValue) => {
    setFieldValue(newValue);
    // Notify parent form of change
    if (window.parent) {
      window.parent.postMessage(
        {
          type: 'fieldValueChanged',
          fieldId: fieldData?.fieldId,
          value: newValue,
          timestamp: new Date().toISOString(),
        },
        '*'
      );
    }
  };

  // Render different field types
  const renderFieldWidget = () => {
    const context = getFieldContext();
    
    switch (context.fieldType) {
      case 'textarea':
      case 'paragraph':
        return (
          <TextArea
            label="Field Value"
            value={fieldValue}
            onChange={handleFieldChange}
            placeholder="Enter text content"
            width="100%"
            minHeight="120px"
          />
        );
      case 'dropdown':
        return (
          <Picker
            label="Select Option"
            selectedKey={fieldValue}
            onSelectionChange={handleFieldChange}
            width="100%"
          >
            <Item key="option1">Option 1</Item>
            <Item key="option2">Option 2</Item>
            <Item key="option3">Option 3</Item>
          </Picker>
        );
      case 'text':
      case 'default':
      default:
        return (
          <TextField
            label="Field Value"
            value={fieldValue}
            onChange={handleFieldChange}
            placeholder="Enter field value"
            width="100%"
          />
        );
    }
  };

  return (
    <Provider theme={defaultTheme}>
      <View padding="size-300">
        <Heading level={2}>Custom Form Field Widget</Heading>
        
        {error && (
          <Well variant="negative" marginBottom="size-200">
            <Text>{error}</Text>
          </Well>
        )}

        {loading ? (
          <Text>Loading field data...</Text>
        ) : (
          <Flex direction="column" gap="size-200">
            {renderFieldWidget()}
            
            <Well variant="info" marginTop="size-200">
              <Flex direction="column" gap="size-100">
                <Text>
                  <strong>Field ID:</strong> {fieldData?.fieldId || 'Not specified'}
                </Text>
                <Text>
                  <strong>Object Type:</strong> {fieldData?.objectType || 'Not specified'}
                </Text>
                <Text>
                  <strong>Field Type:</strong> {fieldData?.fieldType || 'text'}
                </Text>
              </Flex>
            </Well>

            <Flex gap="size-100">
              <Button variant="cta" onPress={() => handleFieldChange(fieldValue)}>
                Save Field Value
              </Button>
              <Button variant="secondary" onPress={() => setFieldValue('')}>
                Clear
              </Button>
            </Flex>
          </Flex>
        )}
      </View>
    </Provider>
  );
};

export default FormFieldWidget;
