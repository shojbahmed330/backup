import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { User, Message, ReplyInfo, AppView } from '../types';
import { firebaseService } from '../services/firebaseService';
import { geminiService } from '../services/geminiService';
import Icon from './Icon';
import Waveform from './Waveform';

interface ChatWidgetProps {
  currentUser: User;
  peerUser: User;
  onClose: (peerId: string) => void;
  onMinimize: (peerId: string) => void;
  onHeaderClick: (peerId: string) => void;
  isMinimized: boolean;
  unreadCount: number;
  setIsChatRecording: (isRecording: boolean) => void;
  onNavigate: (view: AppView, props?: any) => void;
  onSetTtsMessage: (message: string) => void;
  onBlockUser: (user: User) => void;
}

enum RecordingState { IDLE, RECORDING, PREVIEW }
const EMOJI_REACTIONS = ['❤️', '😂', '😮', '😢', '😡', '👍'];
const EMOJI_REGEX = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;

const isJumboEmoji = (text: string | undefined): boolean => {
    if (!text) return false;
    const trimmedText = text.trim();
    const noEmojiText = trimmedText.replace(EMOJI_REGEX, '');
    if (noEmojiText.trim().length > 0) return false;
    const emojiCount = (trimmedText.match(EMOJI_REGEX) || []).length;
    return emojiCount > 0 && emojiCount <= 2;
}

