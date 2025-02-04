import { useEffect, useRef, useState } from 'react';
import { db } from '../lib/firebase';
import { doc, setDoc, onSnapshot, updateDoc, deleteField, arrayUnion } from 'firebase/firestore';

export default function VideoCall({ callId, localUser, remoteUser, onEndCall }) {
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [isCallEnded, setIsCallEnded] = useState(false);
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const peerConnection = useRef(null);
    const unsubscribeRef = useRef(null);

    useEffect(() => {
        startCall();
        return () => {
            cleanup();
        };
    }, []);

    const cleanup = () => {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            setLocalStream(null);
        }
        if (peerConnection.current) {
            peerConnection.current.close();
            peerConnection.current = null;
        }
        if (unsubscribeRef.current) {
            unsubscribeRef.current();
            unsubscribeRef.current = null;
        }
    };

    const startCall = async () => {
        try {
            // Get local stream
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: true, 
                audio: true 
            });
            setLocalStream(stream);
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }

            // Create RTCPeerConnection
            const configuration = {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                ]
            };
            const pc = new RTCPeerConnection(configuration);
            peerConnection.current = pc;

            // Add local stream to peer connection
            stream.getTracks().forEach(track => {
                pc.addTrack(track, stream);
            });

            // Handle remote stream
            pc.ontrack = (event) => {
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = event.streams[0];
                    setRemoteStream(event.streams[0]);
                }
            };

            // Handle ICE candidates
            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    const callDoc = doc(db, 'calls', callId);
                    updateDoc(callDoc, {
                        [`candidates.${localUser.uid}`]: arrayUnion(event.candidate.toJSON())
                    });
                }
            };

            // Create and set local description
            const offerDescription = await pc.createOffer();
            await pc.setLocalDescription(offerDescription);

            // Store the offer in Firestore
            const callDoc = doc(db, 'calls', callId);
            await setDoc(callDoc, {
                offer: {
                    sdp: offerDescription.sdp,
                    type: offerDescription.type
                },
                createdBy: localUser.uid,
                createdAt: new Date(),
                participants: [localUser.uid, remoteUser.uid],
                status: 'pending'
            });

            // Listen for remote answer and candidates
            const unsubscribe = onSnapshot(callDoc, async (snapshot) => {
                const data = snapshot.data();
                if (!data) return;

                // Handle answer if we're the caller
                if (data.answer && !peerConnection.current.currentRemoteDescription && data.createdBy === localUser.uid) {
                    try {
                        const answerDescription = new RTCSessionDescription(data.answer);
                        await peerConnection.current.setRemoteDescription(answerDescription);
                    } catch (e) {
                        console.error("Error setting remote description:", e);
                    }
                }

                // Handle offer if we're the callee
                if (data.offer && !peerConnection.current.currentRemoteDescription && data.createdBy !== localUser.uid) {
                    try {
                        const offerDescription = new RTCSessionDescription(data.offer);
                        await peerConnection.current.setRemoteDescription(offerDescription);
                        const answerDescription = await peerConnection.current.createAnswer();
                        await peerConnection.current.setLocalDescription(answerDescription);

                        await updateDoc(callDoc, {
                            answer: {
                                sdp: answerDescription.sdp,
                                type: answerDescription.type
                            }
                        });
                    } catch (e) {
                        console.error("Error handling offer:", e);
                    }
                }

                // Handle ICE candidates
                if (data.candidates && data.candidates[remoteUser.uid]) {
                    try {
                        const candidates = data.candidates[remoteUser.uid];
                        for (let i = 0; i < candidates.length; i++) {
                            const candidate = candidates[i];
                            if (candidate && !peerConnection.current._processedCandidates?.includes(JSON.stringify(candidate))) {
                                await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
                                peerConnection.current._processedCandidates = [
                                    ...(peerConnection.current._processedCandidates || []),
                                    JSON.stringify(candidate)
                                ];
                            }
                        }
                    } catch (e) {
                        console.error("Error adding ice candidate:", e);
                    }
                }

                // Handle call end
                if (data.status === 'ended' && !isCallEnded) {
                    setIsCallEnded(true);
                    endCall();
                }
            });

            unsubscribeRef.current = unsubscribe;
        } catch (err) {
            console.error("Error starting call:", err);
            cleanup();
            onEndCall();
        }
    };

    const endCall = async () => {
        try {
            const callDoc = doc(db, 'calls', callId);
            await updateDoc(callDoc, {
                status: 'ended',
                endedAt: new Date(),
                offer: deleteField(),
                answer: deleteField(),
                candidates: deleteField()
            });
        } catch (err) {
            console.error("Error ending call:", err);
        } finally {
            cleanup();
            onEndCall();
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center">
            <div className="bg-gray-900 p-4 rounded-lg shadow-xl max-w-4xl w-full">
                <div className="relative">
                    {/* Remote Video (Large) */}
                    <div className="w-full aspect-video bg-gray-800 rounded-lg overflow-hidden">
                        <video
                            ref={remoteVideoRef}
                            autoPlay
                            playsInline
                            className="w-full h-full object-cover"
                        />
                    </div>

                    {/* Local Video (Small) */}
                    <div className="absolute bottom-4 right-4 w-48 aspect-video bg-gray-800 rounded-lg overflow-hidden shadow-lg">
                        <video
                            ref={localVideoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover"
                        />
                    </div>
                </div>

                {/* Controls */}
                <div className="mt-4 flex justify-center space-x-4">
                    <button
                        onClick={endCall}
                        className="bg-red-600 text-white px-6 py-2 rounded-full hover:bg-red-700 transition-colors"
                    >
                        End Call
                    </button>
                </div>
            </div>
        </div>
    );
}
