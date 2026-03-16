import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Animated,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '../theme/colors';
import { getOrders, ORDER_STATUS, PAYMENT_METHODS } from '../services/orderService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SNAKE_WIDTH = 4;
const NODE_SIZE = 16;
const ANIMATION_DELAY = 150; // ms between each node animation
const STORE_CLOSE_HOUR = 20; // 8 PM

// Get the current status event (dynamic based on time)
const getCurrentStatusEvent = () => {
  const now = new Date();
  const currentHour = now.getHours();
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  if (currentHour >= STORE_CLOSE_HOUR) {
    return {
      id: 'end',
      type: 'day_end',
      time: '08:00 PM',
      title: 'Store Closed',
      subtitle: 'Great day! See you tomorrow!',
      icon: 'moon',
      color: '#1A237E',
    };
  } else {
    // Store is still open - show waiting message
    const waitingMessages = [
      { title: 'Ready for Next Order!', subtitle: 'Waiting for customers...', icon: 'hourglass-outline', color: '#4CAF50' },
      { title: 'Standing By...', subtitle: 'Your next order awaits!', icon: 'pulse', color: '#2196F3' },
      { title: 'Open for Business', subtitle: "Let's keep the momentum going!", icon: 'storefront', color: '#FF9800' },
    ];
    const randomMsg = waitingMessages[Math.floor(Math.random() * waitingMessages.length)];

    return {
      id: 'waiting',
      type: 'waiting',
      time: timeStr,
      title: randomMsg.title,
      subtitle: randomMsg.subtitle,
      icon: randomMsg.icon,
      color: randomMsg.color,
      isLive: true,
    };
  }
};

// Sample story data for demo (showing a complete day)
const SAMPLE_STORY_EVENTS = [
  { id: '1', type: 'day_start', time: '10:00 AM', title: 'Store Opened', subtitle: 'Ready for business!', icon: 'sunny', color: '#FF9500' },
  { id: '2', type: 'order', time: '10:15 AM', title: 'First Order!', customer: 'John Smith', amount: 1250, items: 3, paymentMethod: 'CASH', icon: 'cart', color: '#4CAF50' },
  { id: '3', type: 'idle', time: '10:30 AM', title: 'Quiet Time', duration: '45 min', icon: 'cafe', color: '#9C27B0' },
  { id: '4', type: 'order', time: '11:15 AM', title: 'Order #102', customer: 'Sarah Johnson', amount: 3450, items: 7, paymentMethod: 'CARD', icon: 'cart', color: '#2196F3' },
  { id: '5', type: 'order', time: '11:45 AM', title: 'Order #103', customer: 'Mike Chen', amount: 890, items: 2, paymentMethod: 'MCB_JUICE', icon: 'cart', color: '#00BCD4' },
  { id: '6', type: 'rush', time: '12:00 PM', title: 'Lunch Rush!', subtitle: '5 orders in 1 hour', icon: 'trending-up', color: '#FF5722' },
  { id: '7', type: 'order', time: '12:30 PM', title: 'Big Order!', customer: 'ABC Corp', amount: 12500, items: 15, paymentMethod: 'CARD', icon: 'star', color: '#FFD700', highlight: true },
  { id: '8', type: 'order', time: '01:00 PM', title: 'Order #105', customer: 'Emma Wilson', amount: 2200, items: 4, paymentMethod: 'CASH', icon: 'cart', color: '#4CAF50' },
  { id: '9', type: 'idle', time: '02:00 PM', title: 'Afternoon Break', duration: '1h 30min', icon: 'partly-sunny', color: '#607D8B' },
  { id: '10', type: 'order', time: '03:30 PM', title: 'Order #108', customer: 'Lisa Wong', amount: 2100, items: 4, paymentMethod: 'CARD', icon: 'cart', color: '#E91E63' },
  { id: '11', type: 'order', time: '04:15 PM', title: 'Order #109', customer: 'Tom Brown', amount: 1800, items: 3, paymentMethod: 'MCB_JUICE', icon: 'cart', color: '#3F51B5' },
  { id: '12', type: 'order', time: '05:00 PM', title: 'Order #110', customer: 'Grace Lee', amount: 4500, items: 8, paymentMethod: 'CASH', icon: 'cart', color: '#009688' },
  { id: '13', type: 'order', time: '06:30 PM', title: 'Order #111', customer: 'David Park', amount: 3200, items: 5, paymentMethod: 'CARD', icon: 'cart', color: '#795548' },
  { id: '14', type: 'order', time: '07:30 PM', title: 'Last Order', customer: 'Amy Chen', amount: 1560, items: 3, paymentMethod: 'CASH', icon: 'cart', color: '#607D8B' },
  { id: '15', type: 'day_end', time: '08:00 PM', title: 'Store Closed', subtitle: 'Great day!', icon: 'moon', color: '#1A237E' },
];

