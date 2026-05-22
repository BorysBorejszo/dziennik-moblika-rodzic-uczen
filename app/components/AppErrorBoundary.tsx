import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

interface Props { children: ReactNode; }
interface State { hasError: boolean; }

function FallbackUI({ onReset }: { onReset: () => void }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' }}>
        Coś poszło nie tak
      </Text>
      <Text style={{ color: '#6b7280', textAlign: 'center', marginBottom: 32 }}>
        Wystąpił nieoczekiwany błąd. Spróbuj odświeżyć aplikację.
      </Text>
      <TouchableOpacity
        onPress={onReset}
        style={{ backgroundColor: '#3b82f6', padding: 16, borderRadius: 12, width: '100%' }}
        accessibilityRole="button"
      >
        <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '600' }}>
          Odśwież aplikację
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (__DEV__) console.error('[AppErrorBoundary] Uncaught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return <FallbackUI onReset={() => this.setState({ hasError: false })} />;
    }
    return this.props.children;
  }
}
