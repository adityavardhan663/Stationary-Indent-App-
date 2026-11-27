import React, { useRef } from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  Animated,
  View
} from 'react-native';
import { colors, radii, spacing, typography, layout } from '../theme';
import { triggerHaptic } from '../utils/haptics';

export default function PrimaryButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary', // 'primary' | 'success' | 'danger' | 'secondary' | 'outline'
  icon = null,
  style,
  textStyle,
  ...rest
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (disabled || loading) return;
    Animated.timing(scaleAnim, {
      toValue: 0.97,
      duration: 100,
      useNativeDriver: true
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 120,
      useNativeDriver: true
    }).start();
  };

  const handlePress = (e) => {
    if (disabled || loading) return;
    triggerHaptic('selection');
    if (onPress) onPress(e);
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return {
          button: { backgroundColor: colors.success },
          text: { color: '#ffffff' }
        };
      case 'danger':
        return {
          button: { backgroundColor: colors.danger },
          text: { color: '#ffffff' }
        };
      case 'secondary':
        return {
          button: {
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border
          },
          text: { color: colors.textSecondary }
        };
      case 'outline':
        return {
          button: {
            backgroundColor: 'transparent',
            borderWidth: 1,
            borderColor: colors.borderFocus
          },
          text: { color: colors.primaryLight }
        };
      case 'primary':
      default:
        return {
          button: { backgroundColor: colors.primary },
          text: { color: '#ffffff' }
        };
    }
  };

  const vStyles = getVariantStyles();

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        style={[
          styles.buttonBase,
          vStyles.button,
          (disabled || loading) && styles.disabled
        ]}
        {...rest}>
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#ffffff" style={styles.spinner} />
            <Text style={[styles.textBase, vStyles.text, textStyle]}>Processing...</Text>
          </View>
        ) : (
          <View style={styles.contentRow}>
            {icon && <View style={styles.iconWrapper}>{icon}</View>}
            <Text style={[styles.textBase, vStyles.text, textStyle]}>{title}</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  buttonBase: {
    minHeight: layout.minTouchTarget,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row'
  },
  disabled: {
    opacity: 0.55
  },
  textBase: {
    fontSize: typography.md,
    fontWeight: '700',
    letterSpacing: 0.3,
    textAlign: 'center'
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  iconWrapper: {
    marginRight: spacing.sm
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  spinner: {
    marginRight: spacing.sm
  }
});
