import React from "react";
import { TouchableOpacity, TouchableOpacityProps, View, ViewProps } from "react-native";
import { R, cardShadow, getEditorialPalette } from "../../theme/editorial";
import { useTheme } from "../../theme/ThemeContext";

type CardProps = (ViewProps | TouchableOpacityProps) & {
    children?: React.ReactNode;
    onPress?: () => void;
};

const Card: React.FC<CardProps> = ({ children, style, onPress, ...rest }) => {
    const { theme } = useTheme();
    const palette = getEditorialPalette(theme);
    const base = [{ backgroundColor: palette.surface, borderRadius: R.lg }, cardShadow(theme), style];

    if (onPress) {
        return (
            <TouchableOpacity activeOpacity={0.88} onPress={onPress} style={base}>
                {children}
            </TouchableOpacity>
        );
    }
    return <View style={base} {...(rest as ViewProps)}>{children}</View>;
};

export default Card;
