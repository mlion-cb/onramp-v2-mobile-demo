import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Animated, PanResponder, StyleSheet, Text, View } from "react-native";

const PRIMARY_BLUE = "#0052FF"; // Coinbase primary
const NEUTRAL_BG = "#F6F8FB";
const BORDER = "#E6E8EC";
const TEXT_PRIMARY = "#0B1B2B";
const TEXT_SECONDARY = "#3A4A5E";

type SwipeToConfirmProps = {
  label: string;
  disabled?: boolean;
  onConfirm: (reset: () => void) => void;
  isLoading?: boolean; // Add this
};


export function SwipeToConfirm({ label, disabled = false, onConfirm, isLoading = false }: SwipeToConfirmProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const knobSize = 48;
  const horizontalPadding = 4;
  const maxX = Math.max(0, trackWidth - knobSize - horizontalPadding * 2);

  const translateX = useRef(new Animated.Value(0)).current;
  const startXRef = useRef(0);
  const currentXRef = useRef(0);

  const snapBack = useCallback(() => {
    // Remove the isLoading check - back to original
    Animated.spring(translateX, { toValue: 0, useNativeDriver: false, bounciness: 6, speed: 12 }).start(() => {
      currentXRef.current = 0;
    });
  }, [translateX]); // Remove isLoading dependency

  const complete = useCallback(() => {
    Animated.timing(translateX, { toValue: maxX, duration: 150, useNativeDriver: false }).start(() => {
      currentXRef.current = maxX;
      const reset = () => snapBack();
      onConfirm(reset);
    });
  }, [maxX, onConfirm, snapBack, translateX]);

  // Add effect to handle loading state changes
  React.useEffect(() => {
    if (isLoading) {
      // Move to complete position when loading starts
      Animated.timing(translateX, { 
        toValue: maxX, 
        duration: 200, 
        useNativeDriver: false 
      }).start(() => {
        currentXRef.current = maxX;
      });
    } else {
      // Auto-reset when loading ends
      if (currentXRef.current === maxX) {
        setTimeout(() => {
          Animated.spring(translateX, { 
            toValue: 0, 
            useNativeDriver: false, 
            bounciness: 6, 
            speed: 12 
          }).start(() => {
            currentXRef.current = 0;
          });
        }, 300);
      }
    }
  }, [isLoading, maxX, translateX]);

  const pan = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled && !isLoading, // Disable during loading
        onMoveShouldSetPanResponder: (_e, g) => !disabled && !isLoading && Math.abs(g.dx) > Math.abs(g.dy) && Math.abs(g.dx) > 5,
        onStartShouldSetPanResponderCapture: () => !disabled && !isLoading,
        onMoveShouldSetPanResponderCapture: () => !disabled && !isLoading,
        onPanResponderGrant: (e) => {
          if (isLoading) return; // Extra safety check
          const localX = e.nativeEvent.locationX - knobSize / 2;
          const clamped = Math.max(0, Math.min(maxX, localX));
          startXRef.current = clamped;
          currentXRef.current = clamped;
          translateX.setValue(clamped);
        },
        onPanResponderMove: (_e, g) => {
          if (isLoading) return; // Extra safety check
          const next = Math.max(0, Math.min(maxX, startXRef.current + g.dx));
          currentXRef.current = next;
          translateX.setValue(next);
        },
        onPanResponderRelease: () => {
          if (isLoading) return; // Extra safety check
          const threshold = maxX * 0.8;
          if (currentXRef.current >= threshold) {
            complete();
          } else {
            snapBack();
          }
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderTerminate: () => {
          if (!isLoading) snapBack(); // Only snap back if not loading
        },
      }),
    [disabled, knobSize, maxX, complete, snapBack, translateX, isLoading] // Add isLoading
  );

  const progressWidth = Animated.add(translateX, new Animated.Value(knobSize));

  return (
    <View style={[styles.swipeContainer, disabled && { opacity: 0.5 }]}>
      <View
        style={styles.swipeTrack}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        {...(!isLoading ? pan.panHandlers : {})} // Only apply pan handlers when not loading
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled || isLoading }}
        accessibilityLabel={label}
      >
        <Animated.View style={[styles.swipeProgress, { width: progressWidth }]} />
        
        {/* Center text - show spinner OR label */}
        {isLoading ? (
          <ActivityIndicator size="small" color={TEXT_PRIMARY} />
        ) : (
          <Text style={styles.swipeLabel}>{label}</Text>
        )}
        
        {/* Knob - always show chevron */}
        <Animated.View style={[styles.swipeKnob, { transform: [{ translateX }] }]}>
          <Ionicons name="chevron-forward" size={22} color="#FFFFFF" />
        </Animated.View>
      </View>
    </View>
  );
}







const styles = StyleSheet.create({
  swipeContainer: {
    marginTop: 8,
  },
  swipeTrack: {
    height: 56,
    borderRadius: 28,
    backgroundColor: NEUTRAL_BG,
    borderColor: BORDER,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    justifyContent: "center",
  },
  swipeProgress: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: PRIMARY_BLUE,
    opacity: 0.15,
  },
  swipeLabel: {
    textAlign: "center",
    color: TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: "700",
  },
  swipeKnob: {
    position: "absolute",
    left: 4,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: PRIMARY_BLUE,
    alignItems: "center",
    justifyContent: "center",
  },});