import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  ActivityIndicator,
  Keyboard,
  SafeAreaView
} from 'react-native';
import { Mic, ArrowRight, Zap, CheckCircle, AlertCircle } from 'lucide-react-native';
import { Audio } from 'expo-av';

import { useAuth } from '../../hooks/useAuth';
import { theme } from '../../theme/theme';
import { authenticatedFetch } from '../../services/api';
import { ChatMessage, ParsedCommand } from '../../types/chat';

export default function TerminalScreen() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: '1',
    role: 'assistant',
    content: "SwapSmith AI initialized. I can help you swap assets, check portfolio balances, scout yields, or set up DCA. How can I assist?",
    timestamp: new Date()
  }]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Audio Recording State
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const flatListRef = useRef<FlatList>(null);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);
    Keyboard.dismiss();

    try {
      // Simulate API call to the Next.js backend for parsing command
      const response = await authenticatedFetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: userMsg.content,
          history: messages.map(m => ({ role: m.role, content: m.content }))
        })
      });

      let data;
      if (response.ok) {
        data = await response.json();
      } else {
        // Fallback for demo when backend is not fully connected
        data = {
          command: {
            success: true,
            parsedMessage: `Mocked response: Processed "${userMsg.content}"`,
            intent: 'unknown',
            confidence: 80,
            validationErrors: []
          }
        };
      }

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.command?.parsedMessage || "I'm sorry, I couldn't understand that.",
        timestamp: new Date(),
        type: data.command?.requiresConfirmation ? 'intent_confirmation' : 'message',
        data: {
          parsedCommand: data.command
        }
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Network error communicating with the agent. Please try again.",
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(recording);
      setIsRecording(true);
      setRecordingDuration(0);

      // We would ideally have a timer interval here to increment duration
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      console.log('Recording saved at', uri);

      // In a real implementation we would upload this URI via FormData to the backend
      // for Whisper transcription. For demo purposes we simulate the transcription:

      setIsLoading(true);
      setTimeout(() => {
        setIsLoading(false);
        setInputText("Transcribed voice input would appear here.");
      }, 1500);

    } catch (err) {
      console.error('Failed to stop recording', err);
    }
    setRecording(null);
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';

    return (
      <View style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowAssistant]}>
        {!isUser && (
          <View style={styles.assistantAvatar}>
            <Zap color={theme.colors.accentLight} size={16} />
          </View>
        )}

        <View style={[styles.messageBubble, isUser ? styles.messageBubbleUser : styles.messageBubbleAssistant]}>
          <Text style={[styles.messageText, isUser ? styles.messageTextUser : styles.messageTextAssistant]}>
            {item.content}
          </Text>

          {item.type === 'intent_confirmation' && item.data && (item.data as any).parsedCommand && (
            <View style={styles.confirmationBox}>
              <Text style={styles.confirmationTitle}>Confirm Action:</Text>
              <View style={styles.actionDetails}>
                <Text style={styles.detailText}>Intent: {(item.data as any).parsedCommand.intent}</Text>
                {(item.data as any).parsedCommand.fromAsset ? (
                  <Text style={styles.detailText}>From: {(item.data as any).parsedCommand.amount} {(item.data as any).parsedCommand.fromAsset}</Text>
                ) : null}
                <Text style={styles.detailText}>Confidence: {(item.data as any).parsedCommand.confidence}%</Text>
              </View>
              <View style={styles.confirmButtons}>
                <TouchableOpacity style={styles.btnApprove} onPress={() => { }}>
                  <CheckCircle color="#fff" size={16} />
                  <Text style={styles.btnApproveText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnReject} onPress={() => { }}>
                  <AlertCircle color={theme.colors.error} size={16} />
                  <Text style={styles.btnRejectText}>Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Zap color={theme.colors.accentLight} size={20} />
          <Text style={styles.headerTitle}>Terminal</Text>
        </View>
        <View style={styles.statusBadge}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Connected</Text>
        </View>
      </View>

      {/* Chat Area */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.chatContainer}
        showsVerticalScrollIndicator={false}
      />

      {/* Input Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.inputContainer}>
          {isRecording ? (
            <View style={styles.recordingArea}>
              <View style={[styles.recordingDot, { opacity: Math.sin(Date.now() / 200) * 0.5 + 0.5 }]} />
              <Text style={styles.recordingText}>Recording...</Text>
              <TouchableOpacity style={styles.stopBtn} onPress={stopRecording}>
                <Text style={styles.stopBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TextInput
                style={styles.textInput}
                placeholder="Ask me to swap, or analyze assets..."
                placeholderTextColor={theme.colors.tertiary}
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={500}
                editable={!isLoading && !isRecording}
              />
              <View style={styles.inputActions}>
                {inputText.length === 0 ? (
                  <TouchableOpacity
                    style={styles.micBtn}
                    onPress={startRecording}
                    disabled={isLoading}
                  >
                    <Mic color={theme.colors.accentLight} size={22} />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.sendBtn}
                    onPress={handleSend}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator color={theme.colors.background} size="small" />
                    ) : (
                      <ArrowRight color={theme.colors.background} size={20} />
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.backgroundAlt,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: theme.colors.primary,
    fontSize: 20,
    fontFamily: theme.typography.fontFamily.bold,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(52,211,153,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.2)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.success,
  },
  statusText: {
    color: theme.colors.success,
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.bold,
    textTransform: 'uppercase',
  },
  chatContainer: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 8,
    maxWidth: '100%',
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowAssistant: {
    justifyContent: 'flex-start',
  },
  assistantAvatar: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(96,165,250,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 4,
  },
  messageBubble: {
    padding: 14,
    borderRadius: 16,
    maxWidth: '85%',
  },
  messageBubbleUser: {
    backgroundColor: theme.colors.accent,
    borderBottomRightRadius: 4,
  },
  messageBubbleAssistant: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.regular,
    lineHeight: 22,
  },
  messageTextUser: {
    color: '#fff',
  },
  messageTextAssistant: {
    color: theme.colors.primary,
  },
  confirmationBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  confirmationTitle: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: 14,
    marginBottom: 8,
  },
  actionDetails: {
    marginBottom: 12,
    gap: 4,
  },
  detailText: {
    color: theme.colors.secondary,
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: 13,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  btnApprove: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.colors.success,
    paddingVertical: 10,
    borderRadius: 8,
  },
  btnApproveText: {
    color: '#fff',
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: 13,
  },
  btnReject: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.error,
    paddingVertical: 10,
    borderRadius: 8,
  },
  btnRejectText: {
    color: theme.colors.error,
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: 13,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 100 : 80, // Account for Bottom Tab Navigator
    backgroundColor: theme.colors.backgroundAlt,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  textInput: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    minHeight: 48,
    maxHeight: 120,
    color: theme.colors.primary,
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.regular,
  },
  inputActions: {
    marginLeft: 12,
    marginBottom: 4,
  },
  micBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(96,165,250,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 24,
    height: 48,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.error,
    marginRight: 10,
  },
  recordingText: {
    flex: 1,
    color: theme.colors.error,
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: 15,
  },
  stopBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  stopBtnText: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.semibold,
  }
});
