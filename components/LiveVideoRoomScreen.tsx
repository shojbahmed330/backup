import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { LiveVideoRoom, User, VideoParticipantState, LiveVideoRoomMessage } from '../types';
import { geminiService } from '../services/geminiService';
import Icon from './Icon';
import { AGORA_APP_ID } from '../constants';
import AgoraRTC from 'agora-rtc-sdk-ng';
import type { IAgoraRTCClient, IAgoraRTCRemoteUser, IMicrophoneAudioTrack, ICameraVideoTrack } from 'agora-rtc-sdk-ng';

const EMOJI_LIST = ['❤️', '😂', '👍', '🎉', '🔥', '🙏', '😮', '😢', '🤔', '🥳'];

function stringToIntegerHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

const ParticipantVideo: React.FC<{
    participant: VideoParticipantState;
    isLocal: boolean;
    isSpeaking: boolean;
    localVideoTrack: ICameraVideoTrack | null;
    remoteUser: IAgoraRTCRemoteUser | undefined;
}> = ({ participant, isLocal, isSpeaking, localVideoTrack, remoteUser }) => {
    const videoRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const videoContainer = videoRef.current;
        if (!videoContainer) return;

        let trackToPlay: ICameraVideoTrack | undefined | null = isLocal ? localVideoTrack : remoteUser?.videoTrack;
        
        if (trackToPlay && !participant.isCameraOff) {
            trackToPlay.play(videoContainer, { fit: 'cover' });
        } else {
            // If there's a track playing, stop it.
            const playingTrack = isLocal ? localVideoTrack : remoteUser?.videoTrack;
            if (playingTrack && playingTrack.isPlaying) {
                playingTrack.stop();
            }
        }
    }, [isLocal, localVideoTrack, remoteUser, participant.isCameraOff]);
    
    const showVideo = (isLocal && localVideoTrack && !participant.isCameraOff) || (!isLocal && remoteUser?.hasVideo && !participant.isCameraOff);

    return (
        <div className="w-full h-full bg-slate-800 relative group">
            {showVideo ? (
                <div ref={videoRef} className={`w-full h-full ${isLocal ? 'transform scale-x-[-1]' : ''}`} />
            ) : (
                <div className="w-full h-full flex items-center justify-center">
                    <img src={participant.avatarUrl} alt={participant.name} className="w-24 h-24 object-cover rounded-full opacity-50" />
                </div>
            )}
             <div className={`absolute inset-0 border-4 rounded-lg pointer-events-none transition-colors ${isSpeaking ? 'border-green-400' : 'border-transparent'}`} />
             <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                 <p className="font-semibold text-white truncate text-shadow-lg">{participant.name}</p>
             </div>
        </div>
    );
};

const ChatMessage: React.FC<{ message: LiveVideoRoomMessage; isMe: boolean }> = ({ message, isMe }) => {
    return (
      <div className={`flex items-start gap-2 ${isMe ? 'justify-end' : ''}`}>
        {!isMe && <img src={message.sender.avatarUrl} alt={message.sender.name} className="w-6 h-6 rounded-full mt-1" />}
        <div>
          {!isMe && <p className="text-xs text-slate-400 ml-2">{message.sender.name}</p>}
          <div className={`px-3 py-1.5 rounded-2xl text-sm ${isMe ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-200'}`}>
            {message.text}
          </div>
        </div>
      </div>
    );
};

interface LiveVideoRoomScreenProps {
    currentUser: User;
    roomId: string;
    onGoBack: () => void;
    onSetTtsMessage: (message: string) => void;
}

const getGridLayout = (participantCount: number) => {
    if (participantCount <= 1) return 'grid-cols-1 grid-rows-1';
    if (participantCount === 2) return 'grid-cols-1 grid-rows-2 md:grid-cols-2 md:grid-rows-1';
    if (participantCount <= 4) return 'grid-cols-2 grid-rows-2';
    if (participantCount <= 6) return 'grid-cols-3 grid-rows-2';
    if (participantCount <= 9) return 'grid-cols-3 grid-rows-3';
    return 'grid-cols-4 grid-rows-4';
};


