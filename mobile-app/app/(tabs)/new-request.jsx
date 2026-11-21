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
  Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import client from '../../src/api/client';
import { authenticateBiometrics } from '../../src/biometrics/confirm';
import { getSecureToken } from '../../src/auth/storage';

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
  // Urgency: 'Urgent' | 'Normal' | 'Not urgent'
  const [urgency, setUrgency] = useState('Normal');
  const [neededWithin, setNeededWithin] = useState('3 days');
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');

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
      Alert.alert('Error', 'Unable to fetch stationery items from store');
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const selectedDays = NEEDED_WITHIN_CHIPS.find(c => c.label === neededWithin)?.days || 3;
  const computedNeededByDate = formatNeededBy(selectedDays);

  // Stepper logic: min 1, max = available stock (or maxPerIndent if lower)
  const updateCartQty = (item, delta) => {
    const existing = cart.find(c => c.itemId === item._id);
    const availableStock = typeof item.stock === 'number' ? item.stock : 999;
    const maxAllowed = item.maxPerIndent ? Math.min(availableStock, item.maxPerIndent) : availableStock;

    if (!existing && delta > 0) {
      if (maxAllowed < 1) {
        Alert.alert('Out of Stock', `'${item.name}' is currently out of stock.`);
        return;
      }
      setCart([...cart, {
        itemId: item._id,
        name: item.name,
        code: item.code,
        unit: item.unit || 'units',
        stock: availableStock,
        maxAllowed,
        qty: 1
      }]);
    } else if (existing) {
      const newQty = existing.qty + delta;
      if (newQty <= 0) {
        // Decrement below 1 removes from cart
        setCart(cart.filter(c => c.itemId !== item._id));
      } else if (newQty > existing.maxAllowed) {
        Alert.alert('Stock Limit Reached', `Maximum available quantity for '${existing.name}' is ${existing.maxAllowed} ${existing.unit}.`);
      } else {
        setCart(cart.map(c => c.itemId === item._id ? { ...c, qty: newQty } : c));
      }
    }
  };

  const removeFromCart = (itemId) => {
    setCart(cart.filter(c => c.itemId !== itemId));
  };

  // Validation before going to Review (Step 3)
  const handleProceedToReview = () => {
    if (cart.length === 0) {
      Alert.alert('Empty Cart', 'Please select at least one stationery item.');
      return;
    }
    if (urgency === 'Urgent' && !purpose.trim()) {
      Alert.alert(
        'Purpose Required',
        'Purpose / Reason is required for Urgent requisitions. Please explain why items are needed urgently.'
      );
      return;
    }
    setStep(3);
  };

  // Submission with Biometrics
  const handleBiometricSubmit = async () => {
    if (cart.length === 0) {
      Alert.alert('Error', 'Cart is empty. Please add items before submitting.');
      setStep(1);
      return;
    }

    setSubmitting(true);
    try {
      const authResult = await authenticateBiometrics('Touch fingerprint sensor to sign and submit your stationery requisition');

      if (!authResult.success) {
        Alert.alert('Biometric Verification Failed', 'Authentication was cancelled or not verified.');
        setSubmitting(false);
        return;
      }

      // Retrieve deviceId associated with user profile
      let deviceId = 'dev-phone-app';
      try {
        const storedUser = await getSecureToken('userProfile');
        if (storedUser) {
          const u = JSON.parse(storedUser);
          if (u?.staffId) {
            deviceId = `dev-phone-${u.staffId.toLowerCase()}`;
          }
        }
      } catch (e) {}

      // Readable summary string for backward compatibility with existing storekeeper / HOD views
      const summaryParts = [
        `Urgency: ${urgency}`,
        `Needed by: ${computedNeededByDate} (${neededWithin})`,
        purpose.trim() ? `Purpose: ${purpose.trim()}` : null,
        notes.trim() ? `Notes: ${notes.trim()}` : null
      ].filter(Boolean);
      const remarksString = summaryParts.join(' | ');

      const payload = {
        items: cart.map(c => ({ itemId: c.itemId, quantity: c.qty })),
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
      Alert.alert('Submission Error', err.response?.data?.message || err.message || 'Failed to submit indent');
    } finally {
      setSubmitting(false);
    }
  };

  // Reset form to start a new requisition
  const resetForm = () => {
    setCart([]);
    setUrgency('Normal');
    setNeededWithin('3 days');
    setPurpose('');
    setNotes('');
    setSubmittedIndent(null);
    setStep(1);
    fetchItems();
  };

  // Filtering for Step 1
  const filteredItems = items.filter(it =>
    !search ||
    it.name?.toLowerCase().includes(search.toLowerCase()) ||
    (it.code && it.code.toLowerCase().includes(search.toLowerCase())) ||
    (it.category && it.category.toLowerCase().includes(search.toLowerCase()))
  );

  const totalSelectedUnits = cart.reduce((acc, it) => acc + it.qty, 0);

  // Top Step Progress Indicator
  const renderStepIndicator = () => {
    if (step === 4) return null;
    return (
      <View style={styles.stepIndicatorContainer}>
        <View style={styles.stepItem}>
          <View style={[styles.stepCircle, step >= 1 && styles.stepCircleActive, step > 1 && styles.stepCircleDone]}>
            <Text style={styles.stepCircleText}>{step > 1 ? '✓' : '1'}</Text>
          </View>
          <Text style={[styles.stepLabel, step === 1 && styles.stepLabelActive]}>Items</Text>
        </View>

        <View style={[styles.stepLine, step >= 2 && styles.stepLineActive]} />

        <View style={styles.stepItem}>
          <View style={[styles.stepCircle, step >= 2 && styles.stepCircleActive, step > 2 && styles.stepCircleDone]}>
            <Text style={styles.stepCircleText}>{step > 2 ? '✓' : '2'}</Text>
          </View>
          <Text style={[styles.stepLabel, step === 2 && styles.stepLabelActive]}>Details</Text>
        </View>

        <View style={[styles.stepLine, step >= 3 && styles.stepLineActive]} />

        <View style={styles.stepItem}>
          <View style={[styles.stepCircle, step === 3 && styles.stepCircleActive]}>
            <Text style={styles.stepCircleText}>3</Text>
          </View>
          <Text style={[styles.stepLabel, step === 3 && styles.stepLabelActive]}>Review</Text>
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
            placeholder="Search items by name or code..."
            placeholderTextColor="#64748b"
            value={search}
            onChangeText={setSearch}
            clearButtonMode="while-editing"
          />
        </View>

        <FlatList
          data={filteredItems}
          keyExtractor={item => item._id}
          refreshing={loadingItems}
          onRefresh={fetchItems}
          contentContainerStyle={{ paddingBottom: 110 }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {loadingItems ? 'Loading items catalogue...' : 'No stationery items match your search.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const inCart = cart.find(c => c.itemId === item._id);
            const isOutOfStock = (typeof item.stock === 'number' && item.stock <= 0);

            return (
              <View style={[styles.itemCard, isOutOfStock && styles.itemCardDisabled]}>
                <View style={{ flex: 1, paddingRight: 10 }}>
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
                        style={[styles.stepperBtn, inCart.qty >= inCart.maxAllowed && styles.stepperBtnDisabled]}
                        disabled={inCart.qty >= inCart.maxAllowed}
                        accessibilityLabel="Increase quantity">
                        <Text style={styles.stepperBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={() => updateCartQty(item, 1)}
                      style={[styles.addBtn, isOutOfStock && styles.addBtnDisabled]}
                      disabled={isOutOfStock}>
                      <Text style={styles.addBtnText}>{isOutOfStock ? 'Unavailable' : '+ Add'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }}
        />

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

          <TouchableOpacity
            style={[styles.primaryActionBtn, cart.length === 0 && styles.btnDisabled]}
            onPress={() => {
              if (cart.length === 0) {
                Alert.alert('Select Items', 'Please select at least 1 item to proceed.');
                return;
              }
              setStep(2);
            }}
            disabled={cart.length === 0}>
            <Text style={styles.primaryActionBtnText}>Requisition Details &rarr;</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // --- STEP 2: REQUISITION DETAILS ---
  if (step === 2) {
    return (
      <View style={styles.container}>
        {renderStepIndicator()}

        <ScrollView contentContainerStyle={styles.formScrollContainer}>
          <TouchableOpacity style={styles.backLink} onPress={() => setStep(1)}>
            <Text style={styles.backLinkText}>&larr; Back to Items</Text>
          </TouchableOpacity>

          {/* Section: Urgency */}
          <View style={styles.formCard}>
            <Text style={styles.formSectionTitle}>Requisition Urgency</Text>
            <Text style={styles.formSectionSubtitle}>Select priority level for store dispatch</Text>

            <View style={styles.segmentedContainer}>
              {['Urgent', 'Normal', 'Not urgent'].map(level => {
                const isSelected = urgency === level;
                return (
                  <TouchableOpacity
                    key={level}
                    style={[
                      styles.segmentBtn,
                      isSelected && styles.segmentBtnSelected,
                      isSelected && level === 'Urgent' && styles.segmentBtnUrgent
                    ]}
                    onPress={() => setUrgency(level)}>
                    <Text style={[
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
                  ⚠️ Urgent requisitions are expedited for emergency class/lab needs. A purpose is mandatory.
                </Text>
              </View>
            )}
          </View>

          {/* Section: Needed Within Chips */}
          <View style={styles.formCard}>
            <Text style={styles.formSectionTitle}>Needed Within</Text>
            <Text style={styles.formSectionSubtitle}>Choose when this stationery is required by</Text>

            <View style={styles.chipsContainer}>
              {NEEDED_WITHIN_CHIPS.map(chip => {
                const isSelected = neededWithin === chip.label;
                return (
                  <TouchableOpacity
                    key={chip.label}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    onPress={() => setNeededWithin(chip.label)}>
                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                      {chip.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.neededDateBanner}>
              <Text style={styles.neededDateLabel}>📅 Computed Needed By Date:</Text>
              <Text style={styles.neededDateValue}>{computedNeededByDate}</Text>
            </View>
          </View>

          {/* Section: Purpose & Reason */}
          <View style={styles.formCard}>
            <View style={styles.labelRow}>
              <Text style={styles.inputLabel}>
                Purpose / Reason {urgency === 'Urgent' ? <Text style={styles.requiredStar}>* (Required)</Text> : <Text style={styles.optionalTag}>(Recommended)</Text>}
              </Text>
            </View>
            <TextInput
              style={[styles.textArea, urgency === 'Urgent' && !purpose.trim() && styles.textAreaAlert]}
              placeholder="e.g., Mid-term examination booklet printing, Chemistry Lab experiment supplies..."
              placeholderTextColor="#64748b"
              value={purpose}
              onChangeText={setPurpose}
              multiline
              numberOfLines={3}
            />

            <View style={[styles.labelRow, { marginTop: 14 }]}>
              <Text style={styles.inputLabel}>
                Additional Notes / Instructions <Text style={styles.optionalTag}>(Optional)</Text>
              </Text>
            </View>
            <TextInput
              style={styles.textArea}
              placeholder="e.g., Room 302, please pack in sealed bundle..."
              placeholderTextColor="#64748b"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={2}
            />
          </View>

          <TouchableOpacity
            style={styles.primaryActionBtn}
            onPress={handleProceedToReview}>
            <Text style={styles.primaryActionBtnText}>Review Summary &rarr;</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
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
            <Text style={styles.reviewSubtitle}>Please verify items and requisition timing before signing</Text>
          </View>

          {/* Priority & Date Card */}
          <View style={styles.reviewCard}>
            <View style={styles.reviewMetaRow}>
              <Text style={styles.reviewMetaLabel}>Priority Urgency:</Text>
              <View style={[
                styles.urgencyBadge,
                urgency === 'Urgent' && styles.urgencyBadgeRed,
                urgency === 'Normal' && styles.urgencyBadgeBlue,
                urgency === 'Not urgent' && styles.urgencyBadgeGray
              ]}>
                <Text style={styles.urgencyBadgeText}>{urgency.toUpperCase()}</Text>
              </View>
            </View>

            <View style={styles.reviewMetaRow}>
              <Text style={styles.reviewMetaLabel}>Required By:</Text>
              <Text style={styles.reviewMetaValue}>{computedNeededByDate} ({neededWithin})</Text>
            </View>

            {purpose.trim() ? (
              <View style={styles.reviewTextSection}>
                <Text style={styles.reviewMetaLabel}>Purpose:</Text>
                <Text style={styles.reviewTextContent}>{purpose.trim()}</Text>
              </View>
            ) : null}

            {notes.trim() ? (
              <View style={styles.reviewTextSection}>
                <Text style={styles.reviewMetaLabel}>Notes:</Text>
                <Text style={styles.reviewTextContent}>{notes.trim()}</Text>
              </View>
            ) : null}
          </View>

          {/* Items Summary Table */}
          <View style={styles.reviewCard}>
            <Text style={styles.reviewSectionTitle}>Selected Items ({cart.length})</Text>
            {cart.map((it, idx) => (
              <View key={it.itemId || idx} style={styles.reviewItemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reviewItemName}>{it.name}</Text>
                  <Text style={styles.reviewItemUnit}>Available stock: {it.stock} {it.unit}</Text>
                </View>
                <Text style={styles.reviewItemQty}>{it.qty} {it.unit}</Text>
              </View>
            ))}

            <View style={styles.reviewTotalRow}>
              <Text style={styles.reviewTotalLabel}>Total Items Requested:</Text>
              <Text style={styles.reviewTotalValue}>{totalSelectedUnits} units</Text>
            </View>
          </View>

          {/* Biometric Sign-off Box */}
          <View style={styles.biometricPromptCard}>
            <Text style={styles.biometricPromptTitle}>Biometric Signature</Text>
            <Text style={styles.biometricPromptDesc}>
              Submitting activates your hardware biometric sensor to verify your institutional identity and digitally sign this indent.
            </Text>

            <TouchableOpacity
              style={[styles.biometricSubmitBtn, submitting && styles.btnDisabled]}
              onPress={handleBiometricSubmit}
              disabled={submitting}>
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.biometricSubmitBtnText}>🔒 Touch Fingerprint to Sign & Submit</Text>
              )}
            </TouchableOpacity>
          </View>
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
          <Text style={styles.successSubtitle}>Your stationery request has been signed and placed in queue.</Text>

          <View style={styles.indentNumberCard}>
            <Text style={styles.indentNumberLabel}>INDENT NUMBER</Text>
            <Text style={styles.indentNumberValue}>{submittedIndent?.indentNo || 'N/A'}</Text>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>PENDING HOD APPROVAL</Text>
            </View>
          </View>

          <View style={styles.successRecapCard}>
            <View style={styles.recapRow}>
              <Text style={styles.recapLabel}>Priority:</Text>
              <Text style={styles.recapValue}>{urgency}</Text>
            </View>
            <View style={styles.recapRow}>
              <Text style={styles.recapLabel}>Needed By:</Text>
              <Text style={styles.recapValue}>{computedNeededByDate}</Text>
            </View>
            <View style={styles.recapRow}>
              <Text style={styles.recapLabel}>Items Total:</Text>
              <Text style={styles.recapValue}>{cart.length} item(s) &bull; {totalSelectedUnits} units</Text>
            </View>
            <View style={styles.recapRow}>
              <Text style={styles.recapLabel}>Digital Signature:</Text>
              <Text style={styles.recapValue}>Verified Biometric</Text>
            </View>
          </View>

          <View style={styles.successActions}>
            <TouchableOpacity
              style={styles.primaryActionBtn}
              onPress={() => router.replace('/(tabs)/history')}>
              <Text style={styles.primaryActionBtnText}>View in My Indents &rarr;</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryActionBtn}
              onPress={resetForm}>
              <Text style={styles.secondaryActionBtnText}>+ Create Another Requisition</Text>
            </TouchableOpacity>
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
    backgroundColor: '#090d16'
  },
  // Step indicator
  stepIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b'
  },
  stepItem: {
    alignItems: 'center'
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#475569',
    justifyContent: 'center',
    alignItems: 'center'
  },
  stepCircleActive: {
    backgroundColor: '#2563eb',
    borderColor: '#38bdf8'
  },
  stepCircleDone: {
    backgroundColor: '#16a34a',
    borderColor: '#4ade80'
  },
  stepCircleText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700'
  },
  stepLabel: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 3,
    fontWeight: '500'
  },
  stepLabelActive: {
    color: '#38bdf8',
    fontWeight: '700'
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#1e293b',
    marginHorizontal: 8,
    marginBottom: 14
  },
  stepLineActive: {
    backgroundColor: '#2563eb'
  },

  // Step 1: Search & Items
  searchSection: {
    padding: 12,
    backgroundColor: '#0f172a'
  },
  searchInput: {
    backgroundColor: '#1e293b',
    color: '#fff',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155'
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center'
  },
  emptyText: {
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center'
  },
  itemCard: {
    backgroundColor: '#1e293b',
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155'
  },
  itemCardDisabled: {
    opacity: 0.5
  },
  itemName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  itemCode: {
    color: '#94a3b8',
    fontSize: 11,
    backgroundColor: '#0f172a',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  itemStock: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '500'
  },
  itemStockOut: {
    color: '#f87171'
  },
  stepperContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center'
  },
  stepperWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155'
  },
  stepperBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 6
  },
  stepperBtnDisabled: {
    backgroundColor: '#334155',
    opacity: 0.5
  },
  stepperBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 20
  },
  stepperCountBox: {
    minWidth: 32,
    paddingHorizontal: 6,
    alignItems: 'center'
  },
  stepperCountText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700'
  },
  addBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8
  },
  addBtnDisabled: {
    backgroundColor: '#334155'
  },
  addBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600'
  },

  // Floating bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0f172a',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  bottomBarInfo: {
    flex: 1
  },
  bottomBarCount: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700'
  },
  bottomBarUnits: {
    color: '#94a3b8',
    fontSize: 12
  },

  // Buttons
  primaryActionBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryActionBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700'
  },
  secondaryActionBtn: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10
  },
  secondaryActionBtnText: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '600'
  },
  btnDisabled: {
    opacity: 0.5
  },

  // Step 2 & 3 Forms
  formScrollContainer: {
    padding: 16,
    paddingBottom: 40
  },
  backLink: {
    marginBottom: 14,
    paddingVertical: 4
  },
  backLinkText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '600'
  },
  formCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155'
  },
  formSectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2
  },
  formSectionSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 12
  },

  // Segmented control
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 3,
    gap: 4
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center'
  },
  segmentBtnSelected: {
    backgroundColor: '#2563eb'
  },
  segmentBtnUrgent: {
    backgroundColor: '#dc2626'
  },
  segmentBtnText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600'
  },
  segmentBtnTextSelected: {
    color: '#fff',
    fontWeight: '700'
  },
  segmentBtnTextUrgent: {
    color: '#fff'
  },
  urgentNoticeBox: {
    marginTop: 10,
    backgroundColor: '#450a0a',
    borderRadius: 6,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444'
  },
  urgentNoticeText: {
    color: '#fca5a5',
    fontSize: 12,
    lineHeight: 16
  },

  // Chips
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12
  },
  chip: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155'
  },
  chipSelected: {
    backgroundColor: '#0369a1',
    borderColor: '#38bdf8'
  },
  chipText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500'
  },
  chipTextSelected: {
    color: '#fff',
    fontWeight: '700'
  },
  neededDateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f172a',
    padding: 10,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#38bdf8'
  },
  neededDateLabel: {
    color: '#94a3b8',
    fontSize: 12
  },
  neededDateValue: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '700'
  },

  // Text inputs
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  inputLabel: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600'
  },
  requiredStar: {
    color: '#f87171',
    fontWeight: '700'
  },
  optionalTag: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: 'normal'
  },
  textArea: {
    backgroundColor: '#0f172a',
    color: '#fff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    fontSize: 13,
    textAlignVertical: 'top'
  },
  textAreaAlert: {
    borderColor: '#ef4444'
  },

  // Step 3 Review
  reviewHeader: {
    marginBottom: 16
  },
  reviewTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700'
  },
  reviewSubtitle: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 2
  },
  reviewCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155'
  },
  reviewSectionTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 6
  },
  reviewMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5
  },
  reviewMetaLabel: {
    color: '#94a3b8',
    fontSize: 13
  },
  reviewMetaValue: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600'
  },
  urgencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4
  },
  urgencyBadgeRed: {
    backgroundColor: '#7f1d1d'
  },
  urgencyBadgeBlue: {
    backgroundColor: '#0369a1'
  },
  urgencyBadgeGray: {
    backgroundColor: '#334155'
  },
  urgencyBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700'
  },
  reviewTextSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155'
  },
  reviewTextContent: {
    color: '#e2e8f0',
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18
  },
  reviewItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#0f172a'
  },
  reviewItemName: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '600'
  },
  reviewItemUnit: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2
  },
  reviewItemQty: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '700'
  },
  reviewTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    marginTop: 4
  },
  reviewTotalLabel: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '700'
  },
  reviewTotalValue: {
    color: '#4ade80',
    fontSize: 14,
    fontWeight: '700'
  },
  biometricPromptCard: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 16
  },
  biometricPromptTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4
  },
  biometricPromptDesc: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14
  },
  biometricSubmitBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  biometricSubmitBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700'
  },

  // Step 4: Success
  successScrollContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center'
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#15803d',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
  },
  successCheckmark: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold'
  },
  successTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6
  },
  successSubtitle: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20
  },
  indentNumberCard: {
    width: '100%',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#38bdf8',
    marginBottom: 16
  },
  indentNumberLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4
  },
  indentNumberValue: {
    color: '#38bdf8',
    fontSize: 22,
    fontWeight: '800'
  },
  statusPill: {
    backgroundColor: '#451a03',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#b45309'
  },
  statusPillText: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '700'
  },
  successRecapCard: {
    width: '100%',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155'
  },
  recapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5
  },
  recapLabel: {
    color: '#94a3b8',
    fontSize: 13
  },
  recapValue: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600'
  },
  successActions: {
    width: '100%'
  }
});
