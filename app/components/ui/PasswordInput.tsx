import Ionicons from '@expo/vector-icons/Ionicons';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

type Props = {
  value: string;
  onChangeText: (t: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  testID?: string;
  secure?: boolean; // default true
};

// This component avoids clearing the field on toggle by forcing a remount of the TextInput
const PasswordInput = forwardRef<TextInput, Props>(({ value, onChangeText, onBlur, placeholder, testID }, ref) => {
  const { theme } = useTheme();
  const [show, setShow] = useState(false);
  const [keyVer, setKeyVer] = useState(0);
  const inputRef = useRef<TextInput | null>(null);

  // expose the native ref
  useImperativeHandle(ref, () => inputRef.current as TextInput);

  // When toggling visibility, bump key to remount TextInput. Controlled value preserves text.
  const toggle = () => {
    setShow(s => !s);
    setKeyVer(k => k + 1);
    // refocus after remount
    setTimeout(() => inputRef.current?.focus?.(), 50);
  };

  useEffect(() => {
    // keep cursor at end when value changes programmatically
    try {
      if (inputRef.current && (inputRef.current as any).setNativeProps) {
        (inputRef.current as any).setNativeProps({ selection: { start: value?.length ?? 0, end: value?.length ?? 0 } });
      }
    } catch {
      // ignore
    }
  }, [value]);

  return (
    <View style={{ position: 'relative', overflow: 'hidden' }}>
      <TextInput
        key={`pw-${keyVer}`}
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        secureTextEntry={!show}
        placeholder={placeholder}
        testID={testID}
        className={`${theme === 'dark' ? 'bg-neutral-900 border border-neutral-800 text-white' : 'bg-white border border-gray-200 text-black'} rounded-xl`}
        style={{ padding: 12, paddingRight: 44 }}
      />
      <TouchableOpacity
        onPress={toggle}
        // increase tappable area without changing icon size and center vertically
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={{ position: 'absolute', right: 10, top: 0, bottom: 0, justifyContent: 'center', padding: 6 }}
        accessibilityLabel={show ? 'Ukryj hasło' : 'Pokaż hasło'}
      >
        <Ionicons name={show ? 'eye-off' : 'eye'} size={18} color={theme === 'dark' ? '#fff' : '#000'} />
      </TouchableOpacity>
    </View>
  );
});

export default PasswordInput;

// Add display name for better React DevTools and to satisfy eslint react/display-name
PasswordInput.displayName = 'PasswordInput';