// Timeline Node Component with snake animation
const TimelineNode = ({ event, index, isLeft, animValue, isLast }) => {
  const translateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [50, 0],
  });

  const scale = animValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 1.2, 1],
  });

  return (
    <Animated.View
      style={[
        styles.nodeContainer,
        isLeft ? styles.nodeLeft : styles.nodeRight,
        { opacity: animValue, transform: [{ translateY }] },
      ]}
    >
      {/* Connection line to center */}
      <View style={[styles.connectionLine, isLeft ? styles.connectionLeft : styles.connectionRight]} />

      {/* Node dot on the snake */}
      <Animated.View
        style={[
          styles.nodeDot,
          { backgroundColor: event.color, transform: [{ scale }] },
          isLeft ? styles.nodeDotLeft : styles.nodeDotRight,
        ]}
      />

      {/* Event Card */}
      <Animated.View
        style={[
          styles.eventCard,
          event.highlight && styles.highlightCard,
          { transform: [{ scale: animValue }] },
        ]}
      >
        <View style={styles.eventHeader}>
          <View style={[styles.eventIcon, { backgroundColor: event.color + '20' }]}>
            <Ionicons name={event.icon} size={20} color={event.color} />
          </View>
          <Text style={styles.eventTime}>{event.time}</Text>
        </View>

        <Text style={styles.eventTitle}>{event.title}</Text>

        {event.customer && (
          <Text style={styles.eventCustomer}>{event.customer}</Text>
        )}

        {event.subtitle && (
          <Text style={styles.eventSubtitle}>{event.subtitle}</Text>
        )}

        {event.duration && (
          <View style={styles.durationBadge}>
            <Ionicons name="time-outline" size={12} color={colors.textMuted} />
            <Text style={styles.durationText}>{event.duration}</Text>
          </View>
        )}

        {event.amount && (
          <View style={styles.amountRow}>
            <Text style={styles.amountText}>MUR {event.amount.toLocaleString()}</Text>
            {event.paymentMethod && (
              <View style={[styles.paymentBadge, { backgroundColor: getPaymentColor(event.paymentMethod) + '20' }]}>
                <Ionicons name={getPaymentIcon(event.paymentMethod)} size={12} color={getPaymentColor(event.paymentMethod)} />
                <Text style={[styles.paymentBadgeText, { color: getPaymentColor(event.paymentMethod) }]}>
                  {formatPaymentMethod(event.paymentMethod)}
                </Text>
              </View>
            )}
          </View>
        )}

        {event.items > 0 && (
          <Text style={styles.itemsText}>{event.items} items</Text>
        )}

        {event.highlight && (
          <View style={styles.starBadge}>
            <Ionicons name="star" size={12} color="#FFD700" />
            <Text style={styles.starText}>Best Order!</Text>
          </View>
        )}

        {event.isLive && (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        )}
      </Animated.View>
    </Animated.View>
  );
};

// Helper functions for payment methods
const getPaymentIcon = (method) => {
  switch (method) {
    case 'CASH': return 'cash-outline';
    case 'CARD': return 'card-outline';
    case 'MCB_JUICE': return 'phone-portrait-outline';
    case 'BANK_TRANSFER': return 'business-outline';
    default: return 'wallet-outline';
  }
};

const getPaymentColor = (method) => {
  switch (method) {
    case 'CASH': return '#4CAF50';
    case 'CARD': return '#2196F3';
    case 'MCB_JUICE': return '#FF9800';
    case 'BANK_TRANSFER': return '#9C27B0';
    default: return colors.textMuted;
  }
};

const formatPaymentMethod = (method) => {
  switch (method) {
    case 'MCB_JUICE': return 'Juice';
    case 'BANK_TRANSFER': return 'Bank';
    default: return method?.charAt(0) + method?.slice(1).toLowerCase();
  }
};

