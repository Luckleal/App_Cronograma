import DateTimePicker from '@react-native-community/datetimepicker';
import { createElement, useState, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors } from '../theme';
import { isValidISODate, isValidTime, parseISODate, toISODate } from '../utils/date';

type DateTimeFieldProps = {
  mode: 'date' | 'time';
  value: Date;
  onChange: (date: Date) => void;
  minimumDate?: Date;
  is24Hour?: boolean;
  // True when there is no value yet (e.g. an optional time never set): the web
  // input shows blank instead of `value`'s placeholder time, so picking that
  // same placeholder still fires a change event.
  empty?: boolean;
  accessibilityLabel: string;
  // Applied to the control itself: the native trigger button, or the element
  // wrapping the web <input>.
  style?: StyleProp<ViewStyle>;
  // Rendered as the trigger button's content on native (opens the OS picker on press).
  children: ReactNode;
  // Extra label shown next to the browser's native input on web, for fields where
  // `children` mixes a section label with the value (the OS picker replaces that
  // whole row on native, but the web <input> only shows the value itself).
  webLabel?: ReactNode;
  // Row style wrapping the control together with `trailing` (e.g. a "clear"
  // button). Pass a stable style even while `trailing` is momentarily absent
  // (e.g. no value set yet) — branching this on `trailing`'s own presence would
  // make the control's layout shift depending on whether a value is set, and
  // would put an iOS inline picker back inside the row instead of below it.
  containerStyle?: StyleProp<ViewStyle>;
  trailing?: ReactNode;
};

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function formatTimeValue(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function DateTimeField({
  mode,
  value,
  onChange,
  minimumDate,
  is24Hour = true,
  empty = false,
  accessibilityLabel,
  style,
  children,
  webLabel,
  containerStyle,
  trailing,
}: DateTimeFieldProps) {
  const [show, setShow] = useState(false);

  if (Platform.OS === 'web') {
    const webValue = empty ? '' : mode === 'date' ? toISODate(value) : formatTimeValue(value);
    const webMin = mode === 'date' && minimumDate ? toISODate(minimumDate) : undefined;
    const input = createElement('input', {
      type: mode,
      value: webValue,
      min: webMin,
      'aria-label': accessibilityLabel,
      style: webInputStyle,
      onChange: (event: { target: { value: string } }) => {
        const raw = event.target.value;
        if (mode === 'date') {
          if (!isValidISODate(raw)) return;
          onChange(parseISODate(raw));
        } else {
          if (!isValidTime(raw)) return;
          const [h, m] = raw.split(':').map(Number);
          const next = new Date(value);
          next.setHours(h, m, 0, 0);
          onChange(next);
        }
      },
    });

    if (containerStyle) {
      return (
        <View style={containerStyle}>
          {webLabel}
          <View style={[localStyles.fill, style]}>{input}</View>
          {trailing}
        </View>
      );
    }
    return (
      <View style={style}>
        {webLabel}
        {input}
      </View>
    );
  }

  const picker = show && (
    <DateTimePicker
      value={value}
      mode={mode}
      is24Hour={is24Hour}
      minimumDate={minimumDate}
      onChange={(event, selected) => {
        setShow(Platform.OS === 'ios');
        if (event.type === 'set' && selected) onChange(selected);
      }}
    />
  );

  if (containerStyle) {
    return (
      <>
        <View style={containerStyle}>
          <Pressable
            style={[localStyles.fill, style]}
            onPress={() => setShow(true)}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
          >
            {children}
          </Pressable>
          {trailing}
        </View>
        {picker}
      </>
    );
  }

  return (
    <>
      <Pressable
        style={style}
        onPress={() => setShow(true)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </Pressable>
      {picker}
    </>
  );
}

const localStyles = StyleSheet.create({
  fill: { flex: 1 },
});

const webInputStyle = {
  flex: 1,
  border: 'none',
  background: 'transparent',
  outline: 'none',
  padding: 0,
  fontSize: 15,
  fontFamily: 'inherit',
  color: colors.text,
};
