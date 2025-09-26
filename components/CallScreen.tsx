import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, Call } from '../types';
import { firebaseService } from '../services/firebaseService';
import Icon from './Icon';
import { AGORA_APP_ID, BANUBA_CLIENT_TOKEN } from '../constants';
import AgoraRTC from 'agora-rtc-sdk-ng';
import type { IAgoraRTCClient, IAgoraRTCRemoteUser, IMicrophoneAudioTrack, ICameraVideoTrack, ICustomVideoTrack } from 'agora-rtc-sdk-ng';
import { geminiService } from '../services/geminiService';

// Banuba SDK is loaded from script tags, so we declare it on the window object
declare const BanubaSDK: any;
declare const Dom: any;

interface CallScreenProps {
  currentUser: User;
  peerUser: User;
  callId: string;
  isCaller: boolean;
  onGoBack: () => void;
  onSetTtsMessage: (message: string) => void;
}

function stringToIntegerHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

const CallScreen: React.FC<CallScreenProps> = ({ currentUser, peerUser, callId, isCaller, onGoBack, onSetTtsMessage }) => {
    const [call, setCall] = useState<Call | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [isMicAvailable, setIsMicAvailable] = useState(true);
    const [isCamAvailable, setIsCamAvailable] = useState(true);
    const [callDuration, setCallDuration] = useState(0);
    
    // Banuba Filter State
    const [isFilterOn, setIsFilterOn] = useState(true);
    const [filterIntensity, setFilterIntensity] = useState(0.5);
    const banubaPlayer = useRef<any>(null);
    const banubaEffect = useRef<any>(null);


    const agoraClient = useRef<IAgoraRTCClient | null>(null);
    const localAudioTrack = useRef<IMicrophoneAudioTrack | null>(null);
    const localVideoTrack = useRef<ICameraVideoTrack | ICustomVideoTrack | null>(null); // Can be original or custom
    const [remoteUser, setRemoteUser] = useState<IAgoraRTCRemoteUser | null>(null);
    
    const localVideoRef = useRef<HTMLDivElement>(null);
    const remoteVideoRef = useRef<HTMLDivElement>(null);
    const timerIntervalRef = useRef<number | null>(null);
    const callStatusRef = useRef<Call['status'] | null>(null);

    // Call state listener
    useEffect(() => {
        let isMounted = true;
        const unsubscribe = firebaseService.listenToCall(callId, (liveCall) => {
            if (!isMounted) return;
            setCall(liveCall);
            callStatusRef.current = liveCall?.status || null;
            if (!liveCall || ['ended', 'declined', 'missed'].includes(liveCall.status)) {
                setTimeout(() => { if (isMounted) onGoBack(); }, 1500); 
            }
        });
        return () => { isMounted = false; unsubscribe(); };
    }, [callId, onGoBack]);

    // Timer effect
    useEffect(() => {
        if (call?.status === 'active' && !timerIntervalRef.current) {
            timerIntervalRef.current = window.setInterval(() => setCallDuration(d => d + 1), 1000);
        } else if (call?.status !== 'active' && timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }
        return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
    }, [call?.status]);
    
    const handleHangUp = useCallback(() => {
        if (callStatusRef.current === 'ringing' && !isCaller) {
             firebaseService.updateCallStatus(callId, 'declined');
        } else {
             firebaseService.updateCallStatus(callId, 'ended');
        }
    }, [callId, isCaller]);

    // Banuba Effect Intensity
    useEffect(() => {
        if (banubaEffect.current) {
            banubaEffect.current.evalJs(`Beautification.set('SkinSmoothing', ${filterIntensity})`);
        }
    }, [filterIntensity]);

    // Agora Lifecycle
    useEffect(() => {
        const setupAgora = async (callType: 'audio' | 'video') => {
            const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
            agoraClient.current = client;

            client.on('user-published', async (user, mediaType) => {
                await client.subscribe(user, mediaType);
                setRemoteUser(user);
                if (mediaType === 'audio') user.audioTrack?.play();
                if (mediaType === 'video' && remoteVideoRef.current) user.videoTrack?.play(remoteVideoRef.current);
            });
            client.on('user-left', () => setRemoteUser(null));
            
            const uid = stringToIntegerHash(currentUser.id);
            const token = await geminiService.getAgoraToken(callId, uid);
            if (!token) throw new Error("Failed to retrieve Agora token.");
            await client.join(AGORA_APP_ID, callId, token, uid);

            try {
                const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
                localAudioTrack.current = audioTrack;
                await client.publish(audioTrack);
                setIsMicAvailable(true);
            } catch (e) { console.warn("Could not get mic", e); setIsMicAvailable(false); setIsMuted(true); }

            if (callType === 'video') {
                const useBanuba = BANUBA_CLIENT_TOKEN && isFilterOn;

                try {
                    if (useBanuba) {
                        console.log("Banuba Token found, initializing beauty filter.");
                        const originalVideoTrack = await AgoraRTC.createCameraVideoTrack();
                        
                        const player = await BanubaSDK.createPlayer({ clientToken: BANUBA_CLIENT_TOKEN });
                        banubaPlayer.current = player;

                        const effect = await player.applyEffect('effects/Beautification', 'face_ar');
                        banubaEffect.current = effect;

                        await player.use(originalVideoTrack);
                        player.play();

                        await new Promise(resolve => setTimeout(resolve, 500)); 

                        const banubaCanvas = Dom.getOutputElement(player);
                        if (localVideoRef.current) {
                            localVideoRef.current.innerHTML = '';
                            banubaCanvas.style.width = '100%';
                            banubaCanvas.style.height = '100%';
                            banubaCanvas.style.objectFit = 'cover';
                            localVideoRef.current.appendChild(banubaCanvas);
                        }

                        const mediaStream = banubaCanvas.captureStream(30);
                        const videoStreamTrack = mediaStream.getVideoTracks()[0];
                        
                        const customTrack = AgoraRTC.createCustomVideoTrack({ mediaStreamTrack: videoStreamTrack });
                        localVideoTrack.current = customTrack;
                        await client.publish(customTrack);

                    } else {
                        console.log("Banuba Token NOT found, using standard video call.");
                        const videoTrack = await AgoraRTC.createCameraVideoTrack();
                        localVideoTrack.current = videoTrack;
                        await client.publish(videoTrack);
                        if (localVideoRef.current) {
                            videoTrack.play(localVideoRef.current, { fit: 'cover' });
                        }
                    }
                    setIsCamAvailable(true);
                } catch (e) {
                    console.error("Video setup failed (either Banuba or standard):", e);
                    setIsCamAvailable(false);
                    setIsCameraOff(true);
                }
            }
        };

        if (call?.type) {
             setupAgora(call.type).catch(error => {
                console.error("Agora setup failed:", error);
                handleHangUp();
             });
        }

        return () => {
            localAudioTrack.current?.close();
            localVideoTrack.current?.close();
            banubaPlayer.current?.dispose();
            agoraClient.current?.leave();
        };
    }, [call?.type, callId, currentUser.id, handleHangUp, isFilterOn]);

    const toggleMute = () => {
        if (!isMicAvailable) return;
        const muted = !isMuted;
        localAudioTrack.current?.setMuted(muted);
        setIsMuted(muted);
    };

    const toggleCamera = async () => {
        if (!isCamAvailable || !localVideoTrack.current) return;
        const cameraOff = !isCameraOff;
        await localVideoTrack.current.setEnabled(!cameraOff);
        setIsCameraOff(cameraOff);
    };
    
    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    };

    const getStatusText = () => {
        switch (call?.status) {
            case 'ringing': return 'Ringing...';
            case 'active': return formatDuration(callDuration);
            case 'ended': return 'Call Ended';
            default: return 'Connecting...';
        }
    };
    
    if (!call) return <div className="fixed inset-0 bg-black z-[90] flex items-center justify-center text-white">Connecting...</div>

    const isVideoCall = call.type === 'video';

    return (
        <div className="fixed inset-0 bg-slate-900 z-[90] flex flex-col items-center justify-center text-white">
            {/* Remote Video (Fullscreen Background) */}
            <div ref={remoteVideoRef} className="absolute inset-0 w-full h-full">
                {(!remoteUser?.hasVideo || peerUser.isDeactivated) && (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-black">
                        <img src={peerUser.avatarUrl} className="w-48 h-48 object-cover rounded-full opacity-50"/>
                        <p className="mt-4 text-xl">{peerUser.name}</p>
                    </div>
                )}
            </div>
            
            <div className="absolute inset-0 bg-black/30"></div>
            
            {/* Local Video Preview */}
            {isVideoCall && (
                <div 
                    ref={localVideoRef} 
                    className={`absolute top-4 right-4 w-32 h-48 bg-black rounded-lg overflow-hidden border-2 border-slate-600 transform scale-x-[-1] transition-opacity ${isCameraOff ? 'opacity-0' : 'opacity-100'}`} 
                />
            )}

            <div className="relative z-10 flex flex-col items-center justify-between h-full w-full p-6">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-shadow-lg">{peerUser.name}</h1>
                    <p className="text-slate-300 mt-2 text-lg text-shadow-lg">{getStatusText()}</p>
                </div>

                <div className="flex flex-col items-center gap-6">
                    {isFilterOn && isVideoCall && BANUBA_CLIENT_TOKEN && (
                        <div className="bg-black/40 backdrop-blur-sm p-3 rounded-full w-64 flex items-center gap-3">
                            <span className="text-sm font-semibold">Smooth</span>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={filterIntensity}
                                onChange={e => setFilterIntensity(parseFloat(e.target.value))}
                                className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-fuchsia-500"
                            />
                        </div>
                    )}
                    <div className="flex items-center justify-center gap-4">
                        <button onClick={toggleMute} disabled={!isMicAvailable} className={`p-4 rounded-full transition-colors ${!isMicAvailable ? 'bg-red-600/50' : isMuted ? 'bg-rose-600' : 'bg-slate-700/80'}`}><Icon name={!isMicAvailable || isMuted ? 'microphone-slash' : 'mic'} className="w-6 h-6" /></button>
                        {isVideoCall && <button onClick={toggleCamera} disabled={!isCamAvailable} className={`p-4 rounded-full transition-colors ${!isCamAvailable ? 'bg-red-600/50' : isCameraOff ? 'bg-rose-600' : 'bg-slate-700/80'}`}><Icon name={!isCamAvailable || isCameraOff ? 'video-camera-slash' : 'video-camera'} className="w-6 h-6" /></button>}
                        {isVideoCall && BANUBA_CLIENT_TOKEN && <button onClick={() => setIsFilterOn(p => !p)} className={`p-4 rounded-full transition-colors ${isFilterOn ? 'bg-fuchsia-600' : 'bg-slate-700/80'}`}><Icon name="swatch" className="w-6 h-6"/></button>}
                        <button onClick={handleHangUp} className="p-4 rounded-full bg-red-600"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" transform="rotate(-135 12 12)"/></svg></button>
                    </div>
                </div>
            </div>
        </div>
    );
};
export default CallScreen;