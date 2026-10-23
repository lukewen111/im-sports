import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { seedState } from './mockData';
import type { Channel, ChannelConversation, ChannelMessage, ChannelState } from './types';

const STORAGE_KEY = 'im-sports:channels:v1';

type Action =
  | { type: 'channel.save'; channel: Channel }
  | { type: 'channel.toggle'; id: string; enabled: boolean }
  | { type: 'channel.connected'; id: string; checkedAt: string }
  | { type: 'channel.delete'; id: string }
  | { type: 'conversation.upsert'; conversation: ChannelConversation }
  | { type: 'conversation.message'; conversationId: string; message: ChannelMessage };

function reducer(state: ChannelState, action: Action): ChannelState {
  switch (action.type) {
    case 'channel.save':
      return { ...state, channels: state.channels.some((item) => item.id === action.channel.id) ? state.channels.map((item) => item.id === action.channel.id ? action.channel : item) : [action.channel, ...state.channels] };
    case 'channel.toggle':
      return { ...state, channels: state.channels.map((item) => item.id === action.id ? { ...item, enabled: action.enabled, updatedAt: new Date().toISOString() } : item) };
    case 'channel.connected':
      return { ...state, channels: state.channels.map((item) => item.id === action.id ? { ...item, installStatus: 'success', installCheckedAt: action.checkedAt } : item) };
    case 'channel.delete':
      return { ...state, channels: state.channels.filter((item) => item.id !== action.id) };
    case 'conversation.upsert':
      return { ...state, conversations: state.conversations.some((item) => item.id === action.conversation.id) ? state.conversations.map((item) => item.id === action.conversation.id ? action.conversation : item) : [...state.conversations, action.conversation] };
    case 'conversation.message':
      return { ...state, conversations: state.conversations.map((item) => item.id === action.conversationId ? { ...item, updatedAt: action.message.sentAt, messages: [...item.messages, action.message] } : item) };
    default:
      return state;
  }
}

function initialState(): ChannelState {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value ? JSON.parse(value) as ChannelState : seedState;
  } catch {
    return seedState;
  }
}

const StoreContext = createContext<{ state: ChannelState; dispatch: React.Dispatch<Action> } | null>(null);

export function ChannelProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(state)), [state]);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useChannelStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useChannelStore must be used inside ChannelProvider');
  return value;
}

