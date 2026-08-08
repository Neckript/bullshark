const getAudioDuration = async (file: File): Promise<number> => {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new AudioContext();

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    return audioBuffer.duration;
  } finally {
    audioContext.close();
  }
};

export { getAudioDuration };
