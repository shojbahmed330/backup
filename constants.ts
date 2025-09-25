

import { FriendshipStatus, type User, type Post, type Message, type Comment, type ChatTheme, type AdminUser, type LiveAudioRoom, type LiveVideoRoom, type Campaign, type Group, type Event, type GroupChat, type GroupCategory, type MusicTrack, type Story, type StoryTextStyle } from './types';
import { t, Language } from './i18n';

export const CLOUDINARY_CLOUD_NAME = "deeieh2bd";
export const CLOUDINARY_UPLOAD_PRESET = "Voicebook";
export const IMAGE_GENERATION_COST = 60;
export const SPONSOR_CPM_BDT = 300; // Cost Per 1000 Impressions in BDT
export const REWARD_AD_COIN_VALUE = 5;
// IMPORTANT: Replace with your actual Agora App ID
export const AGORA_APP_ID = '0063ad751cdb46bcbf9feb29f639be75'; 


export const REEL_TEXT_FONTS = [
  { name: 'Sans', class: 'font-sans' },
  { name: 'Serif', class: 'font-serif' },
  { name: 'Mono', class: 'font-mono' },
];

export const getTtsPrompt = (key: string, lang: Language, options?: { [key: string]: string | number }): string => {
    return t(lang, `tts.${key}`, options);
};

export const VOICE_EMOJI_MAP: Record<string, string> = {
    laughing: '😂',
    hashi: '😂',
    heart: '❤️',
    love: '❤️',
    bhalobasha: '❤️',
    like: '👍',
    thumbsup: '👍',
    sad: '😢',
    crying: '😢',
    kanna: '😢',
    cry: '😢',
    angry: '😡',
    raag: '😡',
    fire: '🔥',
    agun: '🔥',
    wow: '😮',
    surprised: '😮',
    smile: '😊',
    happy: '😊',
    inlove: '😍',
};

export const CHAT_THEMES: Record<ChatTheme, { name: string, bgGradient: string; myBubble: string; theirBubble: string; text: string; headerText: string; }> = {
    default: {
        name: 'Default',
        bgGradient: 'from-[#18191a] to-[#242526]',
        myBubble: 'bg-rose-600',
        theirBubble: 'bg-slate-600',
        text: 'text-white',
        headerText: 'text-slate-100',
    },
    sunset: {
        name: 'Sunset',
        bgGradient: 'from-orange-700 via-rose-700 to-indigo-800',
        myBubble: 'bg-indigo-500',
        theirBubble: 'bg-rose-500/80 backdrop-blur-sm',
        text: 'text-white',
        headerText: 'text-white',
    },
    ocean: {
        name: 'Ocean',
        bgGradient: 'from-cyan-800 to-blue-800',
        myBubble: 'bg-teal-600',
        theirBubble: 'bg-sky-700/80 backdrop-blur-sm',
        text: 'text-white',
        headerText: 'text-cyan-100',
    },
    forest: {
        name: 'Forest',
        bgGradient: 'from-emerald-800 to-green-800',
        myBubble: 'bg-lime-700',
        theirBubble: 'bg-emerald-700/80 backdrop-blur-sm',
        text: 'text-white',
        headerText: 'text-green-100',
    },
    classic: {
        name: 'Classic',
        bgGradient: 'from-slate-100 to-gray-200',
        myBubble: 'bg-blue-500',
        theirBubble: 'bg-gray-300',
        text: 'text-black',
        headerText: 'text-gray-800',
    },
    galaxy: {
        name: 'Galaxy',
        bgGradient: 'bg-transparent',
        myBubble: 'bg-fuchsia-500/50 backdrop-blur-sm border border-white/20',
        theirBubble: 'bg-sky-500/50 backdrop-blur-sm border border-white/20',
        text: 'text-white',
        headerText: 'text-fuchsia-300',
    },
    midnight: {
        name: 'Midnight',
        bgGradient: 'from-black via-indigo-900 to-black',
        myBubble: 'bg-purple-600',
        theirBubble: 'bg-slate-700',
        text: 'text-white',
        headerText: 'text-purple-300',
    },
    'rose-gold': {
        name: 'Rose Gold',
        bgGradient: 'from-pink-400 via-rose-400 to-orange-300',
        myBubble: 'bg-white/80 backdrop-blur-sm',
        theirBubble: 'bg-rose-200/80 backdrop-blur-sm',
        text: 'text-rose-900',
        headerText: 'text-white',
    },
    neon: {
        name: 'Neon',
        bgGradient: 'from-gray-900 to-black',
        myBubble: 'bg-transparent border-2 border-cyan-400',
        theirBubble: 'bg-transparent border-2 border-fuchsia-400',
        text: 'text-white',
        headerText: 'text-cyan-300',
    },
    minty: {
        name: 'Minty Fresh',
        bgGradient: 'from-green-200 to-teal-300',
        myBubble: 'bg-white',
        theirBubble: 'bg-teal-100',
        text: 'text-black',
        headerText: 'text-teal-800',
    }
};

