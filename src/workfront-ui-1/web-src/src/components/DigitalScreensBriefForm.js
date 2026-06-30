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

const communicationPillarOptions = [
  { id: 'Special', label: 'Special' },
  { id: 'New', label: 'New' },
  { id: 'Try This', label: 'Try This' },
  { id: 'Generic (WW)', label: 'Generic (WW)' },
  { id: 'Event', label: 'Event' },
  { id: 'No Pillar', label: 'No Pillar' },
];

const screenContentOptions = [
  { id: 'Value Package', label: 'Value Package' },
  { id: 'Brand Package', label: 'Brand Package' },
  { id: 'Hybrid Package', label: 'Hybrid Package' },
];

const TASK_ID_PARAM_NAMES = ['taskId', 'taskID', 'taskid', 'task_id', 'ID', 'id', 'objID', 'objectID'];

const ACTION_PATH = '/api/v1/web/workfront-custom-widget/get-workfront-task';

const initialForm = {
  bookingId: '',
  channels: '',
  leadBrand: '',
  campaignStartDate: '',
  campaignEndDate: '',

  // General Information
  clientAgency: '',
  brandProduct: '',
  inMarketDate: '',
  clientContact: '',
  communicationPillar: '',
  brandProductOther: '',
  screenContentOption: '',
  screenContentOptionOther: '',
  supportingAssetsBooked: '',

  // Product/Promotional Details
  heroProductNameSku: '',
  deptProductStockedIn: '',
  percentStoresRanged: '',
  promotionDates: '',
  productDescriptionSize: '',
  additionalSkus: '',
  promotionDetails: '',

  // Product Claims
  productClaims: '',

  // Third Party References
  thirdPartyReferences: '',

  // Therapeutic Goods
  therapeuticGoods: '',

  // On Screen Disclaimers
  disclaimers: '',

  // Acknowledgement
  acknowledged: false,
};

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

const mapTaskRecordToForm = (record) => {
  const channelsVal = getWorkfrontField(record, 'DE:channels');
  const channelsStr = Array.isArray(channelsVal) ? channelsVal.join(', ') : toText(channelsVal);

  return {
    ...initialForm,
    bookingId: toText(getWorkfrontField(record, 'DE:bookingId')),
    channels: channelsStr,
    leadBrand: toText(getWorkfrontField(record, 'DE:leadBrand')),
    campaignStartDate: toDate(getWorkfrontField(record, 'DE:campaignStartDate')),
    campaignEndDate: toDate(getWorkfrontField(record, 'DE:campaignEndDate')),
  };
};

/* ---------- Component ---------- */

