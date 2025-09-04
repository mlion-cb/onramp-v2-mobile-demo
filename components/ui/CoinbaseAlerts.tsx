import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../../constants/Colors';

const { BLUE, DARK_BG, CARD_BG, BORDER, TEXT_PRIMARY, TEXT_SECONDARY, WHITE, BLACK } = COLORS;

type AlertType = 'success' | 'error' | 'info';

type CoinbaseAlertProps = {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  confirmText?: string;
  type?: AlertType;
};

export function CoinbaseAlert({ 
  visible, 
  title, 
  message, 
  onConfirm, 
  confirmText = "Got it",
  type = 'success' 
}: CoinbaseAlertProps) {
  const getIcon = () => {
    switch (type) {
      case 'success': return { name: 'checkmark-circle' as const, color: '#4ADE80' };
      case 'error': return { name: 'close-circle' as const, color: '#FF6B6B' };
      case 'info': return { name: 'information-circle' as const, color: BLUE };
    }
  };

  const icon = getIcon();

  return (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable style={styles.backdrop} onPress={onConfirm}>
        <Pressable style={styles.alertCard} onPress={() => {}}>
          <View style={styles.handle} />
          <View style={styles.iconContainer}>
            <Ionicons name={icon.name} size={48} color={icon.color} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <Pressable 
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={onConfirm}
          >
            <Text style={styles.buttonText}>{confirmText}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Quick alert for simple messages
export function showCoinbaseAlert(
  title: string, 
  message: string, 
  type: AlertType = 'info'
): Promise<void> {
  return new Promise((resolve) => {
    // This would need a global alert manager, but for now we'll use the component approach
    resolve();
  });
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  alertCard: {
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 20,    
    borderTopRightRadius: 20,
    marginHorizontal: 0,        
    paddingHorizontal: 20,
    paddingVertical: 24,
    paddingBottom: 34,
    alignItems: 'center',
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: BORDER,
    borderRadius: 2,
    marginBottom: 20,
    alignSelf: 'center',
  },
  iconContainer: {
    marginBottom: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  button: {
    backgroundColor: BLUE,
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 25,
    minWidth: 200,
    alignSelf: 'center',
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    color: WHITE,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
});