// Day Summary Report Component
const DaySummaryReport = ({ events, animValue }) => {
  // Calculate summary data
  const orderEvents = events.filter(e => e.type === 'order');
  const totalSales = orderEvents.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalOrders = orderEvents.length;
  const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

  // Payment breakdown
  const paymentBreakdown = {};
  orderEvents.forEach(e => {
    const method = e.paymentMethod || 'OTHER';
    if (!paymentBreakdown[method]) {
      paymentBreakdown[method] = { count: 0, total: 0 };
    }
    paymentBreakdown[method].count++;
    paymentBreakdown[method].total += e.amount || 0;
  });

  // Find best order
  const bestOrder = orderEvents.reduce((best, curr) =>
    (curr.amount || 0) > (best?.amount || 0) ? curr : best, null);

  // Find busiest hour
  const hourCounts = {};
  orderEvents.forEach(e => {
    const hour = e.time?.split(':')[0];
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });
  const busiestHour = Object.entries(hourCounts).reduce(
    (max, [hour, count]) => count > max.count ? { hour, count } : max,
    { hour: '12', count: 0 }
  );

  const translateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [100, 0],
  });

  return (
    <Animated.View
      style={[
        styles.summaryContainer,
        { opacity: animValue, transform: [{ translateY }] },
      ]}
    >
      <LinearGradient
        colors={['#1A237E', '#311B92']}
        style={styles.summaryGradient}
      >
        {/* Trophy Icon */}
        <View style={styles.trophyContainer}>
          <Ionicons name="trophy" size={50} color="#FFD700" />
        </View>

        <Text style={styles.summaryTitle}>Day Complete!</Text>
        <Text style={styles.summaryDate}>{new Date().toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })}</Text>

        {/* Main Stats */}
        <View style={styles.mainStats}>
          <View style={styles.mainStat}>
            <Text style={styles.mainStatValue}>MUR {totalSales.toLocaleString()}</Text>
            <Text style={styles.mainStatLabel}>Total Sales</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.mainStat}>
            <Text style={styles.mainStatValue}>{totalOrders}</Text>
            <Text style={styles.mainStatLabel}>Orders</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.mainStat}>
            <Text style={styles.mainStatValue}>MUR {Math.round(avgOrderValue).toLocaleString()}</Text>
            <Text style={styles.mainStatLabel}>Avg Order</Text>
          </View>
        </View>

        {/* Payment Breakdown */}
        <View style={styles.breakdownSection}>
          <Text style={styles.breakdownTitle}>Payment Breakdown</Text>
          <View style={styles.breakdownGrid}>
            {Object.entries(paymentBreakdown).map(([method, data]) => (
              <View key={method} style={styles.breakdownItem}>
                <View style={styles.breakdownItemHeader}>
                  <View style={[styles.breakdownIcon, { backgroundColor: getPaymentColor(method) + '30' }]}>
                    <Ionicons name={getPaymentIcon(method)} size={18} color={getPaymentColor(method)} />
                  </View>
                  <Text style={styles.breakdownMethodName}>{formatPaymentMethod(method)}</Text>
                </View>
                <Text style={styles.breakdownAmount}>MUR {data.total.toLocaleString()}</Text>
                <Text style={styles.breakdownCount}>{data.count} orders</Text>
                <View style={styles.breakdownBar}>
                  <View
                    style={[
                      styles.breakdownBarFill,
                      {
                        width: `${(data.total / totalSales) * 100}%`,
                        backgroundColor: getPaymentColor(method),
                      }
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Highlights */}
        <View style={styles.highlightsSection}>
          <Text style={styles.breakdownTitle}>Highlights</Text>
          <View style={styles.highlightCards}>
            {bestOrder && (
              <View style={styles.highlightCard}>
                <Ionicons name="star" size={20} color="#FFD700" />
                <Text style={styles.highlightLabel}>Best Order</Text>
                <Text style={styles.highlightValue}>MUR {bestOrder.amount?.toLocaleString()}</Text>
                <Text style={styles.highlightSub}>{bestOrder.customer}</Text>
              </View>
            )}
            <View style={styles.highlightCard}>
              <Ionicons name="time" size={20} color="#FF9800" />
              <Text style={styles.highlightLabel}>Busiest Hour</Text>
              <Text style={styles.highlightValue}>{busiestHour.hour}:00</Text>
              <Text style={styles.highlightSub}>{busiestHour.count} orders</Text>
            </View>
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
};

const StoryScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [storyEvents, setStoryEvents] = useState(SAMPLE_STORY_EVENTS);
  const [isLoading, setIsLoading] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const scrollRef = useRef(null);

  // Animation values for each node
  const nodeAnims = useRef(storyEvents.map(() => new Animated.Value(0))).current;
  const snakeAnim = useRef(new Animated.Value(0)).current;
  const summaryAnim = useRef(new Animated.Value(0)).current;

  // Animate the snake flowing and nodes appearing
  const startSnakeAnimation = useCallback(() => {
    // Reset all animations
    nodeAnims.forEach(anim => anim.setValue(0));
    snakeAnim.setValue(0);
    summaryAnim.setValue(0);
    setShowSummary(false);

    // Animate snake line first
    Animated.timing(snakeAnim, {
      toValue: 1,
      duration: storyEvents.length * ANIMATION_DELAY + 500,
      useNativeDriver: false,
    }).start();

    // Stagger animate each node
    const animations = nodeAnims.map((anim, index) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 400,
        delay: index * ANIMATION_DELAY,
        useNativeDriver: true,
      })
    );

    Animated.stagger(ANIMATION_DELAY, animations).start(() => {
      // Show summary after all nodes
      setShowSummary(true);
      Animated.spring(summaryAnim, {
        toValue: 1,
        friction: 8,
        useNativeDriver: true,
      }).start();
    });
  }, [storyEvents.length, nodeAnims, snakeAnim, summaryAnim]);

  // Start animation on mount
  useEffect(() => {
    const timer = setTimeout(startSnakeAnimation, 500);
    return () => clearTimeout(timer);
  }, [startSnakeAnimation]);

  // Load today's real story
  const loadTodayStory = async () => {
    setIsLoading(true);
    try {
      const orders = await getOrders();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Filter today's confirmed orders
      const todayOrders = orders.filter(order => {
        if (order.status !== ORDER_STATUS.CONFIRMED) return false;
        const orderDate = new Date(order.orderDate || order.createdAt);
        orderDate.setHours(0, 0, 0, 0);
        return orderDate.getTime() === today.getTime();
      }).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      if (todayOrders.length === 0) {
        setStoryEvents(SAMPLE_STORY_EVENTS);
        // Re-initialize animation values
        nodeAnims.length = SAMPLE_STORY_EVENTS.length;
        for (let i = 0; i < SAMPLE_STORY_EVENTS.length; i++) {
          if (!nodeAnims[i]) nodeAnims[i] = new Animated.Value(0);
        }
        startSnakeAnimation();
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
        subtitle: "Let's see today's story!",
        icon: 'sunny',
        color: '#FF9500',
      });

      let lastOrderTime = null;
      const eventColors = ['#4CAF50', '#2196F3', '#00BCD4', '#E91E63', '#9C27B0', '#FF5722', '#009688', '#3F51B5'];

      todayOrders.forEach((order, index) => {
        const orderTime = new Date(order.createdAt);
        const timeStr = orderTime.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });

        // Check for idle time (more than 30 minutes)
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
              duration: `${Math.round(idleMinutes)} min`,
              icon: 'cafe',
              color: '#607D8B',
            });
          }
        }

        const orderAmount = order.totals?.totalNet || order.total || 0;
        const paymentMethod = order.payments?.[0]?.method || 'CASH';
        const isBigOrder = orderAmount > 5000;

        events.push({
          id: order.id,
          type: 'order',
          time: timeStr,
          title: isBigOrder ? 'Big Order!' : `Order #${order.orderNumber || index + 1}`,
          customer: order.customer?.name || 'Walk-in Customer',
          amount: orderAmount,
          items: order.items?.length || 0,
          paymentMethod: paymentMethod,
          icon: isBigOrder ? 'star' : 'cart',
          color: isBigOrder ? '#FFD700' : eventColors[index % eventColors.length],
          highlight: isBigOrder,
        });

        lastOrderTime = orderTime;
      });

      // Add current status (closed if after 8 PM, or waiting for orders if still open)
      events.push(getCurrentStatusEvent());

      setStoryEvents(events);

      // Re-initialize animation values for new events
      while (nodeAnims.length < events.length) {
        nodeAnims.push(new Animated.Value(0));
      }

      setTimeout(startSnakeAnimation, 100);
    } catch (error) {
      console.error('Error loading story:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate snake height
  const snakeHeight = snakeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <LinearGradient colors={[colors.primaryDark, colors.primary]} style={styles.header}>
        <View style={{ height: insets.top }} />
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Ionicons name="film-outline" size={22} color="#FFFFFF" />
            <Text style={styles.headerTitle}>Today's Story</Text>
          </View>
          <TouchableOpacity onPress={loadTodayStory} style={styles.refreshBtn} disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="refresh" size={22} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Snake Timeline */}
        <View style={styles.timelineContainer}>
          {/* The Snake (center line) */}
          <View style={styles.snakeLine}>
            <Animated.View style={[styles.snakeLineFill, { height: snakeHeight }]} />
          </View>

          {/* Timeline Nodes */}
          {storyEvents.map((event, index) => (
            <TimelineNode
              key={event.id}
              event={event}
              index={index}
              isLeft={index % 2 === 0}
              animValue={nodeAnims[index] || new Animated.Value(0)}
              isLast={index === storyEvents.length - 1}
            />
          ))}
        </View>

        {/* Day Summary Report */}
        {showSummary && (
          <DaySummaryReport events={storyEvents} animValue={summaryAnim} />
        )}

        {/* Replay Button */}
        <TouchableOpacity style={styles.replayBtn} onPress={startSnakeAnimation}>
          <Ionicons name="play-circle" size={20} color={colors.accent} />
          <Text style={styles.replayText}>Replay Animation</Text>
        </TouchableOpacity>

        {/* Load Today Button */}
        <TouchableOpacity style={styles.loadTodayBtn} onPress={loadTodayStory} disabled={isLoading}>
          <Ionicons name="calendar" size={20} color="#FFFFFF" />
          <Text style={styles.loadTodayText}>
            {isLoading ? 'Loading...' : "Load Today's Actual Story"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  backBtn: {
    padding: 4,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  refreshBtn: {
    padding: 4,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 20,
    paddingHorizontal: 16,
  },
  timelineContainer: {
    position: 'relative',
    paddingVertical: 20,
  },
  // The Snake Line (center)
  snakeLine: {
    position: 'absolute',
    left: '50%',
    marginLeft: -SNAKE_WIDTH / 2,
    top: 0,
    bottom: 0,
    width: SNAKE_WIDTH,
    backgroundColor: colors.border,
    borderRadius: SNAKE_WIDTH / 2,
    overflow: 'hidden',
  },
  snakeLineFill: {
    width: '100%',
    backgroundColor: colors.accent,
    borderRadius: SNAKE_WIDTH / 2,
  },
  // Node Container
  nodeContainer: {
    width: '50%',
    paddingVertical: 8,
    paddingHorizontal: 8,
    position: 'relative',
  },
  nodeLeft: {
    alignSelf: 'flex-start',
    paddingRight: 24,
  },
  nodeRight: {
    alignSelf: 'flex-end',
    paddingLeft: 24,
  },
  // Connection line from card to snake
  connectionLine: {
    position: 'absolute',
    top: '50%',
    height: 2,
    width: 20,
    backgroundColor: colors.accent,
  },
  connectionLeft: {
    right: 8,
  },
  connectionRight: {
    left: 8,
  },
  // Node dot on the snake
  nodeDot: {
    position: 'absolute',
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    top: '50%',
    marginTop: -NODE_SIZE / 2,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  nodeDotLeft: {
    right: -NODE_SIZE / 2 - 8,
  },
  nodeDotRight: {
    left: -NODE_SIZE / 2 - 8,
  },
  // Event Card
  eventCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  highlightCard: {
    backgroundColor: '#FFF9E6',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  eventIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventTime: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  eventCustomer: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  eventSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  durationText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  amountText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.accentGreen,
  },
  paymentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  paymentBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  itemsText: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },
  starBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  starText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#000',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FF3B30',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  liveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  // Day Summary Report
  summaryContainer: {
    marginTop: 30,
    borderRadius: 20,
    overflow: 'hidden',
  },
  summaryGradient: {
    padding: 24,
    alignItems: 'center',
  },
  trophyContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,215,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  summaryDate: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 24,
  },
  mainStats: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    marginBottom: 24,
  },
  mainStat: {
    flex: 1,
    alignItems: 'center',
  },
  mainStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  mainStatLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 8,
  },
  breakdownSection: {
    width: '100%',
    marginBottom: 24,
  },
  breakdownTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  breakdownGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  breakdownItem: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 12,
    width: '48%',
  },
  breakdownItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  breakdownIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  breakdownMethodName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  breakdownAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  breakdownCount: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 8,
  },
  breakdownBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  breakdownBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  highlightsSection: {
    width: '100%',
  },
  highlightCards: {
    flexDirection: 'row',
    gap: 12,
  },
  highlightCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  highlightLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 8,
    marginBottom: 4,
  },
  highlightValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  highlightSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  // Buttons
  replayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent + '15',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 24,
    gap: 8,
  },
  replayText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent,
  },
  loadTodayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 12,
    gap: 10,
  },
  loadTodayText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default StoryScreen;
