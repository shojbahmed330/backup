import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { LiveVideoRoom, User, VideoParticipantState, LiveVideoRoomMessage } from '../types';
import { geminiService } from '../services/geminiService';
import Icon from './Icon';
import { AGORA_APP_ID } from '../constants';
import AgoraRTC from 'agora-rtc-sdk-ng';
import type { IAgoraRTCClient, IAgoraRTCRemoteUser, IMicrophoneAudioTrack, ICameraVideoTrack } from 'agora-rtc-sdk-ng';

// --- Helper Functions & Types ---

type CombinedParticipant = VideoParticipantState & {
    agoraUser?: IAgoraRTCRemoteUser;
    isSpeaking?: boolean;
};

function stringToIntegerHash(str: string): number {
  if (!str) return 0;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

const useIsMobile = () => {
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    return isMobile;
};


// --- Sub-components ---

const ParticipantVideo: React.FC<{
    participant: CombinedParticipant;
    isLocal: boolean;
    localVideoTrack: ICameraVideoTrack | null;
    onClick?: () => void;
    isMainView?: boolean;
}> = ({ participant, isLocal, localVideoTrack, onClick, isMainView }) => {
    const videoRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const videoContainer = videoRef.current;
        if (!videoContainer) return;

        const trackToPlay = isLocal ? localVideoTrack : participant.agoraUser?.videoTrack;

        if (trackToPlay && !participant.isCameraOff) {
            trackToPlay.play(videoContainer, { fit: 'cover' });
        } else {
            trackToPlay?.stop();
        }

        return () => {
            if (trackToPlay?.isPlaying) {
                trackToPlay.stop();
            }
        };
    }, [participant.agoraUser, localVideoTrack, participant.isCameraOff, isLocal]);
    
    const showVideo = !participant.isCameraOff && (isLocal ? localVideoTrack : participant.agoraUser?.hasVideo);

    return (
        <div 
            className={`w-full h-full bg-slate-900 relative group overflow-hidden rounded-lg transition-all duration-300 ${onClick ? 'cursor-pointer' : ''}`}
            onClick={onClick}
        >
            {showVideo ? (
                <div ref={videoRef} className={`w-full h-full transition-transform duration-300 group-hover:scale-105 ${isLocal ? 'transform scale-x-[-1]' : ''}`} />
            ) : (
                <div className="w-full h-full flex items-center justify-center bg-black">
                    <img src={participant.avatarUrl} alt={participant.name} className="w-24 h-24 object-cover rounded-full opacity-50" />
                </div>
            )}
             <div className={`absolute inset-0 border-4 pointer-events-none rounded-lg transition-all duration-300 ${participant.isSpeaking ? 'border-green-400 ring-4 ring-green-400/30' : 'border-transparent'}`} />
             <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent flex items-center gap-2">
                 {participant.isMuted && <Icon name="microphone-slash" className="w-4 h-4 text-white flex-shrink-0" />}
                 <p className={`font-semibold text-white truncate text-shadow-lg ${isMainView ? 'text-lg' : 'text-sm'}`}>{participant.name}</p>
             </div>
        </div>
    );
};

const ChatMessage: React.FC<{ message: LiveVideoRoomMessage; isMe: boolean }> = ({ message, isMe }) => {
    return (
      <div className={`flex items-start gap-2 animate-slide-in-bottom ${isMe ? 'justify-end' : ''}`}>
        {!isMe && <img src={message.sender.avatarUrl} alt={message.sender.name} className="w-6 h-6 rounded-full mt-1" />}
        <div>
          {!isMe && <p className="text-xs text-slate-400 ml-2">{message.sender.name}</p>}
          <div className={`px-3 py-1.5 rounded-2xl text-sm max-w-xs break-words ${isMe ? 'bg-fuchsia-600 text-white rounded-br-none' : 'bg-slate-700 text-slate-200 rounded-bl-none'}`}>
            {message.text}
          </div>
        </div>
      </div>
    );
};


// --- Main Component ---

interface LiveVideoRoomScreenProps {
    currentUser: User;
    roomId: string;
    onGoBack: () => void;
    onSetTtsMessage: (message: string) => void;
}

