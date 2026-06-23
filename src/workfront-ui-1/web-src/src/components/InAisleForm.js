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
import './InAisleForm.css';

const TASK_ID_PARAM_NAMES = ['taskId', 'taskID', 'taskid', 'task_id', 'ID', 'id', 'objID', 'objectID'];
const ACTION_PATH = '/api/v1/web/workfront-custom-widget/get-workfront-task';

const initialForm = {
  bookingId: '',
  channels: '',
  leadBrand: '',
  campaignStartDate: '',
  campaignEndDate: '',
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
  { id: 'in-aisle', label: 'IN AISLE request' },
  { id: 'general', label: 'General request' },
  { id: 'creative', label: 'Creative brief' },
  { id: 'approval', label: 'Approval request' },
  { id: 'asset', label: 'Asset update' },
];

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

const getActionUrl = () => {
  if (window.location.hostname === 'localhost') {
    return `http://localhost:9080${ACTION_PATH}`;
  }
  const namespace = window.location.hostname.replace('.adobeio-static.net', '');
  return `https://${namespace}.adobeioruntime.net${ACTION_PATH}`;
};

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
  bookingId: toText(getWorkfrontField(record, 'DE:Booking ID')),
  channels: toText(getWorkfrontField(record, 'DE:Channels')),
  leadBrand: toText(getWorkfrontField(record, 'DE:Lead Brand')),
  campaignStartDate: toDate(getWorkfrontField(record, 'DE:Campaign start date')),
  campaignEndDate: toDate(getWorkfrontField(record, 'DE:Campaign end date')),
  title: toText(getWorkfrontField(record, 'DE:Request title')),
  requestType: normalizeRequestType(getWorkfrontField(record, 'DE:Request type')),
  requestedBy: toText(getWorkfrontField(record, 'DE:Requested by')),
  dueDate: toDate(getWorkfrontField(record, 'DE:Target date')),
  description: toText(getWorkfrontField(record, 'DE:Request details')),
});

