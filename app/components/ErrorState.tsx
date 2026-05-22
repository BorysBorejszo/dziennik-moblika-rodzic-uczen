import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

interface Props {
  message?: string;
  onRetry?: () => void;
}

export default function ErrorState({ message, onRetry }: Props) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8, textAlign: 'center' }}>
        Nie udało się załadować danych
      </Text>
      {message ? (
        <Text style={{ color: '#6b7280', textAlign: 'center', marginBottom: 24 }}>
          {message}
        </Text>
      ) : null}
      {onRetry ? (
        <TouchableOpacity
          onPress={onRetry}
          style={{ backgroundColor: '#3b82f6', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10 }}
          accessibilityRole="button"
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>Spróbuj ponownie</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
