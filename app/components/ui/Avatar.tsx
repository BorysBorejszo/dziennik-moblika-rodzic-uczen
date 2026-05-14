import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

type AvatarProps = {
  label: string;
  size?: number; // not used for tailwind sizing but kept for future
  unread?: boolean;
};

const Avatar: React.FC<AvatarProps> = ({ label, unread, size = 48 }) => {
  const { theme } = useTheme();
  const bg = theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100';
  const textClass = 'text-blue-500 font-semibold text-lg';
  return (
    <View className={`w-12 h-12 rounded-full ${bg} items-center justify-center mr-3`}>
      <Text className={textClass}>{label}</Text>
      {unread && <View className="absolute -right-0.5 -top-0.5 w-2 h-2 rounded-full bg-blue-500" />}
    </View>
  );
};

export default Avatar;
