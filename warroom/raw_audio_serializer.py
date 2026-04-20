"""
Raw PCM serializer for Pipecat 0.0.108.

Converts raw 16-bit PCM bytes (from browser) → InputAudioRawFrame
and AudioRawFrame → raw bytes (back to browser).
"""
from pipecat.frames.frames import AudioRawFrame, Frame, InputAudioRawFrame
from pipecat.serializers.base_serializer import FrameSerializer


class RawAudioSerializer(FrameSerializer):
    def __init__(self, sample_rate: int = 16000, num_channels: int = 1):
        super().__init__()
        self._sample_rate = sample_rate
        self._num_channels = num_channels

    async def serialize(self, frame: Frame) -> bytes | None:
        if isinstance(frame, AudioRawFrame):
            return frame.audio
        return None

    async def deserialize(self, data: str | bytes) -> Frame | None:
        if not isinstance(data, bytes) or len(data) == 0:
            return None
        return InputAudioRawFrame(
            audio=data,
            sample_rate=self._sample_rate,
            num_channels=self._num_channels,
        )