const MessageBubble: React.FC<{
    message: Message;
    isMe: boolean;
    peerUser: User;
    currentUser: User;
    onReply: (message: Message) => void;
    onReact: (messageId: string, emoji: string) => void;
    onUnsend: (messageId: string) => void;
    onViewProfile: (username: string) => void;
    onBlockUser: (user: User) => void;
    onAudioCall: () => void;
    onVideoCall: () => void;
}> = ({ message, isMe, peerUser, currentUser, onReply, onReact, onUnsend, onViewProfile, onBlockUser, onAudioCall, onVideoCall }) => {
    const [isActionMenuOpen, setActionMenuOpen] = useState(false);
    const actionMenuRef = useRef<HTMLDivElement>(null);
    const [isProfileMenuOpen, setProfileMenuOpen] = useState(false);
    const profileMenuRef = useRef<HTMLDivElement>(null);
    const sender = isMe ? currentUser : peerUser;
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) setActionMenuOpen(false);
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) setProfileMenuOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const renderContent = () => {
        if (message.isDeleted) return <p className="italic text-sm text-slate-400">Message unsent</p>;
        switch (message.type) {
            case 'image': return <img src={message.mediaUrl} alt="Sent" className="max-w-xs max-h-48 rounded-lg cursor-pointer" />;
            case 'video': return <video src={message.mediaUrl} controls className="max-w-xs max-h-48 rounded-lg" />;
            case 'audio': return <audio src={message.audioUrl} controls className="w-48 h-10" />;
            default: return <p className={`text-base break-words ${isJumboEmoji(message.text) ? 'jumbo-emoji animate-jumbo' : ''}`}>{message.text}</p>;
        }
    };
    
    const hasReactions = message.reactions && Object.values(message.reactions).flat().length > 0;
    const isJumbo = isJumboEmoji(message.text);

    return (
        <div className={`w-full flex items-end gap-2.5 animate-slide-in-bottom ${isMe ? 'justify-end' : 'justify-start'}`}>
            {!isMe && (
                <div className="relative flex-shrink-0" ref={profileMenuRef}>
                    <button onClick={() => setProfileMenuOpen(p => !p)} aria-label={`Actions for ${sender.name}`}>
                        <img src={sender.avatarUrl} alt={sender.name} className="w-8 h-8 rounded-full" />
                    </button>
                    {isProfileMenuOpen && (
                        <div className="absolute bottom-full mb-1 w-48 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl z-20 text-sm py-1">
                            <button onClick={() => { onViewProfile(sender.username); setProfileMenuOpen(false); }} className="w-full text-left px-3 py-1.5 hover:bg-slate-700 flex items-center gap-2"><Icon name="user" className="w-4 h-4" /> View Profile</button>
                            <button onClick={() => { onBlockUser(sender); setProfileMenuOpen(false); }} className="w-full text-left px-3 py-1.5 hover:bg-slate-700 flex items-center gap-2 text-red-400"><Icon name="user-slash" className="w-4 h-4" /> Block User</button>
                            <div className="border-t border-slate-700 my-1"></div>
                            <button onClick={() => { onAudioCall(); setProfileMenuOpen(false); }} className="w-full text-left px-3 py-1.5 hover:bg-slate-700 flex items-center gap-2"><Icon name="phone" className="w-4 h-4" /> Audio Call</button>
                            <button onClick={() => { onVideoCall(); setProfileMenuOpen(false); }} className="w-full text-left px-3 py-1.5 hover:bg-slate-700 flex items-center gap-2"><Icon name="video-camera" className="w-4 h-4" /> Video Call</button>
                        </div>
                    )}
                </div>
            )}
            <div className={`flex flex-col gap-1 max-w-[80%] group ${isMe ? 'items-end' : 'items-start'}`}>
                <div className="relative">
                    <div className={`px-3 py-2 rounded-2xl ${isMe ? 'bg-rose-600 text-white rounded-br-none' : 'bg-slate-600 text-slate-100 rounded-bl-none'} ${isJumbo ? '!bg-transparent !p-0' : ''}`}>
                        {renderContent()}
                    </div>
                    {hasReactions && !isJumbo && (
                        <div className="absolute -bottom-2.5 right-1 bg-slate-700 rounded-full px-1.5 text-xs flex items-center gap-1 border border-slate-900">
                            {Object.entries(message.reactions).slice(0, 3).map(([emoji]) => <span key={emoji}>{emoji}</span>)}
                        </div>
                    )}
                    {!message.isDeleted && (
                        <div ref={actionMenuRef} className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity ${isMe ? 'left-0 -translate-x-full' : 'right-0 translate-x-full'}`}>
                             <div className="flex bg-slate-800 rounded-full p-0.5 border border-slate-600">
                                <button onClick={() => setActionMenuOpen(p => !p)} className="p-1.5 rounded-full hover:bg-slate-700"><Icon name="face-smile" className="w-5 h-5 text-slate-300"/></button>
                                <button onClick={() => onReply(message)} className="p-1.5 rounded-full hover:bg-slate-700"><Icon name="reply" className="w-5 h-5 text-slate-300"/></button>
                            </div>
                            {isActionMenuOpen && (
                                <div className="absolute bottom-full mb-1 bg-slate-800 rounded-full p-1 flex items-center gap-1 shadow-lg border border-slate-600 z-10">
                                    {EMOJI_REACTIONS.map(emoji => (
                                        <button key={emoji} onClick={() => { onReact(message.id, emoji); setActionMenuOpen(false); }} className="text-2xl p-1 rounded-full hover:bg-slate-700 transition-transform hover:scale-125">{emoji}</button>
                                    ))}
                                    {isMe && <button onClick={() => { onUnsend(message.id); setActionMenuOpen(false); }} className="p-2 rounded-full hover:bg-slate-700"><Icon name="trash" className="w-4 h-4 text-red-400"/></button>}
                                </div>
                            )}
                        </div>
                    )}
                </div>
                 <div className={`text-xs text-slate-500 flex items-center gap-1.5 ${isMe ? 'pr-2' : 'pl-2'}`}>
                    <span>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {isMe && !message.isDeleted && (
                        message.read
                        ? <Icon name="check-double" className="w-4 h-4 text-sky-400" />
                        : <Icon name="check" className="w-4 h-4" />
                    )}
                </div>
            </div>
        </div>
    );
};


const ChatWidget: React.FC<ChatWidgetProps> = ({ currentUser, peerUser, onClose, onMinimize, onHeaderClick, isMinimized, unreadCount, setIsChatRecording, onNavigate, onSetTtsMessage, onBlockUser }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  
  const [recordingState, setRecordingState] = useState<RecordingState>(RecordingState.IDLE);
  const [audioPreview, setAudioPreview] = useState<{ url: string, blob: Blob, duration: number } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);

  const chatId = firebaseService.getChatId(currentUser.id, peerUser.id);

  useEffect(() => {
    setIsChatRecording(recordingState === RecordingState.RECORDING);
    return () => setIsChatRecording(false);
  }, [recordingState, setIsChatRecording]);

  useEffect(() => {
    const unsubscribe = firebaseService.listenToMessages(chatId, setMessages);
    return () => unsubscribe();
  }, [chatId]);

  useEffect(() => {
    if (!isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      firebaseService.markMessagesAsRead(chatId, currentUser.id);
    }
  }, [messages, isMinimized, chatId, currentUser.id]);
  
  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmedMessage = newMessage.trim();
    if (!trimmedMessage && !audioPreview) return;
    
    if (trimmedMessage === '❤️') {
        setShowHeartAnimation(true);
        setTimeout(() => setShowHeartAnimation(false), 3000);
    }
    
    const replyToInfo = replyingTo ? geminiService.createReplySnippet(replyingTo) : undefined;
    let messageContent: any = { type: 'text', text: trimmedMessage, replyTo: replyToInfo };

    if (audioPreview) {
        messageContent = { type: 'audio', audioBlob: audioPreview.blob, duration: audioPreview.duration, replyTo: replyToInfo };
    }

    await firebaseService.sendMessage(chatId, currentUser, peerUser, messageContent);
    setNewMessage('');
    setReplyingTo(null);
    setAudioPreview(null);
    setRecordingState(RecordingState.IDLE);
  };
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const replyToInfo = replyingTo ? geminiService.createReplySnippet(replyingTo) : undefined;
      const type = file.type.startsWith('video') ? 'video' : 'image';
      await firebaseService.sendMessage(chatId, currentUser, peerUser, { type, mediaFile: file, replyTo: replyToInfo });
      setReplyingTo(null);
      e.target.value = '';
  };

  const handleStartRecording = async () => {
    if (recordingState !== RecordingState.IDLE) return;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];
        mediaRecorderRef.current.ondataavailable = (event) => audioChunksRef.current.push(event.data);
        mediaRecorderRef.current.onstop = () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            const url = URL.createObjectURL(audioBlob);
            const duration = Math.round((Date.now() - (timerRef.current || Date.now())) / 1000);
            setAudioPreview({ url, blob: audioBlob, duration });
            setRecordingState(RecordingState.PREVIEW);
            stream.getTracks().forEach(track => track.stop());
        };
        mediaRecorderRef.current.start();
        setRecordingState(RecordingState.RECORDING);
        timerRef.current = Date.now();
    } catch (err) { console.error("Mic permission error:", err); }
  };

  const handleStopRecording = () => mediaRecorderRef.current?.stop();
  const handleCancelRecording = () => {
      if (audioPreview) URL.revokeObjectURL(audioPreview.url);
      setAudioPreview(null);
      setRecordingState(RecordingState.IDLE);
  };
  const handleReact = (messageId: string, emoji: string) => firebaseService.reactToMessage(chatId, messageId, currentUser.id, emoji);
  const handleUnsend = (messageId: string) => {
    if (window.confirm("Are you sure you want to unsend this message?")) firebaseService.unsendMessage(chatId, messageId, currentUser.id);
  };
  const handleInitiateCall = async (type: 'audio' | 'video') => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' });
        stream.getTracks().forEach(track => track.stop());
        const callId = await firebaseService.createCall(currentUser, peerUser, chatId, type);
        onNavigate(AppView.CALL_SCREEN, { callId, peerUser, isCaller: true });
    } catch (error: any) {
        console.error(`Failed to get media permissions for ${type} call:`, error);
        onSetTtsMessage("Call failed: Microphone/camera permission was denied.");
    }
  };

  if (isMinimized) {
    return (
      <button onClick={() => onHeaderClick(peerUser.id)} className="w-60 h-12 bg-slate-800 border-t-2 border-fuchsia-500/50 rounded-t-lg flex items-center px-3 gap-2 shadow-lg hover:bg-slate-700">
        <div className="relative">
          <img src={peerUser.avatarUrl} alt={peerUser.name} className="w-8 h-8 rounded-full" />
          <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border border-slate-800 ${peerUser.onlineStatus === 'online' ? 'bg-green-500' : 'bg-slate-500'}`}/>
        </div>
        <span className="text-white font-semibold truncate flex-grow text-left">{peerUser.name}</span>
        {unreadCount > 0 && <span className="bg-rose-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">{unreadCount}</span>}
        <button onClick={(e) => { e.stopPropagation(); onClose(peerUser.id); }} className="p-1 rounded-full hover:bg-slate-600 text-slate-400"><Icon name="close" className="w-4 h-4" /></button>
      </button>
    );
  }

  return (
    <div className="fixed md:relative bottom-0 left-0 right-0 h-full md:w-80 md:h-[500px] bg-[#18191a] md:rounded-t-lg flex flex-col shadow-2xl border border-b-0 border-slate-700 font-sans">
      <header className="flex-shrink-0 flex items-center justify-between p-2 bg-[#242526] md:rounded-t-lg border-b border-slate-700">
        <button onClick={() => onHeaderClick(peerUser.id)} className="flex items-center gap-2 p-1 rounded-lg hover:bg-slate-700/50">
          <div className="relative">
            <img src={peerUser.avatarUrl} alt={peerUser.name} className="w-9 h-9 rounded-full" />
            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border border-slate-700 ${peerUser.onlineStatus === 'online' ? 'bg-green-500' : 'bg-slate-500'}`}/>
          </div>
          <span className="text-white font-semibold">{peerUser.name}</span>
        </button>
        <div className="flex items-center text-fuchsia-400">
          <button onClick={() => handleInitiateCall('audio')} className="p-2 rounded-full hover:bg-slate-700/50"><Icon name="phone" className="w-5 h-5"/></button>
          <button onClick={() => handleInitiateCall('video')} className="p-2 rounded-full hover:bg-slate-700/50"><Icon name="video-camera" className="w-5 h-5"/></button>
          <button onClick={(e) => { e.stopPropagation(); onMinimize(peerUser.id); }} className="p-2 rounded-full hover:bg-slate-700/50 hidden md:inline-block">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
          </button>
          <button onClick={(e) => { e.stopPropagation(); onClose(peerUser.id); }} className="p-2 rounded-full hover:bg-slate-700/50">
            <Icon name="close" className="w-5 h-5" />
          </button>
        </div>
      </header>
      <main className="relative flex-grow overflow-y-auto p-3 space-y-4 flex flex-col">
        {showHeartAnimation && <div className="heart-animation-container">{Array.from({ length: 10 }).map((_, i) => (<div key={i} className="heart" style={{ left: `${Math.random() * 80 + 10}%`, animationDelay: `${Math.random() * 1.5}s`, fontSize: `${Math.random() * 1.5 + 1}rem`}}>❤️</div>))}</div>}
        {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} isMe={msg.senderId === currentUser.id} peerUser={peerUser} currentUser={currentUser} onReply={setReplyingTo} onReact={handleReact} onUnsend={handleUnsend} onViewProfile={(u) => onNavigate(AppView.PROFILE, { username: u })} onBlockUser={(u) => { onBlockUser(u); onClose(u.id); }} onAudioCall={() => handleInitiateCall('audio')} onVideoCall={() => handleInitiateCall('video')} />
        ))}
        <div ref={messagesEndRef} />
      </main>
      <footer className="p-2 border-t border-slate-700">
        {replyingTo && <div className="text-xs text-slate-400 px-2 pb-1 flex justify-between items-center bg-slate-700/50 rounded-t-md -mx-2 -mt-2 mb-2 p-2"><span>Replying to {replyingTo.senderId === currentUser.id ? 'yourself' : peerUser.name}</span><button onClick={() => setReplyingTo(null)} className="font-bold"><Icon name="close" className="w-4 h-4" /></button></div>}
        <div className="flex items-center gap-2">
          <input type="file" ref={mediaInputRef} onChange={handleFileChange} accept="image/*,video/*" className="hidden"/>
          <button onClick={() => mediaInputRef.current?.click()} className="p-2 rounded-full text-fuchsia-400 hover:bg-slate-700/50"><Icon name="add-circle" className="w-6 h-6"/></button>
          {newMessage.trim() === '' && !audioPreview && recordingState === RecordingState.IDLE ? (<button onClick={handleStartRecording} className="p-2 rounded-full text-fuchsia-400 hover:bg-slate-700/50"><Icon name="mic" className="w-6 h-6"/></button>) : null}
          <div className="flex-grow">
            {recordingState === RecordingState.RECORDING ? (<div className="bg-slate-700 rounded-full h-10 flex items-center px-4 justify-between"><div className="w-1/2 h-full"><Waveform isPlaying={true} isRecording /></div><button onClick={handleStopRecording} className="bg-rose-500 rounded-full p-2"><Icon name="pause" className="w-4 h-4 text-white"/></button></div>
            ) : audioPreview ? (<div className="bg-slate-700 rounded-full h-10 flex items-center px-4 justify-between"><p className="text-sm text-slate-300">Voice message ({audioPreview.duration}s)</p><button onClick={handleCancelRecording} className="p-1"><Icon name="close" className="w-4 h-4 text-slate-400"/></button></div>
            ) : (<div className="relative"><textarea value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) handleSendMessage(e); }} placeholder="Aa" rows={1} className="w-full bg-slate-700 text-slate-100 rounded-full py-2 px-4 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 text-sm resize-none pr-10"/></div>)}
          </div>
          <button type="button" onClick={() => handleSendMessage()} className="p-2 rounded-full text-fuchsia-400 hover:bg-slate-700/50" disabled={!newMessage.trim() && !audioPreview}><Icon name="paper-airplane" className="w-6 h-6" /></button>
        </div>
      </footer>
    </div>
  );
};
export default ChatWidget;