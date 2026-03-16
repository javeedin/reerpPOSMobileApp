import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';

const AutoPilotScreen = () => {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'assistant',
      text: "Hi! I'm Lucy, your AutoPilot assistant. I can help you with sales insights, order queries, inventory checks, and more. Try asking me something like:",
    },
    {
      id: 2,
      type: 'suggestion',
      suggestions: [
        'Show me last 5 days orders',
        'Who are my top 3 customers?',
        'What items sold most this week?',
        'Check stock for item 12345',
      ],
    },
  ]);

  const handleSuggestionPress = (suggestion) => {
    setQuery(suggestion);
    handleSend(suggestion);
  };

  const handleSend = (text = query) => {
    if (!text.trim()) return;

    // Add user message
    const userMessage = {
      id: Date.now(),
      type: 'user',
      text: text.trim(),
    };

    // Add placeholder response
    const assistantMessage = {
      id: Date.now() + 1,
      type: 'assistant',
      text: "I'm currently in development mode. This feature will be available soon! I'll be able to help you with sales analytics, order tracking, inventory insights, and much more.",
    };

    setMessages([...messages, userMessage, assistantMessage]);
    setQuery('');
  };

  const renderMessage = (message) => {
    if (message.type === 'suggestion') {
      return (
        <View key={message.id} style={styles.suggestionsContainer}>
          {message.suggestions.map((suggestion, index) => (
            <TouchableOpacity
              key={index}
              style={styles.suggestionChip}
              onPress={() => handleSuggestionPress(suggestion)}
            >
              <Text style={styles.suggestionText}>{suggestion}</Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    }

    const isUser = message.type === 'user';
    return (
      <View
        key={message.id}
        style={[styles.messageRow, isUser && styles.userMessageRow]}
      >
        {!isUser && (
          <View style={styles.avatarContainer}>
            <Ionicons name="sparkles" size={20} color="#FFFFFF" />
          </View>
        )}
        <View style={[styles.messageBubble, isUser && styles.userBubble]}>
          <Text style={[styles.messageText, isUser && styles.userMessageText]}>
            {message.text}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.lucyBadge}>
            <Ionicons name="sparkles" size={20} color="#FFFFFF" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Lucy</Text>
            <Text style={styles.headerSubtitle}>Your AutoPilot Assistant</Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
        >
          {messages.map(renderMessage)}
        </ScrollView>

        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Ask Lucy anything..."
              placeholderTextColor="#999999"
              value={query}
              onChangeText={setQuery}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.sendButton, !query.trim() && styles.sendButtonDisabled]}
              onPress={() => handleSend()}
              disabled={!query.trim()}
            >
              <Ionicons
                name="send"
                size={20}
                color={query.trim() ? '#FFFFFF' : '#CCCCCC'}
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  lucyBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#9C27B0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#666666',
  },
  keyboardView: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 20,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  userMessageRow: {
    justifyContent: 'flex-end',
  },
  avatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#9C27B0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  messageBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderTopLeftRadius: 4,
    padding: 14,
    maxWidth: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  userBubble: {
    backgroundColor: '#2196F3',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 4,
  },
  messageText: {
    fontSize: 15,
    color: '#1A1A1A',
    lineHeight: 22,
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  suggestionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
    paddingLeft: 46,
  },
  suggestionChip: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#81C784',
  },
  suggestionText: {
    fontSize: 13,
    color: '#2E7D32',
    fontWeight: '500',
  },
  inputContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 100,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#F5F5F5',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#1A1A1A',
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
});

export default AutoPilotScreen;