const InAisleForm = () => {
  const [form, setForm] = useState(initialForm);
  const [prefilledForm, setPrefilledForm] = useState(initialForm);
  const [taskId, setTaskId] = useState('');
  const [isLoadingTask, setIsLoadingTask] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [submittedOnce, setSubmittedOnce] = useState(false);

  useEffect(() => {
    const nextTaskId = getTaskIdFromUrl();
    setTaskId(nextTaskId);

    // If no task ID, show empty form (for testing)
    if (!nextTaskId) {
      setIsLoadingTask(false);
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

        const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
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

  if (loadError) {
    return (
      <Provider theme={defaultTheme} colorScheme="light">
        <View padding="size-200">
          <Well variant="negative">
            <Text>Error: {loadError}</Text>
          </Well>
        </View>
      </Provider>
    );
  }

  return (
    <Provider theme={defaultTheme} colorScheme="light">
      <div className="aisle-form-container">
        {/* Header Section */}
        <div className="aisle-header">
          <div className="aisle-header-content">
            <div className="aisle-logo">cartology</div>
            <h1 className="aisle-header-title">IN AISLE Request Brief</h1>
            <p className="aisle-header-subtitle">Please complete and return to: screencontent@cartology.com.au</p>
          </div>
        </div>

        {/* Form Content */}
        <div className="aisle-form-content">
          <Form>
            {/* Booking & Campaign Details */}
            <div className="aisle-section">
                 <h2 className="aisle-section-title">Booking & Campaign Details</h2>
              <div className="aisle-field-row">
                <div className="aisle-field-half">
                  <label className="aisle-label">Booking ID:</label>
                  <TextField
                    value={form.bookingId}
                    onChange={(v) => setForm({ ...form, bookingId: v })}
                    className="aisle-input"
                    width="100%"
                  />
                </div>
                <div className="aisle-field-half">
                  <label className="aisle-label">Channels:</label>
                  <TextField
                    value={form.channels}
                    onChange={(v) => setForm({ ...form, channels: v })}
                    className="aisle-input"
                    width="100%"
                  />
                </div>
              </div>
              <div className="aisle-field-row">
                <div className="aisle-field-half">
                  <label className="aisle-label">Lead Brand:</label>
                  <TextField
                    value={form.leadBrand}
                    onChange={(v) => setForm({ ...form, leadBrand: v })}
                    className="aisle-input"
                    width="100%"
                  />
                </div>
                <div className="aisle-field-half">
                  <label className="aisle-label">Campaign start date:</label>
                  <TextField
                    value={form.campaignStartDate}
                    onChange={(v) => setForm({ ...form, campaignStartDate: v })}
                    className="aisle-input"
                    width="100%"
                  />
                </div>
              </div>
              <div className="aisle-field-row">
                <div className="aisle-field-half">
                  <label className="aisle-label">Campaign end date:</label>
                  <TextField
                    value={form.campaignEndDate}
                    onChange={(v) => setForm({ ...form, campaignEndDate: v })}
                    className="aisle-input"
                    width="100%"
                  />
                </div>
              </div>
            </div>

            {/* General Information */}
            <div className="aisle-section">
              <h2 className="aisle-section-title">General Information</h2>
              
              <div className="aisle-field-row">
                <div className="aisle-field-half">
                  <label className="aisle-label">Client(s):</label>
                  <TextField
                    value={form.requestedBy}
                    onChange={(v) => setForm({ ...form, requestedBy: v })}
                    className="aisle-input"
                    width="100%"
                  />
                </div>
                <div className="aisle-field-half">
                  <label className="aisle-label">Communication pillar template:</label>
                  <TextField
                    value={form.campaignName}
                    onChange={(v) => setForm({ ...form, campaignName: v })}
                    className="aisle-input"
                    width="100%"
                  />
                </div>
              </div>

              <div className="aisle-field-row">
                <div className="aisle-field-half">
                  <label className="aisle-label">Brand/Product:</label>
                  <TextField
                    value={form.brand}
                    onChange={(v) => setForm({ ...form, brand: v })}
                    className="aisle-input"
                    width="100%"
                  />
                </div>
                <div className="aisle-field-half">
                  <label className="aisle-label">Other:</label>
                  <TextField
                    className="aisle-input"
                    width="100%"
                  />
                </div>
              </div>

              <div className="aisle-field-row">
                <div className="aisle-field-half">
                  <label className="aisle-label">In Market Date:</label>
                  <TextField
                    value={form.dueDate}
                    onChange={(v) => setForm({ ...form, dueDate: v })}
                    className="aisle-input"
                    width="100%"
                  />
                </div>
                <div className="aisle-field-half">
                  <label className="aisle-label">Screen Content option:</label>
                  <TextField
                    className="aisle-input"
                    width="100%"
                  />
                </div>
              </div>

              <div className="aisle-field-row">
                <div className="aisle-field-half">
                  <label className="aisle-label">Client contact:</label>
                  <TextField
                    className="aisle-input"
                    width="100%"
                  />
                </div>
                <div className="aisle-field-half">
                  <label className="aisle-label">Other:</label>
                  <TextField
                    className="aisle-input"
                    width="100%"
                  />
                </div>
              </div>

              <div className="aisle-field-full">
                <label className="aisle-label">Supporting Cartology assets booked:</label>
                <TextArea
                  className="aisle-textarea"
                  width="100%"
                  minHeight="80px"
                />
              </div>
            </div>

            {/* Product / Promotional Details */}
            <div className="aisle-section">
              <h2 className="aisle-section-title">Product / Promotional Details</h2>
              
              <div className="aisle-field-row">
                <div className="aisle-field-half">
                  <label className="aisle-label">Hero Product Name / SKU number:</label>
                  <TextField
                    className="aisle-input"
                    width="100%"
                  />
                </div>
                <div className="aisle-field-half">
                  <label className="aisle-label">Department Product Stocked in:</label>
                  <TextField
                    className="aisle-input"
                    width="100%"
                  />
                </div>
              </div>

              <div className="aisle-field-row">
                <div className="aisle-field-half">
                  <label className="aisle-label">Percentage of stores products ranged in:</label>
                  <TextField
                    className="aisle-input"
                    width="100%"
                  />
                </div>
                <div className="aisle-field-half">
                  <label className="aisle-label">Promotion dates:</label>
                  <TextField
                    className="aisle-input"
                    width="100%"
                  />
                </div>
              </div>

              <div className="aisle-field-full">
                <label className="aisle-label">Full Product Description and Size (e.g. Masterfoods Tomato Sauce 500mL):</label>
                <small className="aisle-helper-text">Must be identical to information in SAP.</small>
                <TextArea
                  value={form.description}
                  onChange={(v) => setForm({ ...form, description: v })}
                  className="aisle-textarea"
                  width="100%"
                  minHeight="80px"
                />
              </div>

              <div className="aisle-field-full">
                <label className="aisle-label">Additional SKUs to be featured:</label>
                <small className="aisle-helper-text">Maximum 2 additional packshots</small>
                <TextArea
                  className="aisle-textarea"
                  width="100%"
                  minHeight="80px"
                />
              </div>

              <div className="aisle-field-full">
                <label className="aisle-label">Promotion details:</label>
                <small className="aisle-helper-text">i.e. ½ Price, 30% Off</small>
                <TextArea
                  className="aisle-textarea"
                  width="100%"
                  minHeight="80px"
                />
              </div>
            </div>

            {/* Request Details */}
            <div className="aisle-section">
              <h2 className="aisle-section-title">Additional Information</h2>
              
              <div className="aisle-field-full">
                <label className="aisle-label">Product Claims:</label>
                <small className="aisle-helper-text">List the claims that will be featured on screen or on product packing</small>
                <TextArea
                  value={form.additionalNotes}
                  onChange={(v) => setForm({ ...form, additionalNotes: v })}
                  className="aisle-textarea"
                  width="100%"
                  minHeight="80px"
                />
              </div>
            </div>

            {/* Product Claims Details */}
            <div className="aisle-section">
              <h2 className="aisle-section-title">Product Claims</h2>
              
              <p className="aisle-description">
                It is your responsibility to ensure that the information provided in this brief complies with all relevant laws, regulatory requirements and industry guidelines. Content submitted must be accurate, legally compliant and substantiated upon request. To avoid delays, you can provide documentation to substantiate any claims made about the product being advertised when submitting your brief.
              </p>
              <p className="aisle-description">
                You are also responsible for ensuring that:
              </p>
              <ul className="aisle-list">
                <li>any third party clearance, where required, is obtained; and</li>
                <li>any disclaimers or conditions are included on the advertisement where required.</li>
              </ul>
              
              <div className="aisle-field-full">
                <label className="aisle-label">Product claims</label>
                <small className="aisle-helper-text">List the claims that will be featured on screen or on product packing</small>
                <TextArea
                  className="aisle-textarea"
                  width="100%"
                  minHeight="100px"
                />
              </div>
            </div>

            {/* Third Party References */}
            <div className="aisle-section">
              <h2 className="aisle-section-title">Third Party References</h2>
              
              <p className="aisle-description">
                It is your responsibility to ensure that any third party references in this promotion – such as third party brand assets and third party events – are authorised. Third party references are subject to approval by Cartology.
              </p>
              <p className="aisle-description">
                You may be required to provide written documentation to demonstrate that you are authorised to use third party brand assets and to confirm that this advertisement does not constitute ambush marketing. If, for example, you want to promote your sponsorship of XX Sporting Event, you may be required to provide written documentation from XX Sporting Event authorising the promotion of this advertisement through the Cartology Screen Network.
              </p>
              
              <div className="aisle-field-full">
                <label className="aisle-label">Specify any third party references</label>
                <TextArea
                  className="aisle-textarea"
                  width="100%"
                  minHeight="100px"
                />
              </div>
            </div>

            {/* Therapeutic Goods */}
            <div className="aisle-section">
              <h2 className="aisle-section-title">Therapeutic Goods</h2>
              
              <p className="aisle-description">
                You are responsible for ensuring that the advertisement complies with the Therapeutic Goods Advertising Code (No 2). Please ensure that you include all mandatory disclaimers and obtain any relevant approvals where required.
              </p>
              
              <div className="aisle-field-full">
                <label className="aisle-label">Therapeutic Goods</label>
                <small className="aisle-helper-text">Please specify relevant warnings and disclaimers</small>
                <TextArea
                  className="aisle-textarea"
                  width="100%"
                  minHeight="100px"
                />
              </div>
            </div>

            {/* On Screen Disclaimers */}
            <div className="aisle-section">
              <h2 className="aisle-section-title">On Screen Disclaimers</h2>
              
              <p className="aisle-description">
                Please ensure all appropriate disclaimers are included. For example, trade promotion T&Cs / offer conditions / claim qualifications / regulatory disclaimers such as those required for therapeutic goods.
              </p>
              <p className="aisle-description" style={{ fontWeight: '600', marginTop: '16px' }}>
                Application guidelines:
              </p>
              <ul className="aisle-list">
                <li>Standard Woolworths disclaimer required on all executions</li>
                <li>Additional disclaimers must be on screen for 0.2 seconds per word in minimum 9pt font Font recommendation is &lt;Arial&gt; (for consistency across screens)</li>
                <li>Disclaimer greater than 50 words must be reviewed by Woolworths</li>
              </ul>
              
              <div className="aisle-field-full">
                <label className="aisle-label">Disclaimers</label>
                <small className="aisle-helper-text">Supplier brand and/or product disclaimers</small>
                <TextArea
                  className="aisle-textarea"
                  width="100%"
                  minHeight="120px"
                />
              </div>
            </div>

            {/* Acknowledgement */}
            <div className="aisle-section">
              <h2 className="aisle-section-title">Acknowledgement</h2>
              
              <p className="aisle-description">
                By submitting this brief, I confirm and warrant that the content provided:
              </p>
              <ul className="aisle-list">
                <li>a. is accurate, complete, not misleading and can be substantiated upon request;</li>
                <li>b. complies with all applicable laws, regulations and codes, including the Australian Consumer Law and industry codes of practice (such as the AANA Code of Ethics, the Therapeutic Goods Advertising Code (No 2), and the Alcohol Beverages Advertising Code);</li>
                <li>c. does not infringe the intellectual property rights, moral rights or any other rights of any person; and</li>
                <li>d. complies with the Cartology Digital Screen Network Specifications & Guidelines</li>
              </ul>
              <p className="aisle-description">
                I also warrant that I have the authority to make the above representations and to enter into these obligations on behalf of the Client.
              </p>
              
              <div className="aisle-field-full">
                <label className="aisle-label">Acknowledgement</label>
                <Checkbox
                  isSelected={form.notifyRequester}
                  onChange={(checked) => setForm({ ...form, notifyRequester: checked })}
                >
                  <span>I confirm and warrant the statements above</span>
                </Checkbox>
              </div>
            </div>

            {/* Buttons */}
            <div className="aisle-section aisle-buttons">
              <Flex gap="size-200">
                <Button
                  variant="cta"
                  onPress={handleSubmit}
                >
                  Submit Request
                </Button>

                {isFormModified && (
                  <Button variant="secondary" onPress={handleReset}>
                    Reset Form
                  </Button>
                )}
              </Flex>

              {submittedOnce && hasErrors && (
                <View marginTop="size-200">
                  <StatusLight variant="negative">
                    Please fill in all required fields before submitting.
                  </StatusLight>
                </View>
              )}
            </div>
          </Form>
        </div>
      </div>
    </Provider>
  );
};

export default InAisleForm;
