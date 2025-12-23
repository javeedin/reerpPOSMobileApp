import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Animated,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '../theme/colors';
import { getOrders } from '../services/orderService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const STORY_DURATION = 4000; // 4 seconds per story

// Sample story data for demo
const SAMPLE_STORY_EVENTS = [
  {
    id: '1',
    type: 'day_start',
    time: '10:00 AM',
    title: 'Store Opened',
    subtitle: 'A new day begins!',
    icon: 'sunny',
    color: '#FF9500',
  },
  {
    id: '2',
    type: 'order',
    time: '10:15 AM',
    title: 'First Order!',
    subtitle: 'Customer: John Smith',
    amount: 'MUR 1,250.00',
    items: 3,
    icon: 'cart',
    color: '#4CAF50',
  },
  {
    id: '3',
    type: 'idle',
    time: '10:30 AM',
    title: 'Quiet Time',
    subtitle: '45 minutes of peace',
    icon: 'cafe',
    color: '#9C27B0',
  },
  {
    id: '4',
    type: 'order',
    time: '11:15 AM',
    title: 'Order #102',
    subtitle: 'Customer: Sarah Johnson',
    amount: 'MUR 3,450.00',
    items: 7,
    icon: 'cart',
    color: '#2196F3',
  },
  {
    id: '5',
    type: 'order',
    time: '11:45 AM',
    title: 'Order #103',
    subtitle: 'Customer: Mike Chen',
    amount: 'MUR 890.00',
    items: 2,
    icon: 'cart',
    color: '#00BCD4',
  },
  {
    id: '6',
    type: 'milestone',
    time: '12:00 PM',
    title: 'Lunch Rush!',
    subtitle: '5 orders in the last hour',
    icon: 'trending-up',
    color: '#FF5722',
  },
  {
    id: '7',
    type: 'order',
    time: '12:30 PM',
    title: 'Big Order!',
    subtitle: 'Customer: ABC Corp',
    amount: 'MUR 12,500.00',
    items: 15,
    icon: 'star',
    color: '#FFD700',
    highlight: true,
  },
  {
    id: '8',
    type: 'idle',
    time: '02:00 PM',
    title: 'Afternoon Break',
    subtitle: '1 hour 30 minutes quiet',
    icon: 'partly-sunny',
    color: '#607D8B',
  },
  {
    id: '9',
    type: 'order',
    time: '03:30 PM',
    title: 'Order #108',
    subtitle: 'Customer: Lisa Wong',
    amount: 'MUR 2,100.00',
    items: 4,
    icon: 'cart',
    color: '#E91E63',
  },
  {
    id: '10',
    type: 'payment',
    time: '04:00 PM',
    title: 'Payment Received',
    subtitle: 'Invoice #INV-2024-001 paid',
    amount: 'MUR 15,000.00',
    icon: 'card',
    color: '#4CAF50',
  },
  {
    id: '11',
    type: 'summary',
    time: '08:00 PM',
    title: 'Day Complete!',
    subtitle: 'Great work today!',
    totalOrders: 12,
    totalAmount: 'MUR 45,890.00',
    icon: 'trophy',
    color: '#FFD700',
  },
];

// Get background gradient based on time
const getTimeGradient = (time) => {
  const hour = parseInt(time.split(':')[0]);
  const isPM = time.includes('PM');
  const hour24 = isPM && hour !== 12 ? hour + 12 : hour;

  if (hour24 >= 6 && hour24 < 10) {
    return ['#FF9500', '#FF5722']; // Morning
  } else if (hour24 >= 10 && hour24 < 14) {
    return ['#2196F3', '#00BCD4']; // Late Morning
  } else if (hour24 >= 14 && hour24 < 17) {
    return ['#9C27B0', '#E91E63']; // Afternoon
  } else if (hour24 >= 17 && hour24 < 20) {
    return ['#FF5722', '#E91E63']; // Evening
  } else {
    return ['#1A237E', '#311B92']; // Night
  }
};