export const DEFAULT_AVATARS: string[] = [
    'https://thumbs.dreamstime.com/b/profile-beautiful-smiling-girl-6243612.jpg',
    'https://photosrush.net/wp-content/uploads/instagram-profile-picture-girl-back-side_52.webp',
    'https://photosrush.net/wp-content/uploads/big-instagram-profile-picture_73.webp',
    'https://t4.ftcdn.net/jpg/04/31/64/75/240_F_431647519_usrbQ8Z983hTYe8zgA7t1XVc5fEtqcpa.jpg',
    'https://t4.ftcdn.net/jpg/13/00/33/59/240_F_1300335945_LbeB4stuUIp5pEM8lXJSoafLSmbLcpo5.jpg',
    'https://photosrush.net/wp-content/uploads/ddd5e16d0fa25d3c110b9d95c2530224.jpg',
];

export const DEFAULT_COVER_PHOTOS: string[] = [
    'https://github.com/user-attachments/assets/de890f5c-75c1-4b13-8894-353272d7f87a',
    'https://github.com/user-attachments/assets/a3311f67-a226-4073-82b2-5f8021c5b8f6',
    'https://github.com/user-attachments/assets/7b16a241-118c-4f51-9252-94a5c0b0373b',
    'https://github.com/user-attachments/assets/0593c6f8-0f18-4a11-aa90-b1d55648a04b',
];

export const GROUP_CATEGORIES: GroupCategory[] = [
    'General', 'Food', 'Gaming', 'Music', 'Technology', 'Travel', 'Art & Culture', 'Sports'
];

export const TEXT_STORY_STYLES: StoryTextStyle[] = [
  { name: 'Classic', backgroundColor: 'bg-gradient-to-br from-sky-500 to-indigo-600', fontFamily: 'font-sans', color: 'text-white', textAlign: 'center' },
  { name: 'Elegant', backgroundColor: 'bg-gray-800', fontFamily: 'font-serif', color: 'text-yellow-200', textAlign: 'center' },
  { name: 'Playful', backgroundColor: 'bg-gradient-to-tr from-yellow-400 to-pink-500', fontFamily: 'font-mono', color: 'text-black', textAlign: 'center' },
  { name: 'Formal', backgroundColor: 'bg-slate-200', fontFamily: 'font-sans', color: 'text-slate-800', textAlign: 'left' },
  { name: 'Dramatic', backgroundColor: 'bg-black', fontFamily: 'font-serif', color: 'text-red-500', textAlign: 'center' },
];

export const MOCK_MUSIC_LIBRARY: MusicTrack[] = [
    // Bangla Songs
    ...[
        { title: "Shada Shada Kala Kala", artist: "Arfan Mredha Shiblu" },
        { title: "Nodi", artist: "Topu" },
    ].map((t, i) => ({ ...t, id: `bn${i}`, language: 'bangla' as const, url: 'https://cdn.pixabay.com/audio/2023/10/01/audio_a1a2d3a3c2.mp3' })),
    // Hindi Songs
    ...[
        { title: "Kesariya", artist: "Arijit Singh" },
        { title: "Tum Hi Ho", artist: "Arijit Singh" },
    ].map((t, i) => ({ ...t, id: `hi${i}`, language: 'hindi' as const, url: 'https://cdn.pixabay.com/audio/2024/02/09/audio_40b2a7a4b8.mp3' }))
];

export const MOCK_GALLERY_ITEMS: { id: string; type: 'image' | 'video'; url: string; duration?: number }[] = [
    { id: 'gal1', type: 'image', url: 'https://picsum.photos/id/1015/540/960' },
    { id: 'gal2', type: 'video', url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4', duration: 15 },
    { id: 'gal3', type: 'image', url: 'https://picsum.photos/id/1025/540/960' },
    { id: 'gal4', type: 'image', url: 'https://picsum.photos/id/10/540/960' },
    { id: 'gal5', type: 'image', url: 'https://picsum.photos/id/20/540/960' },
    { id: 'gal6', type: 'image', url: 'https://picsum.photos/id/30/540/960' },
];