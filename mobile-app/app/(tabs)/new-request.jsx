import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import client from '../../src/api/client';
import { authenticateBiometrics } from '../../src/biometrics/confirm';

export default function NewRequestScreen() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [remarks, setRemarks] = useState('');

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await client.get('/items');
      setItems(res.data?.data || []);
    } catch (err) {
      Alert.alert('Error', 'Unable to fetch stationery items from store');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const updateCartQty = (item, delta) => {
    const existing = cart.find(c => c.itemId === item._id);
    if (!existing && delta > 0) {
      setCart([...cart, { itemId: item._id, name: item.name, unit: item.unit, qty: 1 }]);
    } else if (existing) {
      const newQty = existing.qty + delta;
      if (newQty <= 0) {
        setCart(cart.filter(c => c.itemId !== item._id));
      } else {
        setCart(cart.map(c => c.itemId === item._id ? { ...c, qty: newQty } : c));
      }
    }
  };

  const handleFingerprintSubmit = async () => {
    if (cart.length === 0) {
      Alert.alert('Empty Cart', 'Please add items before submitting an indent');
      return;
    }

    setSubmitting(true);
    try {
      // Phase 12: Trigger Biometric Check
      const authResult = await authenticateBiometrics('Touch fingerprint sensor to confirm your stationery indent');

      if (!authResult.success) {
        Alert.alert('Biometric Verification Failed', 'Requisition was not submitted.');
        setSubmitting(false);
        return;
      }

      // Send to backend with biometric confirmation metadata
      const payload = {
        items: cart.map(c => ({ itemId: c.itemId, quantity: c.qty })),
        confirmation: {
          method: authResult.method || 'biometric',
          deviceId: 'dev-phone-app'
        },
        remarks: remarks.trim()
      };

      const res = await client.post('/indents', payload);
      if (res.data?.data) {
        Alert.alert('Indent Confirmed!', `Requisition number: ${res.data.data.indentNo}\nPlease collect from store counter.`);
        setCart([]);
        setRemarks('');
      }
    } catch (err) {
      Alert.alert('Submission Error', err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredItems = items.filter(it => 
    !search || it.name.toLowerCase().includes(search.toLowerCase()) || (it.code && it.code.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search items (paper, pen, files...)"
        placeholderTextColor="#64748b"
        value={search}
        onChangeText={setSearch}
      />

      <FlatList
        data={filteredItems}
        keyExtractor={item => item._id}
        refreshing={loading}
        onRefresh={fetchItems}
        renderItem={({ item }) => {
          const inCart = cart.find(c => c.itemId === item._id);
          return (
            <View style={styles.itemCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemMeta}>Code: {item.code || 'N/A'} &bull; Available: {item.stock} {item.unit}</Text>
              </View>
              <View style={styles.qtyControls}>
                {inCart ? (
                  <>
                    <TouchableOpacity onPress={() => updateCartQty(item, -1)} style={styles.qtyBtn}>
                      <Text style={styles.qtyBtnText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.qtyCount}>{inCart.qty}</Text>
                    <TouchableOpacity onPress={() => updateCartQty(item, 1)} style={styles.qtyBtn}>
                      <Text style={styles.qtyBtnText}>+</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity onPress={() => updateCartQty(item, 1)} style={styles.addBtn}>
                    <Text style={styles.addBtnText}>Add</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        }}
      />

      {cart.length > 0 && (
        <View style={styles.cartFooter}>
          <Text style={styles.cartTitle}>{cart.length} item(s) selected in requisition</Text>
          <TextInput
            style={styles.remarksInput}
            placeholder="Requisition purpose / remark..."
            placeholderTextColor="#64748b"
            value={remarks}
            onChangeText={setRemarks}
          />
          <TouchableOpacity 
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleFingerprintSubmit}
            disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>Confirm with Fingerprint</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.reviewBtn}
            onPress={() => router.push({ pathname: '/confirm', params: { items: JSON.stringify(cart), remarks } })}
            disabled={submitting}>
            <Text style={styles.reviewBtnText}>Review Summary Screen &rarr;</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090d16', padding: 14 },
  searchInput: { backgroundColor: '#1e293b', color: '#fff', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 14 },
  itemCard: { backgroundColor: '#1e293b', borderRadius: 10, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  itemName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  itemMeta: { color: '#94a3b8', fontSize: 12, marginTop: 4 },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn: { width: 32, height: 32, backgroundColor: '#334155', borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  qtyBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  qtyCount: { color: '#fff', fontSize: 15, fontWeight: '700', paddingHorizontal: 6 },
  addBtn: { backgroundColor: '#2563eb', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6 },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  cartFooter: { backgroundColor: '#0f172a', borderTopWidth: 1, borderColor: '#1e293b', padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  cartTitle: { color: '#cbd5e1', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  remarksInput: { backgroundColor: '#1e293b', color: '#fff', borderRadius: 6, padding: 10, fontSize: 13, marginBottom: 10 },
  submitBtn: { backgroundColor: '#16a34a', borderRadius: 10, padding: 14, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  reviewBtn: { marginTop: 8, padding: 10, alignItems: 'center' },
  reviewBtnText: { color: '#38bdf8', fontSize: 13, fontWeight: '600' }
});
