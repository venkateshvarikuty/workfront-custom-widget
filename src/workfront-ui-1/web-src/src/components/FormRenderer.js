import React from 'react';
import {
  TextField,
  TextArea,
  Picker,
  Item,
  Checkbox,
  Flex,
  Heading,
  Divider,
  View,
  Text,
} from '@adobe/react-spectrum';

/**
 * FormRenderer - A reusable dynamic form renderer component
 * 
 * Props:
 *  - config: The JSON configuration defining sections and fields
 *  - formData: Object containing current form field values
 *  - onChange: Callback function (fieldName, newValue) to update form state
 *  - errors: Object containing validation errors
 *  - submittedOnce: Boolean flag indicating if form has been submitted
 */
const FormRenderer = ({ config, formData, onChange, errors, submittedOnce }) => {
  if (!config || !config.sections) {
    return <Text>Invalid form configuration.</Text>;
  }

  return (
    <View width="100%">
      {config.sections.map((section, sectionIdx) => (
        <View key={sectionIdx} marginBottom="size-300">
          {section.title && (
            <View marginBottom="size-150">
              <Heading level={3} marginTop="size-200" marginBottom="size-50">
                {section.title}
              </Heading>
              <Divider size="S" />
            </View>
          )}

          <Flex direction="column" gap="size-150" marginBottom="size-200">
            {section.fields.map((field) => {
              const fieldError = submittedOnce && errors[field.name] ? errors[field.name] : '';
              const validationState = fieldError ? 'invalid' : 'valid';

              switch (field.type) {
                case 'text':
                  return (
                    <TextField
                      key={field.name}
                      label={field.label}
                      value={formData[field.name] || ''}
                      onChange={(value) => onChange(field.name, value)}
                      errorMessage={fieldError}
                      validationState={validationState}
                      isRequired={field.required}
                      width="100%"
                    />
                  );

                case 'textarea':
                  return (
                    <TextArea
                      key={field.name}
                      label={field.label}
                      value={formData[field.name] || ''}
                      onChange={(value) => onChange(field.name, value)}
                      errorMessage={fieldError}
                      validationState={validationState}
                      isRequired={field.required}
                      width="100%"
                    />
                  );

                case 'date':
                  return (
                    <TextField
                      key={field.name}
                      label={field.label}
                      placeholder="YYYY-MM-DD"
                      value={formData[field.name] || ''}
                      onChange={(value) => onChange(field.name, value)}
                      errorMessage={fieldError}
                      validationState={validationState}
                      isRequired={field.required}
                      width="100%"
                    />
                  );

                case 'dropdown': {
                  const options = field.options || [];
                  // Find if the currently selected key is in the options.
                  // If not and there is a value, dynamically add it to prevent picker selection mismatch.
                  const hasSelected = options.some((opt) => opt.id === formData[field.name]);
                  const normalizedOptions = 
                    formData[field.name] && !hasSelected
                      ? [...options, { id: formData[field.name], label: formData[field.name] }]
                      : options;

                  return (
                    <Picker
                      key={field.name}
                      label={field.label}
                      items={normalizedOptions}
                      selectedKey={formData[field.name] || ''}
                      onSelectionChange={(key) => onChange(field.name, key)}
                      errorMessage={fieldError}
                      validationState={validationState}
                      isRequired={field.required}
                      width="100%"
                    >
                      {(item) => <Item key={item.id}>{item.label}</Item>}
                    </Picker>
                  );
                }

                case 'checkbox':
                  return (
                    <Flex key={field.name} direction="column" gap="size-50">
                      <Checkbox
                        isSelected={!!formData[field.name]}
                        onChange={(checked) => onChange(field.name, checked)}
                        isRequired={field.required}
                        validationState={validationState}
                      >
                        {field.label}
                      </Checkbox>
                      {fieldError && (
                        <Text UNSAFE_style={{ color: '#d7373f', fontSize: '0.85em', marginTop: '-4px' }}>
                          {fieldError}
                        </Text>
                      )}
                    </Flex>
                  );

                default:
                  return null;
              }
            })}
          </Flex>
        </View>
      ))}
    </View>
  );
};

export default FormRenderer;
