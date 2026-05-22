import DateTimePicker from '@react-native-community/datetimepicker';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { R, S, T, getEditorialPalette } from '../../theme/editorial';
import { useTheme } from '../../theme/ThemeContext';

interface Props {
  value: string | undefined;
  onChange: (date: string) => void;
  label?: string;
  required?: boolean;
}

export default function DatePickerField({ value, onChange, label, required }: Props) {
  const { theme } = useTheme();
  const palette = getEditorialPalette(theme);
  const [show, setShow] = useState(false);

  const dateObj = value ? new Date(value + 'T12:00:00') : new Date();

  const displayText = value
    ? new Date(value + 'T12:00:00').toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })
    : required
    ? 'Wybierz datę...'
    : 'Brak daty (opcjonalne)';

  const handleChange = (_event: unknown, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShow(false);
    if (selectedDate) {
      onChange(selectedDate.toISOString().split('T')[0]);
    }
  };

  return (
    <View>
      {label ? (
        <Text style={[T.labelBold, styles.label, { color: palette.textSoft }]}>
          {label}{required ? ' *' : ''}
        </Text>
      ) : null}
      <TouchableOpacity
        onPress={() => setShow(true)}
        style={[styles.trigger, { backgroundColor: palette.inputSurface }]}
        accessibilityRole="button"
      >
        <Ionicons name="calendar-outline" size={18} color={palette.textSoft} />
        <Text style={[T.body, styles.triggerText, { color: value ? palette.text : palette.textSoft }]}>
          {displayText}
        </Text>
      </TouchableOpacity>

      {show && Platform.OS === 'android' && (
        <DateTimePicker
          value={dateObj}
          mode="date"
          display="default"
          onChange={handleChange}
        />
      )}

      {show && Platform.OS === 'ios' && (
        <Modal transparent animationType="slide" onRequestClose={() => setShow(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalBox, { backgroundColor: palette.surface }]}>
              <TouchableOpacity onPress={() => setShow(false)} style={styles.doneBtn}>
                <Text style={[T.labelBold, { color: palette.primary }]}>Gotowe</Text>
              </TouchableOpacity>
              <DateTimePicker
                value={dateObj}
                mode="date"
                display="spinner"
                onChange={handleChange}
                locale="pl"
                style={{ width: '100%' }}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: S[1] },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: R.md,
    paddingHorizontal: S[3],
    paddingVertical: S[3],
    gap: S[2],
  },
  triggerText: { flex: 1 },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalBox: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: S[4],
    paddingBottom: S[6],
  },
  doneBtn: {
    alignSelf: 'flex-end',
    padding: S[2],
    marginBottom: S[2],
  },
});
