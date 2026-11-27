import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radii, spacing, typography } from '../theme';

export default function StatusBadge({ status, size = 'md', style }) {
  const normStatus = (status || 'REQUESTED').toUpperCase();

  const getTheme = () => {
    switch (normStatus) {
      case 'APPROVED':
        return {
          bg: colors.infoSubtle,
          border: colors.infoBorder,
          text: colors.infoLight,
          label: 'APPROVED',
          icon: '✓'
        };
      case 'ISSUED':
        return {
          bg: colors.successSubtle,
          border: colors.successBorder,
          text: colors.successLight,
          label: 'ISSUED',
          icon: '✓'
        };
      case 'REJECTED':
        return {
          bg: colors.dangerSubtle,
          border: colors.dangerBorder,
          text: colors.dangerLight,
          label: 'REJECTED',
          icon: '✕'
        };
      case 'CANCELLED':
        return {
          bg: colors.neutralSubtle,
          border: colors.neutralBorder,
          text: colors.neutralLight,
          label: 'CANCELLED',
          icon: '—'
        };
      case 'REQUESTED':
      default:
        return {
          bg: colors.warningSubtle,
          border: colors.warningBorder,
          text: colors.warningLight,
          label: 'REQUESTED',
          icon: '●'
        };
    }
  };

  const badgeTheme = getTheme();
  const isSm = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: badgeTheme.bg,
          borderColor: badgeTheme.border,
          paddingHorizontal: isSm ? spacing.xs + 2 : spacing.sm,
          paddingVertical: isSm ? spacing.xxs : spacing.xs
        },
        style
      ]}>
      <Text
        style={[
          styles.text,
          {
            color: badgeTheme.text,
            fontSize: isSm ? typography.xs - 1 : typography.xs
          }
        ]}>
        {badgeTheme.icon} {badgeTheme.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radii.xs,
    borderWidth: 1,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center'
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.5
  }
});
