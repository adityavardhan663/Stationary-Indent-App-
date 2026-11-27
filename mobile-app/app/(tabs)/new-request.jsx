import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import client from '../../src/api/client';
import { authenticateBiometrics } from '../../src/biometrics/confirm';
import { getSecureToken } from '../../src/auth/storage';
import { getInstallationDeviceId } from '../../src/auth/deviceId';
import { colors, radii, spacing, typography, layout } from '../../src/theme';
import Card from '../../src/components/Card';
import PrimaryButton from '../../src/components/PrimaryButton';
import StatusBadge from '../../src/components/StatusBadge';
import EmptyState from '../../src/components/EmptyState';
import LoadingState from '../../src/components/LoadingState';

const NEEDED_WITHIN_CHIPS = [
  { label: '1 day', days: 1 },
  { label: '2 days', days: 2 },
  { label: '3 days', days: 3 },
  { label: '5 days', days: 5 },
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: '1 month', days: 30 }
];

function formatNeededBy(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function NewRequestScreen() {
  const router = useRouter();

  // Wizard Step: 1: Items, 2: Details, 3: Review, 4: Success
  const [step, setStep] = useState(1);

  // Step 1: Items & Cart
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // Step 2: Requisition Details
  const [urgency, setUrgency] = useState('Normal'); // 'Urgent' | 'Normal' | 'Not urgent'
  const [neededWithin, setNeededWithin] = useState('3 days');
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  const [inlineError, setInlineError] = useState('');

  // Step 3 & 4: Submission & Success
  const [submitting, setSubmitting] = useState(false);
  const [submittedIndent, setSubmittedIndent] = useState(null);

  const fetchItems = async () => {
    const token = await getSecureToken('authToken');
    if (!token) return;

    setLoadingItems(true);
    try {
      const res = await client.get('/items');
      setItems(res.data?.data || []);
    } catch (err) {
      Alert.alert('Store Notice', 'Unable to fetch stationery inventory catalogue.');
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const selectedDays = NEEDED_WITHIN_CHIPS.find((c) => c.label === neededWithin)?.days || 3;
  const computedNeededByDate = formatNeededBy(selectedDays);

  // Stepper logic: min 1, max = available stock (or maxPerIndent if lower)
  const updateCartQty = (item, delta) => {
    const existing = cart.find((c) => c.itemId === item._id);
    const availableStock = typeof item.stock === 'number' ? item.stock : 999;
    const maxAllowed = item.maxPerIndent ? Math.min(availableStock, item.maxPerIndent) : availableStock;

    if (!existing && delta > 0) {
      if (maxAllowed < 1) {
        Alert.alert('Out of Stock', `'${item.name}' is currently unavailable in store inventory.`);
        return;
      }
      setCart([
        ...cart,
        {
          itemId: item._id,
          name: item.name,
          code: item.code,
          unit: item.unit || 'units',
          stock: availableStock,
          maxAllowed,
          qty: 1
        }
      ]);
    } else if (existing) {
      const newQty = existing.qty + delta;
      if (newQty <= 0) {
        setCart(cart.filter((c) => c.itemId !== item._id));
      } else if (newQty > existing.maxAllowed) {
        Alert.alert(
          'Maximum Stock Limit',
          `Maximum available quantity for '${existing.name}' is ${existing.maxAllowed} ${existing.unit}.`
        );
      } else {
        setCart(cart.map((c) => (c.itemId === item._id ? { ...c, qty: newQty } : c)));
      }
    }
  };

  const handleProceedToReview = () => {
    setInlineError('');
    if (cart.length === 0) {
      setInlineError('Please select at least 1 stationery item to proceed.');
      return;
    }
    if (urgency === 'Urgent' && !purpose.trim()) {
      setInlineError('Purpose / Reason is mandatory for Urgent requisitions.');
      return;
    }
    setStep(3);
  };

  const handleBiometricSubmit = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not Supported', 'Fingerprint confirmation is only available in the mobile app');
      return;
    }
    if (cart.length === 0) {
      Alert.alert('Empty Cart', 'Cart is empty. Please add items before submitting.');
      setStep(1);
      return;
    }

    setSubmitting(true);
    try {
      const authResult = await authenticateBiometrics('Authenticate to digitally sign and submit your stationery indent');

      if (!authResult.success) {
        if (authResult.blocked) {
          Alert.alert('Screen Lock Required', authResult.error);
        } else if (authResult.cancelled) {
          Alert.alert('Verification Cancelled', 'Requisition was not submitted. You can try again when ready.');
        } else {
          Alert.alert('Authentication Failed', authResult.error || 'Biometric authentication could not be completed.');
        }
        return;
      }

      const deviceId = await getInstallationDeviceId();

      const summaryParts = [
        `Urgency: ${urgency}`,
        `Needed by: ${computedNeededByDate} (${neededWithin})`,
        purpose.trim() ? `Purpose: ${purpose.trim()}` : null,
        notes.trim() ? `Notes: ${notes.trim()}` : null
      ].filter(Boolean);
      const remarksString = summaryParts.join(' | ');

      const payload = {
        items: cart.map((c) => ({ itemId: c.itemId, quantity: c.qty })),
        confirmation: {
          method: authResult.method || 'biometric',
          deviceId
        },
        urgency,
        neededWithin,
        neededBy: computedNeededByDate,
        purpose: purpose.trim(),
        notes: notes.trim(),
        remarks: remarksString
      };

      const res = await client.post('/indents', payload);
      if (res.data?.data) {
        setSubmittedIndent(res.data.data);
        setStep(4);
      } else {
        throw new Error('Server response did not include requisition details');
      }
    } catch (err) {
      Alert.alert('Submission Error', err.response?.data?.message || err.message || 'Failed to submit indent.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setCart([]);
    setUrgency('Normal');
    setNeededWithin('3 days');
    setPurpose('');
    setNotes('');
    setInlineError('');
    setSubmittedIndent(null);
    setStep(1);
    fetchItems();
  };

  const filteredItems = items.filter(
    (it) =>
      !search ||
      it.name?.toLowerCase().includes(search.toLowerCase()) ||
      (it.code && it.code.toLowerCase().includes(search.toLowerCase())) ||
      (it.category && it.category.toLowerCase().includes(search.toLowerCase()))
  );

  const totalSelectedUnits = cart.reduce((acc, it) => acc + it.qty, 0);

  // Step Progress Indicator
  const renderStepIndicator = () => {
    if (step === 4) return null;
    return (
      <View style={styles.stepIndicatorContainer}>
        <View style={styles.stepItem}>
          <View
            style={[
              styles.stepCircle,
              step >= 1 && styles.stepCircleActive,
              step > 1 && styles.stepCircleDone
            ]}>
            <Text style={styles.stepCircleText}>{step > 1 ? '✓' : '1'}</Text>
          </View>
          <Text style={[styles.stepLabel, step === 1 && styles.stepLabelActive]}>
            Step 1: Items
          </Text>
        </View>

        <View style={[styles.stepLine, step >= 2 && styles.stepLineActive]} />

        <View style={styles.stepItem}>
          <View
            style={[
              styles.stepCircle,
              step >= 2 && styles.stepCircleActive,
              step > 2 && styles.stepCircleDone
            ]}>
            <Text style={styles.stepCircleText}>{step > 2 ? '✓' : '2'}</Text>
          </View>
          <Text style={[styles.stepLabel, step === 2 && styles.stepLabelActive]}>
            Step 2: Details
          </Text>
        </View>

        <View style={[styles.stepLine, step >= 3 && styles.stepLineActive]} />

        <View style={styles.stepItem}>
          <View style={[styles.stepCircle, step === 3 && styles.stepCircleActive]}>
            <Text style={styles.stepCircleText}>3</Text>
          </View>
          <Text style={[styles.stepLabel, step === 3 && styles.stepLabelActive]}>
            Step 3: Review
          </Text>
        </View>
      </View>
    );
  };

  // --- STEP 1: ITEMS SELECTION ---
  if (step === 1) {
    return (
      <View style={styles.container}>
        {renderStepIndicator()}

        <View style={styles.searchSection}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search stationery items by name or code..."
            placeholderTextColor={colors.textDim}
            value={search}
            onChangeText={setSearch}
            clearButtonMode="while-editing"
          />
        </View>

        {loadingItems ? (
          <LoadingState message="Loading stationery store inventory..." />
        ) : (
          <FlatList
            data={filteredItems}
            keyExtractor={(item) => item._id}
            refreshing={loadingItems}
            onRefresh={fetchItems}
            contentContainerStyle={styles.itemsListContainer}
            ListEmptyComponent={
              <EmptyState
                icon="🔍"
                title="No Matching Items"
                description="Try searching with a different item keyword or code."
              />
            }
            renderItem={({ item }) => {
              const inCart = cart.find((c) => c.itemId === item._id);
              const isOutOfStock = typeof item.stock === 'number' && item.stock <= 0;

              return (
                <Card
                  style={[styles.itemCard, isOutOfStock && styles.itemCardDisabled]}>
                  <View style={{ flex: 1, paddingRight: spacing.md }}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <View style={styles.metaRow}>
                      {item.code ? <Text style={styles.itemCode}>#{item.code}</Text> : null}
                      <Text style={[styles.itemStock, isOutOfStock && styles.itemStockOut]}>
                        {isOutOfStock ? 'Out of Stock' : `Available: ${item.stock} ${item.unit || 'units'}`}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.stepperContainer}>
                    {inCart ? (
                      <View style={styles.stepperWrapper}>
                        <TouchableOpacity
                          onPress={() => updateCartQty(item, -1)}
                          style={styles.stepperBtn}
                          accessibilityLabel="Decrease quantity">
                          <Text style={styles.stepperBtnText}>-</Text>
                        </TouchableOpacity>

                        <View style={styles.stepperCountBox}>
                          <Text style={styles.stepperCountText}>{inCart.qty}</Text>
                        </View>

                        <TouchableOpacity
                          onPress={() => updateCartQty(item, 1)}
                          style={[
                            styles.stepperBtn,
                            inCart.qty >= inCart.maxAllowed && styles.stepperBtnDisabled
                          ]}
                          disabled={inCart.qty >= inCart.maxAllowed}
                          accessibilityLabel="Increase quantity">
                          <Text style={styles.stepperBtnText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <PrimaryButton
                        title={isOutOfStock ? 'Unavailable' : '+ Add'}
                        variant={isOutOfStock ? 'secondary' : 'primary'}
                        disabled={isOutOfStock}
                        onPress={() => updateCartQty(item, 1)}
                        style={styles.addBtn}
                        textStyle={styles.addBtnText}
                      />
                    )}
                  </View>
                </Card>
              );
            }}
          />
        )}

        {/* Floating Bottom Bar for Step 1 */}
        <View style={styles.bottomBar}>
          <View style={styles.bottomBarInfo}>
            <Text style={styles.bottomBarCount}>
              {cart.length} item{cart.length === 1 ? '' : 's'} selected
            </Text>
            <Text style={styles.bottomBarUnits}>
              {totalSelectedUnits} total unit{totalSelectedUnits === 1 ? '' : 's'}
            </Text>
          </View>

          <PrimaryButton
            title="Next: Details →"
            onPress={() => {
              if (cart.length === 0) {
                Alert.alert('Select Items', 'Please select at least 1 item before proceeding.');
                return;
              }
              setStep(2);
            }}
            disabled={cart.length === 0}
            style={styles.bottomBarBtn}
          />
        </View>
      </View>
    );
  }

  // --- STEP 2: REQUISITION DETAILS ---
  if (step === 2) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {renderStepIndicator()}

        <ScrollView
          contentContainerStyle={styles.formScrollContainer}
          keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.backLink} onPress={() => setStep(1)}>
            <Text style={styles.backLinkText}>&larr; Back to Items</Text>
          </TouchableOpacity>

          {inlineError ? (
            <View style={styles.inlineErrorBanner}>
              <Text style={styles.inlineErrorIcon}>⚠️</Text>
              <Text style={styles.inlineErrorText}>{inlineError}</Text>
            </View>
          ) : null}

          {/* Urgency Selection */}
          <Card style={styles.formCard}>
            <Text style={styles.formSectionTitle}>Requisition Urgency</Text>
            <Text style={styles.formSectionSubtitle}>
              Select priority dispatch level for central stores
            </Text>

            <View style={styles.segmentedContainer}>
              {['Urgent', 'Normal', 'Not urgent'].map((level) => {
                const isSelected = urgency === level;
                return (
                  <TouchableOpacity
                    key={level}
                    style={[
                      styles.segmentBtn,
                      isSelected && styles.segmentBtnSelected,
                      isSelected && level === 'Urgent' && styles.segmentBtnUrgent
                    ]}
                    onPress={() => {
                      setUrgency(level);
                      if (level !== 'Urgent') setInlineError('');
                    }}
                    activeOpacity={0.7}>
                    <Text
                      style={[
                        styles.segmentBtnText,
                        isSelected && styles.segmentBtnTextSelected,
                        isSelected && level === 'Urgent' && styles.segmentBtnTextUrgent
                      ]}>
                      {level}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {urgency === 'Urgent' && (
              <View style={styles.urgentNoticeBox}>
                <Text style={styles.urgentNoticeText}>
                  ⚡ Urgent requisitions receive priority review from your HOD and fast-track counter dispatch. A reason is mandatory.
                </Text>
              </View>
            )}
          </Card>

          {/* Needed Within Chips */}
          <Card style={styles.formCard}>
            <Text style={styles.formSectionTitle}>Needed Within</Text>
            <Text style={styles.formSectionSubtitle}>
              Target delivery / collection date for these supplies
            </Text>

            <View style={styles.chipsContainer}>
              {NEEDED_WITHIN_CHIPS.map((chip) => {
                const isSelected = neededWithin === chip.label;
                return (
                  <TouchableOpacity
                    key={chip.label}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    onPress={() => setNeededWithin(chip.label)}
                    activeOpacity={0.7}>
                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                      {chip.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.neededDateBanner}>
              <Text style={styles.neededDateLabel}>📅 Target Needed By Date:</Text>
              <Text style={styles.neededDateValue}>{computedNeededByDate}</Text>
            </View>
          </Card>

          {/* Purpose & Notes Inputs */}
          <Card style={styles.formCard}>
            <View style={styles.labelRow}>
              <Text style={styles.inputLabel}>
                Purpose / Reason{' '}
                {urgency === 'Urgent' ? (
                  <Text style={styles.requiredStar}>* (Required for Urgent)</Text>
                ) : (
                  <Text style={styles.optionalTag}>(Recommended)</Text>
                )}
              </Text>
            </View>
            <TextInput
              style={[
                styles.textArea,
                urgency === 'Urgent' && !purpose.trim() && styles.textAreaAlert
              ]}
              placeholder="e.g. End semester examination printing, NAAC documentation, Lab experiment..."
              placeholderTextColor={colors.textDim}
              value={purpose}
              onChangeText={(val) => {
                setPurpose(val);
                if (val.trim()) setInlineError('');
              }}
              multiline
              numberOfLines={3}
            />

            <View style={[styles.labelRow, { marginTop: spacing.md }]}>
              <Text style={styles.inputLabel}>
                Special Notes / Room Location <Text style={styles.optionalTag}>(Optional)</Text>
              </Text>
            </View>
            <TextInput
              style={styles.textArea}
              placeholder="e.g. Room 302 CSE Lab, please pack in sealed bundles..."
              placeholderTextColor={colors.textDim}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={2}
            />
          </Card>

          <PrimaryButton
            title="Review Summary &rarr;"
            onPress={handleProceedToReview}
            style={styles.stepBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // --- STEP 3: REVIEW & BIOMETRIC CONFIRMATION ---
  if (step === 3) {
    return (
      <View style={styles.container}>
        {renderStepIndicator()}

        <ScrollView contentContainerStyle={styles.formScrollContainer}>
          <TouchableOpacity style={styles.backLink} onPress={() => setStep(2)}>
            <Text style={styles.backLinkText}>&larr; Back to Edit Details</Text>
          </TouchableOpacity>

          <View style={styles.reviewHeader}>
            <Text style={styles.reviewTitle}>Requisition Summary</Text>
            <Text style={styles.reviewSubtitle}>
              Verify requested items and justification before digitally signing
            </Text>
          </View>

          {/* Priority & Date Card */}
          <Card style={styles.reviewCard}>
            <View style={styles.reviewMetaRow}>
              <Text style={styles.reviewMetaLabel}>Requisition Urgency:</Text>
              <View
                style={[
                  styles.urgencyBadge,
                  urgency === 'Urgent' && styles.urgencyBadgeRed,
                  urgency === 'Normal' && styles.urgencyBadgeBlue,
                  urgency === 'Not urgent' && styles.urgencyBadgeGray
                ]}>
                <Text style={styles.urgencyBadgeText}>{urgency.toUpperCase()}</Text>
              </View>
            </View>

            <View style={styles.reviewMetaRow}>
              <Text style={styles.reviewMetaLabel}>Required Delivery Date:</Text>
              <Text style={styles.reviewMetaValue}>
                {computedNeededByDate} ({neededWithin})
              </Text>
            </View>

            {purpose.trim() ? (
              <View style={styles.reviewTextSection}>
                <Text style={styles.reviewMetaLabel}>Purpose / Reason:</Text>
                <Text style={styles.reviewTextContent}>{purpose.trim()}</Text>
              </View>
            ) : null}

            {notes.trim() ? (
              <View style={styles.reviewTextSection}>
                <Text style={styles.reviewMetaLabel}>Delivery Notes:</Text>
                <Text style={styles.reviewTextContent}>{notes.trim()}</Text>
              </View>
            ) : null}
          </Card>

          {/* Items Summary Table */}
          <Card style={styles.reviewCard}>
            <Text style={styles.reviewSectionTitle}>
              Requested Items ({cart.length})
            </Text>
            {cart.map((it, idx) => (
              <View key={it.itemId || idx} style={styles.reviewItemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reviewItemName}>{it.name}</Text>
                  <Text style={styles.reviewItemUnit}>
                    Store availability: {it.stock} {it.unit}
                  </Text>
                </View>
                <Text style={styles.reviewItemQty}>
                  {it.qty} {it.unit}
                </Text>
              </View>
            ))}

            <View style={styles.reviewTotalRow}>
              <Text style={styles.reviewTotalLabel}>Total Quantity:</Text>
              <Text style={styles.reviewTotalValue}>{totalSelectedUnits} units</Text>
            </View>
          </Card>

          {/* Biometric Sign-off Box */}
          <Card style={styles.biometricPromptCard}>
            <Text style={styles.biometricPromptTitle}>Biometric Digital Signature</Text>
            <Text style={styles.biometricPromptDesc}>
              {Platform.OS === 'web'
                ? 'Fingerprint confirmation is only available in the mobile app'
                : 'Submitting triggers your device hardware screen lock or fingerprint scanner to create a cryptographic signature linked to your College Staff ID.'}
            </Text>

            <PrimaryButton
              title="🔒 Touch Fingerprint to Sign & Submit"
              variant="success"
              onPress={handleBiometricSubmit}
              loading={submitting}
              disabled={Platform.OS === 'web' || submitting}
              style={styles.biometricSubmitBtn}
            />
          </Card>
        </ScrollView>
      </View>
    );
  }

  // --- STEP 4: SUCCESS CONFIRMATION ---
  if (step === 4) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.successScrollContainer}>
          <View style={styles.successIconCircle}>
            <Text style={styles.successCheckmark}>✓</Text>
          </View>

          <Text style={styles.successTitle}>Requisition Submitted!</Text>
          <Text style={styles.successSubtitle}>
            Your requisition has been recorded and placed in queue.
          </Text>

          <Card style={styles.indentNumberCard}>
            <Text style={styles.indentNumberLabel}>INDENT NUMBER</Text>
            <Text style={styles.indentNumberValue}>
              {submittedIndent?.indentNo || 'IND-PENDING'}
            </Text>
            <View style={styles.statusPillWrapper}>
              <StatusBadge status="REQUESTED" size="md" />
            </View>
          </Card>

          <Card style={styles.successRecapCard}>
            <View style={styles.recapRow}>
              <Text style={styles.recapLabel}>Urgency Priority:</Text>
              <Text style={styles.recapValue}>{urgency}</Text>
            </View>
            <View style={styles.recapRow}>
              <Text style={styles.recapLabel}>Needed By:</Text>
              <Text style={styles.recapValue}>{computedNeededByDate}</Text>
            </View>
            <View style={styles.recapRow}>
              <Text style={styles.recapLabel}>Items Total:</Text>
              <Text style={styles.recapValue}>
                {cart.length} item(s) &bull; {totalSelectedUnits} units
              </Text>
            </View>
            <View style={styles.recapRow}>
              <Text style={styles.recapLabel}>Digital Signature:</Text>
              <Text style={[styles.recapValue, { color: colors.successLight }]}>
                ✓ Verified Hardware Biometric
              </Text>
            </View>
          </Card>

          <View style={styles.successActions}>
            <PrimaryButton
              title="View in My Indents &rarr;"
              onPress={() => router.replace('/(tabs)/history')}
              style={styles.successPrimaryBtn}
            />

            <PrimaryButton
              title="+ Create Another Requisition"
              variant="secondary"
              onPress={resetForm}
              style={styles.successSecondaryBtn}
            />
          </View>
        </ScrollView>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  // Step indicator
  stepIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.backgroundElevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  stepItem: {
    alignItems: 'center'
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: radii.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center'
  },
  stepCircleActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryLight
  },
  stepCircleDone: {
    backgroundColor: colors.success,
    borderColor: colors.successLight
  },
  stepCircleText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700'
  },
  stepLabel: {
    color: colors.textDim,
    fontSize: typography.xs,
    marginTop: spacing.xxs,
    fontWeight: '500'
  },
  stepLabelActive: {
    color: colors.primaryLight,
    fontWeight: '700'
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
    marginBottom: 14
  },
  stepLineActive: {
    backgroundColor: colors.primary
  },

  // Step 1: Search & Items
  searchSection: {
    padding: spacing.md,
    backgroundColor: colors.backgroundElevated
  },
  searchInput: {
    backgroundColor: colors.card,
    color: colors.text,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.sm,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: layout.minTouchTarget
  },
  itemsListContainer: {
    padding: spacing.md,
    paddingBottom: 120
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm
  },
  itemCardDisabled: {
    opacity: 0.5
  },
  itemName: {
    color: colors.text,
    fontSize: typography.md,
    fontWeight: '600',
    marginBottom: spacing.xxs
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  itemCode: {
    color: colors.textMuted,
    fontSize: typography.xs,
    backgroundColor: colors.backgroundElevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.xs
  },
  itemStock: {
    color: colors.primaryLight,
    fontSize: typography.xs,
    fontWeight: '600'
  },
  itemStockOut: {
    color: colors.dangerLight
  },
  stepperContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center'
  },
  stepperWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border
  },
  stepperBtn: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.sm
  },
  stepperBtnDisabled: {
    backgroundColor: colors.neutral,
    opacity: 0.4
  },
  stepperBtnText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    lineHeight: 22
  },
  stepperCountBox: {
    minWidth: 36,
    paddingHorizontal: spacing.xs,
    alignItems: 'center'
  },
  stepperCountText: {
    color: colors.text,
    fontSize: typography.md,
    fontWeight: '700'
  },
  addBtn: {
    minHeight: 38,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md
  },
  addBtnText: {
    fontSize: typography.sm
  },

  // Bottom Bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.backgroundElevated,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  bottomBarInfo: {
    flex: 1
  },
  bottomBarCount: {
    color: colors.text,
    fontSize: typography.sm,
    fontWeight: '700'
  },
  bottomBarUnits: {
    color: colors.textMuted,
    fontSize: typography.xs
  },
  bottomBarBtn: {
    minWidth: 150
  },

  // Step 2 & 3 Forms
  formScrollContainer: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl
  },
  backLink: {
    marginBottom: spacing.md,
    paddingVertical: spacing.xs
  },
  backLinkText: {
    color: colors.primaryLight,
    fontSize: typography.sm,
    fontWeight: '600'
  },
  inlineErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerSubtle,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md
  },
  inlineErrorIcon: {
    fontSize: 16,
    marginRight: spacing.sm
  },
  inlineErrorText: {
    flex: 1,
    color: colors.dangerLight,
    fontSize: typography.sm,
    lineHeight: 18
  },
  formCard: {
    marginBottom: spacing.md
  },
  formSectionTitle: {
    color: colors.text,
    fontSize: typography.md,
    fontWeight: '700',
    marginBottom: 2
  },
  formSectionSubtitle: {
    color: colors.textMuted,
    fontSize: typography.xs,
    marginBottom: spacing.md
  },

  // Segmented control
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundElevated,
    borderRadius: radii.md,
    padding: 3,
    gap: 4
  },
  segmentBtn: {
    flex: 1,
    minHeight: layout.minTouchTarget - 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radii.sm
  },
  segmentBtnSelected: {
    backgroundColor: colors.primary
  },
  segmentBtnUrgent: {
    backgroundColor: colors.danger
  },
  segmentBtnText: {
    color: colors.textMuted,
    fontSize: typography.sm,
    fontWeight: '600'
  },
  segmentBtnTextSelected: {
    color: '#ffffff',
    fontWeight: '700'
  },
  segmentBtnTextUrgent: {
    color: '#ffffff'
  },
  urgentNoticeBox: {
    marginTop: spacing.md,
    backgroundColor: colors.dangerSubtle,
    borderRadius: radii.sm,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.danger
  },
  urgentNoticeText: {
    color: colors.dangerLight,
    fontSize: typography.xs,
    lineHeight: 16
  },

  // Chips
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  chip: {
    backgroundColor: colors.backgroundElevated,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border
  },
  chipSelected: {
    backgroundColor: colors.infoSubtle,
    borderColor: colors.infoLight
  },
  chipText: {
    color: colors.textMuted,
    fontSize: typography.xs,
    fontWeight: '600'
  },
  chipTextSelected: {
    color: colors.infoLight,
    fontWeight: '700'
  },
  neededDateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundElevated,
    padding: spacing.md,
    borderRadius: radii.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.primaryLight
  },
  neededDateLabel: {
    color: colors.textMuted,
    fontSize: typography.xs
  },
  neededDateValue: {
    color: colors.primaryLight,
    fontSize: typography.sm,
    fontWeight: '700'
  },

  // Inputs
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs
  },
  inputLabel: {
    color: colors.textSecondary,
    fontSize: typography.sm,
    fontWeight: '600'
  },
  requiredStar: {
    color: colors.dangerLight,
    fontWeight: '700'
  },
  optionalTag: {
    color: colors.textDim,
    fontSize: typography.xs,
    fontWeight: 'normal'
  },
  textArea: {
    backgroundColor: colors.backgroundElevated,
    color: colors.text,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: typography.sm,
    textAlignVertical: 'top'
  },
  textAreaAlert: {
    borderColor: colors.danger
  },
  stepBtn: {
    marginTop: spacing.md
  },

  // Step 3 Review
  reviewHeader: {
    marginBottom: spacing.lg
  },
  reviewTitle: {
    color: colors.text,
    fontSize: typography.xl,
    fontWeight: '800'
  },
  reviewSubtitle: {
    color: colors.textMuted,
    fontSize: typography.sm,
    marginTop: 2
  },
  reviewCard: {
    marginBottom: spacing.md
  },
  reviewSectionTitle: {
    color: colors.text,
    fontSize: typography.sm,
    fontWeight: '700',
    marginBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.xs
  },
  reviewMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs
  },
  reviewMetaLabel: {
    color: colors.textMuted,
    fontSize: typography.sm
  },
  reviewMetaValue: {
    color: colors.text,
    fontSize: typography.sm,
    fontWeight: '600'
  },
  urgencyBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.xs
  },
  urgencyBadgeRed: {
    backgroundColor: colors.dangerSubtle,
    borderWidth: 1,
    borderColor: colors.dangerBorder
  },
  urgencyBadgeBlue: {
    backgroundColor: colors.primarySubtle,
    borderWidth: 1,
    borderColor: colors.borderFocus
  },
  urgencyBadgeGray: {
    backgroundColor: colors.neutralSubtle,
    borderWidth: 1,
    borderColor: colors.border
  },
  urgencyBadgeText: {
    color: colors.text,
    fontSize: typography.xs,
    fontWeight: '700'
  },
  reviewTextSection: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  reviewTextContent: {
    color: colors.textPrimary,
    fontSize: typography.sm,
    marginTop: 2,
    lineHeight: 18
  },
  reviewItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle
  },
  reviewItemName: {
    color: colors.textSecondary,
    fontSize: typography.sm,
    fontWeight: '600'
  },
  reviewItemUnit: {
    color: colors.textDim,
    fontSize: typography.xs,
    marginTop: 2
  },
  reviewItemQty: {
    color: colors.primaryLight,
    fontSize: typography.sm,
    fontWeight: '700'
  },
  reviewTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    marginTop: spacing.xs
  },
  reviewTotalLabel: {
    color: colors.textSecondary,
    fontSize: typography.sm,
    fontWeight: '700'
  },
  reviewTotalValue: {
    color: colors.successLight,
    fontSize: typography.md,
    fontWeight: '800'
  },
  biometricPromptCard: {
    backgroundColor: colors.backgroundElevated,
    marginBottom: spacing.xl
  },
  biometricPromptTitle: {
    color: colors.text,
    fontSize: typography.md,
    fontWeight: '700',
    marginBottom: spacing.xs
  },
  biometricPromptDesc: {
    color: colors.textMuted,
    fontSize: typography.xs,
    lineHeight: 18,
    marginBottom: spacing.lg
  },
  biometricSubmitBtn: {
    minHeight: layout.minTouchTarget + 6
  },

  // Step 4 Success
  successScrollContainer: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center'
  },
  successIconCircle: {
    width: 68,
    height: 68,
    borderRadius: radii.full,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg
  },
  successCheckmark: {
    color: '#ffffff',
    fontSize: 34,
    fontWeight: 'bold'
  },
  successTitle: {
    color: colors.text,
    fontSize: typography.xxl,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: spacing.xs
  },
  successSubtitle: {
    color: colors.textMuted,
    fontSize: typography.sm,
    textAlign: 'center',
    marginBottom: spacing.xl
  },
  indentNumberCard: {
    width: '100%',
    alignItems: 'center',
    borderColor: colors.borderFocus,
    marginBottom: spacing.md
  },
  indentNumberLabel: {
    color: colors.textMuted,
    fontSize: typography.xs,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4
  },
  indentNumberValue: {
    color: colors.primaryLight,
    fontSize: typography.xxl,
    fontWeight: '800'
  },
  statusPillWrapper: {
    marginTop: spacing.sm
  },
  successRecapCard: {
    width: '100%',
    marginBottom: spacing.xl
  },
  recapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs
  },
  recapLabel: {
    color: colors.textMuted,
    fontSize: typography.sm
  },
  recapValue: {
    color: colors.textSecondary,
    fontSize: typography.sm,
    fontWeight: '600'
  },
  successActions: {
    width: '100%'
  },
  successPrimaryBtn: {
    marginBottom: spacing.md
  },
  successSecondaryBtn: {
    marginBottom: spacing.sm
  }
});