const DigitalScreensBriefForm = () => {
  const [form, setForm] = useState(initialForm);
  const [prefilledForm, setPrefilledForm] = useState(initialForm);
  const [taskId, setTaskId] = useState('');
  const [isLoadingTask, setIsLoadingTask] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [submittedOnce, setSubmittedOnce] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const pillarOptions = useMemo(() => {
    const hasSelected = communicationPillarOptions.some((t) => t.id === form.communicationPillar);
    if (!form.communicationPillar || hasSelected) return communicationPillarOptions;
    return [...communicationPillarOptions, { id: form.communicationPillar, label: form.communicationPillar }];
  }, [form.communicationPillar]);

  const contentOptions = useMemo(() => {
    const hasSelected = screenContentOptions.some((t) => t.id === form.screenContentOption);
    if (!form.screenContentOption || hasSelected) return screenContentOptions;
    return [...screenContentOptions, { id: form.screenContentOption, label: form.screenContentOption }];
  }, [form.screenContentOption]);

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

  const errors = useMemo(() => {
    const e = {};
    if (!form.clientAgency.trim()) e.clientAgency = 'Client/Agency is required.';
    if (!form.brandProduct.trim()) e.brandProduct = 'Brand/Product is required.';
    if (!form.inMarketDate.trim()) e.inMarketDate = 'In Market Date is required.';
    if (!form.acknowledged) e.acknowledged = 'You must acknowledge the terms to submit.';
    return e;
  }, [form]);

  const hasErrors = Object.keys(errors).length > 0;
  const isFormModified = JSON.stringify(form) !== JSON.stringify(prefilledForm);

  const handleSubmit = async () => {
    setSubmittedOnce(true);
    if (!hasErrors) {
      setIsSubmitting(true);
      setSubmitError('');
      try {
        const payload = await actionWebInvoke(
          getActionUrl(),
          {},
          {
            taskId: taskId,
            updates: {
              'DE:clients': form.clientAgency,
              'DE:communicationPillarTemplate': form.communicationPillar,
              'DE:brandProduct': form.brandProduct,
              'DE:inMarketDate': form.inMarketDate,
              'DE:screenContentOption': form.screenContentOption,
              'DE:other': form.brandProductOther || form.screenContentOptionOther,
              'DE:clientContact': form.clientContact,
              'DE:supportingCartologyAssetsBooked': form.supportingAssetsBooked,
              'DE:departmentProductStockedIn': form.deptProductStockedIn,
              'DE:heroProductNameSkuNumber': form.heroProductNameSku,
              'DE:percentageOfStoresProductsRangedIn': form.percentStoresRanged,
              'DE:fullProductDescriptionAndSize': form.productDescriptionSize,
              'DE:additionalSkusToBeFeatured': form.additionalSkus,
              'DE:promotionDetails': form.promotionDetails,
              'DE:productClaims': form.productClaims,
              'DE:specifyAnyThirdPartyReferences': form.thirdPartyReferences,
              'DE:therapeuticGoods': form.therapeuticGoods,
              'DE:disclaimers': form.disclaimers,
            },
          },
          { method: 'PUT' },
        );

        let data = typeof payload === 'string' ? JSON.parse(payload) : payload;
        if (data && data.error) throw new Error(data.error);

        setIsSuccess(true);
      } catch (error) {
        setSubmitError(error.message || 'Unable to update task details in Workfront.');
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
        <Heading level={3}>Digital Screens Brief Form</Heading>

        {taskId && (
          <Text UNSAFE_style={{ color: '#666', marginTop: '8px', fontSize: '0.85em' }}>
            Task ID: {taskId}
          </Text>
        )}

        <Divider size="S" marginTop="size-200" marginBottom="size-200" />

        {isSuccess ? (
          <Well variant="positive" marginTop="size-200" marginBottom="size-200">
            <Heading level={4}>Brief Submitted Successfully!</Heading>
            <Text>Thank you for submitting the Digital Screens Content Brief.</Text>
            <Flex marginTop="size-200">
              <Button variant="secondary" onPress={handleReset}>Fill Another / Edit</Button>
            </Flex>
          </Well>
        ) : (
          <Form labelPosition="top">
            {/* Prefilled Fields at the top */}
            <Heading level={4} marginTop="size-100">Prefilled Workfront Data</Heading>
            <Flex gap="size-200" wrap marginBottom="size-200">
              <TextField
                label="Booking ID"
                value={form.bookingId}
                isDisabled
                width="size-2000"
              />
              <TextField
                label="Channels"
                value={form.channels}
                isDisabled
                width="size-2000"
              />
              <TextField
                label="Lead Brand"
                value={form.leadBrand}
                isDisabled
                width="size-2000"
              />
              <TextField
                label="Campaign Start Date"
                value={form.campaignStartDate}
                isDisabled
                width="size-2000"
              />
              <TextField
                label="Campaign End Date"
                value={form.campaignEndDate}
                isDisabled
                width="size-2000"
              />
            </Flex>

            <Divider size="S" marginBottom="size-200" />

            {/* Section 1: General Information */}
            <Heading level={4}>General Information</Heading>
            <Text UNSAFE_style={{ fontSize: '0.85em', color: '#666', marginBottom: '8px' }}>
              Please complete and return to: screencontent@cartology.com.au
            </Text>
            <Flex gap="size-200" wrap>
              <TextField
                label="Client(s)"
                value={form.clientAgency}
                onChange={(v) => setForm({ ...form, clientAgency: v })}
                errorMessage={submittedOnce && errors.clientAgency}
                validationState={submittedOnce && errors.clientAgency ? 'invalid' : 'valid'}
                isRequired
                width="48%"
              />
              <Picker
                label="Communication pillar template"
                items={pillarOptions}
                selectedKey={form.communicationPillar}
                onSelectionChange={(key) => setForm({ ...form, communicationPillar: key })}
                width="48%"
              >
                {(item) => <Item key={item.id}>{item.label}</Item>}
              </Picker>
              <TextField
                label="Brand/Product"
                value={form.brandProduct}
                onChange={(v) => setForm({ ...form, brandProduct: v })}
                errorMessage={submittedOnce && errors.brandProduct}
                validationState={submittedOnce && errors.brandProduct ? 'invalid' : 'valid'}
                isRequired
                width="48%"
              />
              <TextField
                label="Other (Brand/Product)"
                value={form.brandProductOther}
                onChange={(v) => setForm({ ...form, brandProductOther: v })}
                width="48%"
              />
              <TextField
                label="In Market Date"
                value={form.inMarketDate}
                onChange={(v) => setForm({ ...form, inMarketDate: v })}
                errorMessage={submittedOnce && errors.inMarketDate}
                validationState={submittedOnce && errors.inMarketDate ? 'invalid' : 'valid'}
                isRequired
                width="48%"
              />
              <Picker
                label="Screen Content option"
                items={contentOptions}
                selectedKey={form.screenContentOption}
                onSelectionChange={(key) => setForm({ ...form, screenContentOption: key })}
                width="48%"
              >
                {(item) => <Item key={item.id}>{item.label}</Item>}
              </Picker>
              <TextField
                label="Client contact"
                value={form.clientContact}
                onChange={(v) => setForm({ ...form, clientContact: v })}
                width="48%"
              />
              <TextField
                label="Other (Screen Content option)"
                value={form.screenContentOptionOther}
                onChange={(v) => setForm({ ...form, screenContentOptionOther: v })}
                width="48%"
              />
            </Flex>

            <TextArea
              label="Supporting Cartology assets booked"
              value={form.supportingAssetsBooked}
              onChange={(v) => setForm({ ...form, supportingAssetsBooked: v })}
              width="100%"
              marginTop="size-100"
            />

            <Divider size="S" marginTop="size-200" marginBottom="size-200" />

            {/* Section 2: Product / Promotional Details */}
            <Heading level={4}>Product / Promotional Details</Heading>
            <Flex gap="size-200" wrap>
              <TextField
                label="Hero Product Name / SKU number"
                value={form.heroProductNameSku}
                onChange={(v) => setForm({ ...form, heroProductNameSku: v })}
                width="48%"
              />
              <TextField
                label="Department Product Stocked in"
                value={form.deptProductStockedIn}
                onChange={(v) => setForm({ ...form, deptProductStockedIn: v })}
                width="48%"
              />
              <TextField
                label="Percentage of stores products ranged in"
                value={form.percentStoresRanged}
                onChange={(v) => setForm({ ...form, percentStoresRanged: v })}
                width="48%"
              />
              <TextField
                label="Promotion dates"
                value={form.promotionDates}
                onChange={(v) => setForm({ ...form, promotionDates: v })}
                width="48%"
              />
            </Flex>

            <TextArea
              label="Full Product Description and Size"
              description="Must be identical to information in SAP (e.g. Masterfoods Tomato Sauce 500mL)."
              value={form.productDescriptionSize}
              onChange={(v) => setForm({ ...form, productDescriptionSize: v })}
              width="100%"
              marginTop="size-100"
            />

            <TextArea
              label="Additional SKUs to be featured"
              description="Maximum 2 additional packshots."
              value={form.additionalSkus}
              onChange={(v) => setForm({ ...form, additionalSkus: v })}
              width="100%"
              marginTop="size-100"
            />

            <TextArea
              label="Promotion details"
              description="i.e. ½ Price. 30% Off."
              value={form.promotionDetails}
              onChange={(v) => setForm({ ...form, promotionDetails: v })}
              width="100%"
              marginTop="size-100"
            />

            <Divider size="S" marginTop="size-200" marginBottom="size-200" />

            {/* Section 3: Product Claims */}
            <Heading level={4}>Product Claims</Heading>
            <Text UNSAFE_style={{ fontSize: '0.85em', color: '#666', marginBottom: '8px' }}>
              It is your responsibility to ensure that the information provided in this brief complies with all relevant laws, regulatory requirements and industry guidelines. Content submitted must be accurate, legally compliant and substantiated upon request. To avoid delays, you can provide documentation to substantiate any claims made about the product being advertised when submitting your brief.
              <br /><br />
              You are also responsible for ensuring that:
              <br />
              • any third party clearance, where required, is obtained; and
              <br />
              • any disclaimers or conditions are included on the advertisement where required.
            </Text>
            <TextArea
              label="Product claims"
              description="List the claims that will be featured on screen or on product packing."
              value={form.productClaims}
              onChange={(v) => setForm({ ...form, productClaims: v })}
              width="100%"
            />

            <Divider size="S" marginTop="size-200" marginBottom="size-200" />

            {/* Section 4: Third Party References */}
            <Heading level={4}>Third Party References</Heading>
            <Text UNSAFE_style={{ fontSize: '0.85em', color: '#666', marginBottom: '8px' }}>
              It is your responsibility to ensure that any third party references in this promotion – such as third party brand assets and third party events – are authorised. Third party references are subject to approval by Cartology.
              <br /><br />
              You may be required to provide written documentation to demonstrate that you are authorised to use third party brand assets and to confirm that this advertisement does not constitute ambush marketing. If, for example, you want to promote your sponsorship of XX Sporting Event, you may be required to provide written documentation from XX Sporting Event authorising the promotion of this advertisement through the Cartology Screen Network.
            </Text>
            <TextArea
              label="Specify any third party references"
              value={form.thirdPartyReferences}
              onChange={(v) => setForm({ ...form, thirdPartyReferences: v })}
              width="100%"
            />

            <Divider size="S" marginTop="size-200" marginBottom="size-200" />

            {/* Section 5: Therapeutic Goods */}
            <Heading level={4}>Therapeutic Goods</Heading>
            <Text UNSAFE_style={{ fontSize: '0.85em', color: '#666', marginBottom: '8px' }}>
              You are responsible for ensuring that the advertisement complies with the Therapeutic Goods Advertising Code (No 2). Please ensure that you include all mandatory disclaimers and obtain any relevant approvals where required.
            </Text>
            <TextArea
              label="Therapeutic Goods"
              description="Please specify relevant warnings and disclaimers."
              value={form.therapeuticGoods}
              onChange={(v) => setForm({ ...form, therapeuticGoods: v })}
              width="100%"
            />

            <Divider size="S" marginTop="size-200" marginBottom="size-200" />

            {/* Section 6: On Screen Disclaimers */}
            <Heading level={4}>On Screen Disclaimers</Heading>
            <Text UNSAFE_style={{ fontSize: '0.85em', color: '#666', marginBottom: '8px' }}>
              Please ensure all appropriate disclaimers are included. For example, trade promotion T&Cs / offer conditions / claim qualifications / regulatory disclaimers such as those required for therapeutic goods.
              <br /><br />
              Application guidelines:
              <br />
              • Standard Woolworths disclaimer required on all executions
              <br />
              • Additional disclaimers must be on screen for 0.2 seconds per word in minimum 9pt font. Font recommendation is Arial (for consistency across screens)
              <br />
              • Disclaimer greater than 50 words must be reviewed by Woolworths
            </Text>
            <TextArea
              label="Disclaimers"
              description="Supplier brand and/or product disclaimers."
              value={form.disclaimers}
              onChange={(v) => setForm({ ...form, disclaimers: v })}
              width="100%"
            />

            <Divider size="S" marginTop="size-200" marginBottom="size-200" />

            {/* Section 7: Acknowledgement */}
            <Heading level={4}>Acknowledgement</Heading>
            <Well>
              <Text UNSAFE_style={{ fontSize: '0.85em', display: 'block', marginBottom: '12px' }}>
                By submitting this brief, I confirm and warrant that the content provided:
                <br />
                • a. is accurate, complete, not misleading and can be substantiated upon request;
                <br />
                • b. complies with all applicable laws, regulations and codes, including the Australian Consumer Law and industry codes of practice (such as the AANA Code of Ethics, the Therapeutic Goods Advertising Code (No 2), and the Alcohol Beverages Advertising Code);
                <br />
                • c. does not infringe the intellectual property rights, moral rights or any other rights of any person; and
                <br />
                • d. complies with the Cartology Digital Screen Network Specifications & Guidelines.
                <br /><br />
                I also warrant that I have the authority to make the above representations and to enter into these obligations on behalf of the Client.
              </Text>
              <Checkbox
                isSelected={form.acknowledged}
                onChange={(checked) => setForm({ ...form, acknowledged: checked })}
                errorMessage={submittedOnce && errors.acknowledged}
                validationState={submittedOnce && errors.acknowledged ? 'invalid' : 'valid'}
                isRequired
              >
                I confirm and agree to the acknowledgement terms.
              </Checkbox>
            </Well>

            <Divider size="S" marginTop="size-200" marginBottom="size-200" />

            {/* Submit and Action Buttons */}
            <Flex gap="size-150" alignItems="center">
              <Button
                variant="primary"
                onPress={handleSubmit}
                isDisabled={isSubmitting || (submittedOnce && hasErrors)}
              >
                Submit Brief
              </Button>
              {isFormModified && !isSubmitting && (
                <Button variant="secondary" onPress={handleReset}>
                  Reset Form
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
              <View marginTop="size-150">
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

export default DigitalScreensBriefForm;