// Story Card Component
const StoryCard = ({ event, isActive }) => {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isActive) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.8);
      opacityAnim.setValue(0);
    }
  }, [isActive]);

  if (event.type === 'summary') {
    return (
      <Animated.View
        style={[
          styles.storyCard,
          styles.summaryCard,
          { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
        ]}
      >
        <View style={[styles.iconContainer, { backgroundColor: event.color + '30' }]}>
          <Ionicons name={event.icon} size={60} color={event.color} />
        </View>
        <Text style={styles.summaryTitle}>{event.title}</Text>
        <Text style={styles.summarySubtitle}>{event.subtitle}</Text>

        <View style={styles.summaryStats}>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryStatValue}>{event.totalOrders}</Text>
            <Text style={styles.summaryStatLabel}>Orders</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryStat}>
            <Text style={styles.summaryStatValue}>{event.totalAmount}</Text>
            <Text style={styles.summaryStatLabel}>Total Sales</Text>
          </View>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.storyCard,
        event.highlight && styles.highlightCard,
        { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
      ]}
    >
      <Text style={styles.storyTime}>{event.time}</Text>

      <View style={[styles.iconContainer, { backgroundColor: event.color + '30' }]}>
        <Ionicons name={event.icon} size={48} color={event.color} />
      </View>

      <Text style={styles.storyTitle}>{event.title}</Text>
      <Text style={styles.storySubtitle}>{event.subtitle}</Text>

      {event.amount && (
        <View style={styles.amountContainer}>
          <Text style={styles.amountLabel}>Amount</Text>
          <Text style={styles.amountValue}>{event.amount}</Text>
        </View>
      )}

      {event.items && (
        <View style={styles.itemsContainer}>
          <Ionicons name="cube-outline" size={16} color={colors.textMuted} />
          <Text style={styles.itemsText}>{event.items} items</Text>
        </View>
      )}

      {event.highlight && (
        <View style={styles.highlightBadge}>
          <Ionicons name="star" size={14} color="#FFD700" />
          <Text style={styles.highlightText}>Best Order!</Text>
        </View>
      )}
    </Animated.View>
  );
};

const StoryScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [storyEvents, setStoryEvents] = useState(SAMPLE_STORY_EVENTS);
  const [isLoading, setIsLoading] = useState(false);
  const progressAnims = useRef(storyEvents.map(() => new Animated.Value(0))).current;
  const timerRef = useRef(null);

  // Start progress animation
  const startProgress = (index) => {
    // Reset current and future progress bars
    for (let i = index; i < progressAnims.length; i++) {
      progressAnims[i].setValue(0);
    }

    // Animate current progress bar
    Animated.timing(progressAnims[index], {
      toValue: 1,
      duration: STORY_DURATION,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && !isPaused) {
        goToNext();
      }
    });
  };

  // Go to next story
  const goToNext = () => {
    if (currentIndex < storyEvents.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // End of stories
      navigation.goBack();
    }
  };

  // Go to previous story
  const goToPrevious = () => {
    if (currentIndex > 0) {
      progressAnims[currentIndex].setValue(0);
      setCurrentIndex(currentIndex - 1);
    }
  };

  // Handle screen tap
  const handleTap = (event) => {
    const { locationX } = event.nativeEvent;
    if (locationX < SCREEN_WIDTH / 3) {
      goToPrevious();
    } else if (locationX > (SCREEN_WIDTH * 2) / 3) {
      goToNext();
    } else {
      setIsPaused(!isPaused);
    }
  };

  // Start/pause progress when index changes
  useEffect(() => {
    if (!isPaused) {
      startProgress(currentIndex);
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [currentIndex, isPaused]);

  // Load today's story
  const loadTodayStory = async () => {
    setIsLoading(true);
    try {
      const orders = await getOrders();
      const today = new Date().toDateString();

      // Filter today's orders
      const todayOrders = orders.filter(order => {
        const orderDate = new Date(order.createdAt).toDateString();
        return orderDate === today;
      });

      if (todayOrders.length === 0) {
        // No orders today, show sample
        setStoryEvents(SAMPLE_STORY_EVENTS);
        return;
      }

      // Convert orders to story events
      const events = [];

      // Day start
      events.push({
        id: 'start',
        type: 'day_start',
        time: '10:00 AM',
        title: 'Store Opened',
        subtitle: "Let's see what happened today!",
        icon: 'sunny',
        color: '#FF9500',
      });

      let totalAmount = 0;
      let lastOrderTime = null;

      todayOrders.forEach((order, index) => {
        const orderTime = new Date(order.createdAt);
        const timeStr = orderTime.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });

        // Check for idle time
        if (lastOrderTime) {
          const idleMinutes = (orderTime - lastOrderTime) / (1000 * 60);
          if (idleMinutes > 30) {
            events.push({
              id: `idle-${index}`,
              type: 'idle',
              time: lastOrderTime.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              }),
              title: 'Quiet Time',
              subtitle: `${Math.round(idleMinutes)} minutes break`,
              icon: 'cafe',
              color: '#9C27B0',
            });
          }
        }

        const orderAmount = order.total || order.totalAmount || 0;
        totalAmount += orderAmount;

        events.push({
          id: order.id,
          type: 'order',
          time: timeStr,
          title: `Order #${order.orderNumber || index + 1}`,
          subtitle: `Customer: ${order.customerName || 'Walk-in'}`,
          amount: `MUR ${orderAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          items: order.items?.length || 0,
          icon: orderAmount > 5000 ? 'star' : 'cart',
          color: orderAmount > 5000 ? '#FFD700' : '#4CAF50',
          highlight: orderAmount > 5000,
        });

        lastOrderTime = orderTime;
      });

      // Day summary
      events.push({
        id: 'summary',
        type: 'summary',
        time: '08:00 PM',
        title: 'Day Complete!',
        subtitle: 'Great work today!',
        totalOrders: todayOrders.length,
        totalAmount: `MUR ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        icon: 'trophy',
        color: '#FFD700',
      });

      setStoryEvents(events);
      setCurrentIndex(0);
      progressAnims.forEach(anim => anim.setValue(0));
    } catch (error) {
      console.error('Error loading story:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const currentEvent = storyEvents[currentIndex];
  const gradientColors = getTimeGradient(currentEvent?.time || '12:00 PM');

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <LinearGradient colors={gradientColors} style={styles.background}>
        {/* Progress Bars */}
        <View style={[styles.progressContainer, { paddingTop: insets.top + 10 }]}>
          {storyEvents.map((_, index) => (
            <View key={index} style={styles.progressBarBg}>
              <Animated.View
                style={[
                  styles.progressBarFill,
                  {
                    width: progressAnims[index].interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>
          ))}
        </View>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Ionicons name="today" size={20} color="#FFFFFF" />
            <Text style={styles.headerTitle}>Today's Story</Text>
          </View>
          <TouchableOpacity onPress={loadTodayStory} style={styles.refreshBtn}>
            <Ionicons name="refresh" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Touch Areas */}
        <TouchableOpacity
          style={styles.touchArea}
          activeOpacity={1}
          onPress={handleTap}
        >
          {/* Story Card */}
          <View style={styles.cardContainer}>
            {currentEvent && (
              <StoryCard event={currentEvent} isActive={true} />
            )}
          </View>

          {/* Pause Indicator */}
          {isPaused && (
            <View style={styles.pauseIndicator}>
              <Ionicons name="pause" size={40} color="rgba(255,255,255,0.8)" />
            </View>
          )}
        </TouchableOpacity>

        {/* Navigation Hints */}
        <View style={[styles.navHints, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.navHint}>
            <Ionicons name="chevron-back" size={16} color="rgba(255,255,255,0.6)" />
            <Text style={styles.navHintText}>Previous</Text>
          </View>
          <View style={styles.navHint}>
            <Ionicons name="pause" size={16} color="rgba(255,255,255,0.6)" />
            <Text style={styles.navHintText}>Pause</Text>
          </View>
          <View style={styles.navHint}>
            <Text style={styles.navHintText}>Next</Text>
            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.6)" />
          </View>
        </View>

        {/* Load Today Button */}
        <View style={[styles.loadTodayContainer, { bottom: insets.bottom + 60 }]}>
          <TouchableOpacity
            style={styles.loadTodayBtn}
            onPress={loadTodayStory}
            disabled={isLoading}
          >
            <Ionicons
              name={isLoading ? 'hourglass' : 'calendar-outline'}
              size={18}
              color="#FFFFFF"
            />
            <Text style={styles.loadTodayText}>
              {isLoading ? 'Loading...' : "Load Today's Story"}
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  progressContainer: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    gap: 4,
  },
  progressBarBg: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  closeBtn: {
    padding: 4,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  refreshBtn: {
    padding: 4,
  },
  touchArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContainer: {
    width: SCREEN_WIDTH - 40,
    alignItems: 'center',
  },
  storyCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  highlightCard: {
    backgroundColor: '#FFF9E6',
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  summaryCard: {
    backgroundColor: 'rgba(255,255,255,0.98)',
  },
  storyTime: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '500',
    marginBottom: 16,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  storyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  storySubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  amountContainer: {
    backgroundColor: colors.accentGreen + '15',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  amountLabel: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.accentGreen,
    textAlign: 'center',
  },
  itemsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  itemsText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  highlightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD700',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 16,
    gap: 6,
  },
  highlightText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
  },
  summaryTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  summarySubtitle: {
    fontSize: 18,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  summaryStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    width: '100%',
  },
  summaryStat: {
    flex: 1,
    alignItems: 'center',
  },
  summaryStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.accent,
    marginBottom: 4,
  },
  summaryStatLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
  pauseIndicator: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 50,
    padding: 20,
  },
  navHints: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  navHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  navHintText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  loadTodayContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  loadTodayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    gap: 8,
  },
  loadTodayText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default StoryScreen;