const LiveVideoRoomScreen: React.FC<LiveVideoRoomScreenProps> = ({ currentUser, roomId, onGoBack, onSetTtsMessage }) => {
    const [room, setRoom] = useState<LiveVideoRoom | null>(null);
    const [participants, setParticipants] = useState<CombinedParticipant[]>([]);
    const [messages, setMessages] = useState<LiveVideoRoomMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isChatOpen, setIsChatOpen] = useState(false);
    
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [isMicAvailable, setIsMicAvailable] = useState(true);
    const [isCamAvailable, setIsCamAvailable] = useState(true);

    const agoraClient = useRef<IAgoraRTCClient | null>(null);
    const localAudioTrack = useRef<IMicrophoneAudioTrack | null>(null);
    const localVideoTrack = useRef<ICameraVideoTrack | null>(null);
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const isMobile = useIsMobile();
    const [mainParticipantId, setMainParticipantId] = useState<string | null>(null);
    const [controlsVisible, setControlsVisible] = useState(true);
    const controlsTimeoutRef = useRef<number | null>(null);

    // Sync Firestore & Agora data into a unified `participants` state
    useEffect(() => {
        if (!room) return;
        setParticipants(prevParticipants => {
            const newParticipantsFromRoom = room.participants;
            const prevMap = new Map(prevParticipants.map(p => [p.id, p]));
            return newParticipantsFromRoom.map(newP => {
                const oldP = prevMap.get(newP.id);
                // FIX: Added an explicit check for `oldP` to help TypeScript infer its type correctly,
                // resolving the "property does not exist on type 'unknown'" error.
                if (oldP) {
                    // Preserve agoraUser and isSpeaking from previous state
                    return { ...newP, agoraUser: oldP.agoraUser, isSpeaking: oldP.isSpeaking };
                }
                // For new participants, initialize with default values
                return { ...newP, agoraUser: undefined, isSpeaking: false };
            });
        });
    }, [room]);
    
    // Manage Agora connection and event listeners
    useEffect(() => {
        let isMounted = true;
        const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
        agoraClient.current = client;

        const handleUserPublished = async (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
            await client.subscribe(user, mediaType);
            if (!isMounted) return;
            setParticipants(prev => prev.map(p => stringToIntegerHash(p.id) === user.uid ? { ...p, agoraUser: user } : p));
            if (mediaType === 'audio') user.audioTrack?.play();
        };

        const handleUserLeft = (user: IAgoraRTCRemoteUser) => {
            if (!isMounted) return;
            setParticipants(prev => prev.map(p => stringToIntegerHash(p.id) === user.uid ? { ...p, agoraUser: undefined } : p));
        };

        const handleVolumeIndicator = (volumes: { uid: number; level: number }[]) => {
            if (!isMounted) return;
            const speakingUids = new Set(volumes.filter(v => v.level > 10).map(v => v.uid));
            setParticipants(prev => prev.map(p => ({ ...p, isSpeaking: speakingUids.has(stringToIntegerHash(p.id)) || (p.id === currentUser.id && speakingUids.has(client.uid)) })));
        };

        const setupAgora = async () => {
            client.on('user-published', handleUserPublished);
            client.on('user-left', handleUserLeft);
            client.enableAudioVolumeIndicator();
            client.on('volume-indicator', handleVolumeIndicator);

            const uid = stringToIntegerHash(currentUser.id);
            const token = await geminiService.getAgoraToken(roomId, uid);
            if (!token) throw new Error("Failed to get Agora token.");

            await client.join(AGORA_APP_ID, roomId, token, uid);

            let initialMuted = false;
            let initialCamOff = false;

            try {
                const audio = await AgoraRTC.createMicrophoneAudioTrack();
                localAudioTrack.current = audio;
                setIsMicAvailable(true);
            } catch (e) {
                console.warn("Mic not available", e);
                setIsMicAvailable(false);
                initialMuted = true;
            }

            try {
                const video = await AgoraRTC.createCameraVideoTrack();
                localVideoTrack.current = video;
                setIsCamAvailable(true);
            } catch (e) {
                console.warn("Cam not available", e);
                setIsCamAvailable(false);
                initialCamOff = true;
            }

            const tracksToPublish = [localAudioTrack.current, localVideoTrack.current].filter(Boolean) as (IMicrophoneAudioTrack | ICameraVideoTrack)[];
            if (tracksToPublish.length > 0) await client.publish(tracksToPublish);

            setIsMuted(initialMuted);
            setIsCameraOff(initialCamOff);

            await geminiService.updateParticipantStateInVideoRoom(roomId, currentUser.id, { isMuted: initialMuted, isCameraOff: initialCamOff });
        };

        geminiService.joinLiveVideoRoom(currentUser.id, roomId)
            .then(setupAgora)
            .catch(err => {
                console.error("Failed to join or setup Agora:", err);
                onSetTtsMessage("Could not join the room.");
                onGoBack();
            });

        return () => {
            isMounted = false;
            agoraClient.current?.leave();
            localAudioTrack.current?.close();
            localVideoTrack.current?.close();
            geminiService.leaveLiveVideoRoom(currentUser.id, roomId);
        };
    }, [roomId, currentUser.id, onGoBack, onSetTtsMessage]);

    // Firestore listeners
    useEffect(() => {
        const unsubRoom = geminiService.listenToVideoRoom(roomId, setRoom);
        const unsubMessages = geminiService.listenToLiveVideoRoomMessages(roomId, setMessages);
        return () => {
            unsubRoom();
            unsubMessages();
        };
    }, [roomId]);
    
    // Other useEffects for UI logic
    useEffect(() => { setIsChatOpen(!isMobile); }, [isMobile]);
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
    useEffect(() => {
        if (isMobile) {
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
            controlsTimeoutRef.current = window.setTimeout(() => setControlsVisible(false), 3000);
        }
        return () => { if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current); };
    }, [controlsVisible, isMobile]);

    // --- User Actions ---
    const handleLeaveOrEnd = () => {
        if (room?.host.id === currentUser.id) {
            if (window.confirm("End this call for everyone?")) geminiService.endLiveVideoRoom(currentUser.id, roomId);
        } else {
            onGoBack();
        }
    };

    const toggleMute = async () => {
        if (!isMicAvailable) return;
        const muted = !isMuted;
        await localAudioTrack.current?.setMuted(muted);
        setIsMuted(muted);
        await geminiService.updateParticipantStateInVideoRoom(roomId, currentUser.id, { isMuted: muted });
    };

    const toggleCamera = async () => {
        if (!isCamAvailable) return;
        const cameraOff = !isCameraOff;
        await localVideoTrack.current?.setEnabled(!cameraOff);
        setIsCameraOff(cameraOff);
        await geminiService.updateParticipantStateInVideoRoom(roomId, currentUser.id, { isCameraOff: cameraOff });
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = newMessage.trim();
        if (trimmed) {
            await geminiService.sendLiveVideoRoomMessage(roomId, currentUser, trimmed);
            setNewMessage('');
        }
    };

    // --- Rendering Logic ---
    const mainParticipant = mainParticipantId ? participants.find(p => p.id === mainParticipantId) : null;
    const thumbnailParticipants = mainParticipantId ? participants.filter(p => p.id !== mainParticipantId) : [];

    const getGridLayout = useCallback((count: number) => {
        if (count <= 1) return 'grid-cols-1 grid-rows-1';
        if (count === 2) return isMobile ? 'grid-cols-1 grid-rows-2' : 'grid-cols-2 grid-rows-1';
        if (count <= 4) return 'grid-cols-2 grid-rows-2';
        if (count <= 6) return isMobile ? 'grid-cols-2 grid-rows-3' : 'grid-cols-3 grid-rows-2';
        if (count <= 9) return 'grid-cols-3 grid-rows-3';
        return 'grid-cols-4 grid-rows-3';
    }, [isMobile]);

    const renderParticipant = (p: CombinedParticipant, isMainView = false) => {
        const isLocal = p.id === currentUser.id;
        return (
            <div
                key={p.id}
                className="relative rounded-lg overflow-hidden transition-all duration-300"
                onClick={isMainView ? undefined : () => setMainParticipantId(mainParticipantId === p.id ? null : p.id)}
            >
                <ParticipantVideo
                    participant={p}
                    isLocal={isLocal}
                    localVideoTrack={localVideoTrack.current}
                    isMainView={isMainView}
                    onClick={isMainView ? undefined : () => setMainParticipantId(mainParticipantId === p.id ? null : p.id)}
                />
            </div>
        );
    };

    if (!room) return <div className="h-full w-full flex items-center justify-center bg-black text-white">Connecting...</div>;

    return (
        <div className="h-full w-full flex flex-col md:flex-row bg-black text-white overflow-hidden">
            <main className="flex-grow relative bg-black flex flex-col" onClick={() => setControlsVisible(v => !v)}>
                {mainParticipant ? (
                    <div className="flex-grow relative" onClick={() => setMainParticipantId(null)}>
                        {renderParticipant(mainParticipant, true)}
                    </div>
                ) : (
                    <div className={`flex-grow grid gap-1 p-1 ${getGridLayout(participants.length)}`}>
                        {participants.map(p => renderParticipant(p))}
                    </div>
                )}
                
                {mainParticipantId && thumbnailParticipants.length > 0 && (
                    <div className="flex-shrink-0 p-2 h-28 md:h-32">
                        <div className="flex gap-2 h-full overflow-x-auto no-scrollbar">
                           {thumbnailParticipants.map(p => (
                               <div key={p.id} className="h-full aspect-[4/3] rounded-lg">
                                   {renderParticipant(p)}
                               </div>
                           ))}
                        </div>
                    </div>
                )}
            </main>
            
            <aside className={`w-full md:w-80 flex-shrink-0 bg-black/50 backdrop-blur-sm border-l border-white/10 flex flex-col z-20 transition-transform duration-300 ${isMobile ? `fixed inset-0 transform ${isChatOpen ? 'animate-slide-in-right' : isChatOpen === false ? 'animate-slide-out-right' : 'translate-x-full'}` : ''}`}>
                 <header className="p-3 flex-shrink-0 flex items-center justify-between border-b border-slate-700">
                    <h2 className="font-bold text-lg">{room.topic}</h2>
                    {isMobile && <button onClick={() => setIsChatOpen(false)} className="p-2 rounded-full hover:bg-slate-700"><Icon name="close" className="w-5 h-5"/></button>}
                 </header>
                 <div className="flex-grow overflow-y-auto space-y-3 no-scrollbar p-2">
                     {messages.map(msg => <ChatMessage key={msg.id} message={msg} isMe={msg.sender.id === currentUser.id} />)}
                     <div ref={messagesEndRef} />
                 </div>
                 <footer className="p-2 flex-shrink-0 border-t border-slate-700 bg-black/30">
                    <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                        <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Send a message..." className="w-full bg-slate-700/80 border border-slate-600 rounded-full py-2 px-4 text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-rose-500"/>
                        <button type="submit" className="p-2.5 bg-rose-600 rounded-full text-white hover:bg-rose-500 disabled:bg-slate-500" disabled={!newMessage.trim()}><Icon name="paper-airplane" className="w-5 h-5" /></button>
                    </form>
                </footer>
            </aside>
            
            <div className={`absolute bottom-0 left-0 right-0 p-4 z-30 transition-all duration-300 ${controlsVisible || !isMobile ? 'animate-controls-fade-in' : 'animate-controls-fade-out pointer-events-none'}`}>
                <div className="max-w-md mx-auto bg-black/50 backdrop-blur-md p-3 rounded-full flex items-center justify-center gap-4">
                    <button onClick={toggleMute} disabled={!isMicAvailable} className={`p-4 rounded-full transition-colors ${!isMicAvailable ? 'bg-red-600/50' : isMuted ? 'bg-rose-600' : 'bg-slate-700'}`}><Icon name={!isMicAvailable || isMuted ? 'microphone-slash' : 'mic'} className="w-6 h-6" /></button>
                    <button onClick={toggleCamera} disabled={!isCamAvailable} className={`p-4 rounded-full transition-colors ${!isCamAvailable ? 'bg-red-600/50' : isCameraOff ? 'bg-rose-600' : 'bg-slate-700'}`}><Icon name={!isCamAvailable || isCameraOff ? 'video-camera-slash' : 'video-camera'} className="w-6 h-6" /></button>
                    {isMobile && <button onClick={() => setIsChatOpen(true)} className="p-4 rounded-full bg-slate-700"><Icon name="message" className="w-6 h-6"/></button>}
                    <button onClick={handleLeaveOrEnd} className="p-4 rounded-full bg-red-600"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" transform="rotate(-135 12 12)"/></svg></button>
                </div>
            </div>
        </div>
    );
};

export default LiveVideoRoomScreen;
