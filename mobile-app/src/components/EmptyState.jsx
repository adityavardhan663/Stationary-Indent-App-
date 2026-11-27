import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radii, spacing, typography } from '../theme';
import PrimaryButton from './PrimaryButton';

export default function EmptyState({
  icon = '📋',
  title = 'No Records Found',
  description = 'There are no items to display at this time.',
  actionLabel,
  onAction,
  style
}) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconCircle}>
        <Text style={styles.iconText}>{icon}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {actionLabel && onAction && (
        <PrimaryButton
          title={actionLabel}
          onPress={onAction}
          style={styles.actionBtn}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center'
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md
  },
  iconText: {
    fontSize: 28
  },
  title: {
    color: colors.text,
    fontSize: typography.lg,
    fontWeight: '700',
    marginBottom: spacing.xs,
    textAlign: 'center'
  },
  description: {
    color: colors.textMuted,
    fontSize: typography.sm,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: spacing.lg,
    maxWidth: 280
  },
  actionBtn: {
    minWidth: 180
  }
});
