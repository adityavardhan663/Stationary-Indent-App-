import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, radii, spacing, typography } from '../theme';

export default function LoadingState({
  message = 'Loading records...',
  skeleton = false,
  count = 3,
  style
}) {
  if (skeleton) {
    return (
      <View style={[styles.skeletonContainer, style]}>
        {Array.from({ length: count }).map((_, idx) => (
          <View key={idx} style={styles.skeletonCard}>
            <View style={styles.skeletonRow}>
              <View style={styles.skeletonBarTitle} />
              <View style={styles.skeletonBarBadge} />
            </View>
            <View style={styles.skeletonBarSubtitle} />
            <View style={styles.skeletonBarItem} />
            <View style={styles.skeletonBarItemSmall} />
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <ActivityIndicator size="large" color={colors.primaryLight} />
      {message ? <Text style={styles.message}>{message}</Text> : null}
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
  message: {
    color: colors.textMuted,
    fontSize: typography.sm,
    marginTop: spacing.md,
    textAlign: 'center'
  },
  skeletonContainer: {
    paddingVertical: spacing.sm
  },
  skeletonCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    opacity: 0.65
  },
  skeletonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm
  },
  skeletonBarTitle: {
    width: 120,
    height: 18,
    borderRadius: radii.xs,
    backgroundColor: colors.border
  },
  skeletonBarBadge: {
    width: 70,
    height: 18,
    borderRadius: radii.xs,
    backgroundColor: colors.border
  },
  skeletonBarSubtitle: {
    width: 90,
    height: 12,
    borderRadius: radii.xs,
    backgroundColor: colors.borderSubtle,
    marginBottom: spacing.md
  },
  skeletonBarItem: {
    width: '85%',
    height: 14,
    borderRadius: radii.xs,
    backgroundColor: colors.borderSubtle,
    marginBottom: spacing.xs
  },
  skeletonBarItemSmall: {
    width: '60%',
    height: 14,
    borderRadius: radii.xs,
    backgroundColor: colors.borderSubtle
  }
});
