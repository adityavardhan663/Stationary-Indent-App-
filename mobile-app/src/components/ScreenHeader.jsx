import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radii, spacing, typography } from '../theme';

export default function ScreenHeader({
  title,
  subtitle,
  rightElement,
  style
}) {
  return (
    <View style={[styles.headerContainer, style]}>
      <View style={styles.textContainer}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {rightElement ? <View style={styles.rightWrapper}>{rightElement}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md
  },
  textContainer: {
    flex: 1,
    paddingRight: spacing.sm
  },
  title: {
    color: colors.text,
    fontSize: typography.lg,
    fontWeight: '700'
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.sm,
    marginTop: spacing.xxs
  },
  rightWrapper: {
    alignItems: 'flex-end',
    justifyContent: 'center'
  }
});
