import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radii, spacing, typography } from '../theme';
import PrimaryButton from './PrimaryButton';

export default function ErrorState({
  title = 'Unable to Load Records',
  message = 'A network or server error occurred. Please check your connection and try again.',
  onRetry,
  retryLabel = 'Retry Connection',
  style
}) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconCircle}>
        <Text style={styles.iconText}>⚠️</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <PrimaryButton
          title={retryLabel}
          onPress={onRetry}
          variant="outline"
          style={styles.retryBtn}
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
    width: 60,
    height: 60,
    borderRadius: radii.full,
    backgroundColor: colors.dangerSubtle,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md
  },
  iconText: {
    fontSize: 26
  },
  title: {
    color: colors.text,
    fontSize: typography.lg,
    fontWeight: '700',
    marginBottom: spacing.xs,
    textAlign: 'center'
  },
  message: {
    color: colors.textMuted,
    fontSize: typography.sm,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: spacing.lg,
    maxWidth: 290
  },
  retryBtn: {
    minWidth: 160
  }
});