const LiveVideoRoomScreen: React.FC<LiveVideoRoomScreenProps> = ({ currentUser, roomId, onGoBack, onSetTtsMessage }) => {
    const [room, setRoom] = useState<LiveVideoRoom | null>(null);
    const [messages, setMessages] = useState<LiveVideoRoomMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isEmojiPickerOpen, setEmojiPickerOpen] = useState(false);
    
    const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([]);
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [isMicAvailable, setIsMicAvailable] = useState(true);
    const [isCamAvailable, setIsCamAvailable] = useState(true);
    const [activeSpeakerUid, setActiveSpeakerUid] = useState<number | null>(null);

    const agoraClient = useRef<IAgoraRTCClient | null>(null);
    const localAudioTrack = useRef<IMicrophoneAudioTrack | null>(null);
    const localVideoTrack = useRef<ICameraVideoTrack | null>(null);
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const roomRef = useRef(room);
    roomRef.current = room;

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        let isMounted = true;

        const setupAgora = async () => {
            if (!AGORA_APP_ID) throw new Error("Agora App ID is not configured.");

            const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
            agoraClient.current = client;

            client.on('user-published', async (user, mediaType) => {
                await client.subscribe(user, mediaType);
                if (isMounted) setRemoteUsers(Array.from(client.remoteUsers));
                if (mediaType === 'audio') user.audioTrack?.play();
            });

            client.on('user-left', () => { if (isMounted) setRemoteUsers(Array.from(client.remoteUsers)); });
            client.on('user-unpublished', () => { if (isMounted) setRemoteUsers(Array.from(client.remoteUsers)); });

            client.enableAudioVolumeIndicator();
            client.on('volume-indicator', (volumes) => {
                const mainSpeaker = volumes.reduce((max, current) => current.level > max.level ? current : max, { level: 0 });
                if (isMounted) setActiveSpeakerUid(mainSpeaker.level > 5 ? mainSpeaker.uid : null);
            });
            
            const uid = stringToIntegerHash(currentUser.id);
            const token = await geminiService.getAgoraToken(roomId, uid);
            if (!token) throw new Error("Failed to retrieve Agora token.");

            await client.join(AGORA_APP_ID, roomId, token, uid);

            const tracksToPublish: (IMicrophoneAudioTrack | ICameraVideoTrack)[] = [];
            try {
                const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
                localAudioTrack.current = audioTrack;
                tracksToPublish.push(audioTrack);
                if (isMounted) setIsMicAvailable(true);
            } catch (e) { 
                console.warn("Could not get mic", e); 
                if (isMounted) {
                    setIsMicAvailable(false);
                    setIsMuted(true);
                    geminiService.updateParticipantStateInVideoRoom(roomId, currentUser.id, { isMuted: true });
                }
            }

            try {
                const videoTrack = await AgoraRTC.createCameraVideoTrack();
                localVideoTrack.current = videoTrack;
                tracksToPublish.push(videoTrack);
                if (isMounted) setIsCamAvailable(true);
            } catch (e) { 
                console.warn("Could not get cam", e); 
                if (isMounted) {
                    setIsCamAvailable(false);
                    setIsCameraOff(true);
                    geminiService.updateParticipantStateInVideoRoom(roomId, currentUser.id, { isCameraOff: true });
                }
            }

            if (tracksToPublish.length > 0) {
                await client.publish(tracksToPublish);
            }
        };

        const initialize = async () => {
            await geminiService.joinLiveVideoRoom(currentUser.id, roomId);
            await setupAgora();
        };
        
        initialize().catch(err => {
            console.error("Agora setup failed:", err);
            onSetTtsMessage("Could not start call. Check device permissions.");
            onGoBack();
        });

        const roomUnsubscribe = geminiService.listenToVideoRoom(roomId, (liveRoom) => {
            if (isMounted) {
                if (!liveRoom || liveRoom.status === 'ended') {
                    onGoBack();
                } else {
                    setRoom(liveRoom);
                }
            }
        });
        
        const messagesUnsubscribe = geminiService.listenToLiveVideoRoomMessages(roomId, (msgs) => {
            if (isMounted) setMessages(msgs);
        });

        return () => {
            isMounted = false;
            localAudioTrack.current?.stop();
            localAudioTrack.current?.close();
            localVideoTrack.current?.stop();
            localVideoTrack.current?.close();
            agoraClient.current?.leave();
            geminiService.leaveLiveVideoRoom(currentUser.id, roomId);
            roomUnsubscribe();
            messagesUnsubscribe();
        };
    }, [roomId, currentUser.id, onGoBack, onSetTtsMessage]);

    const handleLeaveOrEnd = () => {
        if (roomRef.current?.host.id === currentUser.id) {
            if (window.confirm("Are you sure you want to end this room for everyone?")) {
                geminiService.endLiveVideoRoom(currentUser.id, roomId);
            }
        } else {
            onGoBack();
        }
    };
    
    const toggleMute = () => {
        const muted = !isMuted;
        localAudioTrack.current?.setMuted(muted);
        setIsMuted(muted);
        geminiService.updateParticipantStateInVideoRoom(roomId, currentUser.id, { isMuted: muted });
    };

    const toggleCamera = () => {
        const cameraOff = !isCameraOff;
        localVideoTrack.current?.setEnabled(!cameraOff);
        setIsCameraOff(cameraOff);
        geminiService.updateParticipantStateInVideoRoom(roomId, currentUser.id, { isCameraOff: cameraOff });
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = newMessage.trim();
        if (trimmed) {
            await geminiService.sendLiveVideoRoomMessage(roomId, currentUser, trimmed);
            setNewMessage('');
            setEmojiPickerOpen(false);
        }
    };

    const allParticipants = room?.participants || [];
    const gridLayout = getGridLayout(allParticipants.length);
    const remoteUsersMap = useMemo(() => new Map(remoteUsers.map(u => [u.uid, u])), [remoteUsers]);

    if (!room) return <div className="h-full w-full flex items-center justify-center bg-black text-white">Connecting...</div>;

    return (
        <div className="h-full w-full flex flex-col md:flex-row bg-black text-white overflow-hidden">
            <main className={`flex-grow grid ${gridLayout} gap-1 relative`}>
                {allParticipants.map(p => {
                    const isLocal = p.id === currentUser.id;
                    const agoraUid = stringToIntegerHash(p.id);
                    const agoraUser = isLocal ? undefined : remoteUsersMap.get(agoraUid);
                    const participantState = isLocal ? { ...p, isMuted, isCameraOff } : p;
                    const agoraUidForSpeakingCheck = isLocal ? agoraClient.current?.uid : agoraUser?.uid;

                    return (
                        <div key={p.id} className="relative rounded-lg overflow-hidden">
                            <ParticipantVideo
                                participant={participantState}
                                isLocal={isLocal}
                                isSpeaking={activeSpeakerUid === agoraUidForSpeakingCheck}
                                localVideoTrack={localVideoTrack.current}
                                remoteUser={agoraUser}
                            />
                        </div>
                    );
                })}
            </main>
            <aside className="w-full md:w-80 flex-shrink-0 bg-black/30 backdrop-blur-sm border-l border-white/10 flex flex-col z-10 h-1/2 md:h-full">
                 <h2 className="font-bold text-lg p-3 flex-shrink-0">{room.topic}</h2>
                 <div className="flex-grow overflow-y-auto space-y-3 no-scrollbar p-2">
                     {messages.map(msg => <ChatMessage key={msg.id} message={msg} isMe={msg.sender.id === currentUser.id} />)}
                     <div ref={messagesEndRef} />
                 </div>
                 <footer className="p-2 flex-shrink-0 border-t border-slate-700 bg-black/30 z-10">
                    {isEmojiPickerOpen && (
                        <div className="p-2 bg-slate-900/95 backdrop-blur-sm rounded-lg border border-slate-700 h-40 overflow-y-auto no-scrollbar mb-2">
                            <div className="grid grid-cols-8 gap-2">
                                {EMOJI_LIST.map(emoji => (
                                    <button key={emoji} type="button" onClick={() => setNewMessage(p => p + emoji)} className="text-2xl p-1 rounded-md hover:bg-slate-700/50">{emoji}</button>
                                ))}
                            </div>
                        </div>
                    )}
                    <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                        <div className="relative flex-grow">
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onFocus={() => setEmojiPickerOpen(false)}
                                placeholder="Send a message..."
                                className="w-full bg-slate-700/80 border border-slate-600 rounded-full py-2.5 px-4 pr-12 text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-rose-500"
                            />
                            <button type="button" onClick={() => setEmojiPickerOpen(p => !p)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-300 hover:text-white">
                                <Icon name="face-smile" className="w-5 h-5"/>
                            </button>
                        </div>
                        <button type="submit" className="p-3 bg-rose-600 rounded-full text-white hover:bg-rose-500 disabled:bg-slate-500" disabled={!newMessage.trim()}>
                            <Icon name="paper-airplane" className="w-5 h-5" />
                        </button>
                    </form>
                </footer>
            </aside>
            <div className="absolute bottom-0 left-0 md:left-1/2 md:-translate-x-1/2 p-4 z-20 bg-gradient-to-t from-black/80 to-transparent">
                <div className="flex items-center justify-center gap-4">
                    <button onClick={toggleMute} disabled={!isMicAvailable} className={`p-4 rounded-full transition-colors ${!isMicAvailable ? 'bg-red-600/50' : isMuted ? 'bg-rose-600' : 'bg-slate-700/80'}`}>
                        <Icon name={!isMicAvailable || isMuted ? 'microphone-slash' : 'mic'} className="w-6 h-6" />
                    </button>
                     <button onClick={toggleCamera} disabled={!isCamAvailable} className={`p-4 rounded-full transition-colors ${!isCamAvailable ? 'bg-red-600/50' : isCameraOff ? 'bg-rose-600' : 'bg-slate-700/80'}`}>
                        <Icon name={!isCamAvailable || isCameraOff ? 'video-camera-slash' : 'video-camera'} className="w-6 h-6" />
                    </button>
                    <button onClick={handleLeaveOrEnd} className="p-4 rounded-full bg-red-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" transform="rotate(-135 12 12)"/></svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LiveVideoRoomScreen;