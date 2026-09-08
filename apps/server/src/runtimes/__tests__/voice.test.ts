import { StreamKind } from '@bullshark/shared';
import { afterEach, describe, expect, test } from 'bun:test';
import type { Producer } from 'mediasoup/types';
import { VoiceRuntime } from '../voice';

const TEST_CHANNEL_ID = 990001;
const TEST_USER_ID = 1;

/**
 * Minimal stand-in for a mediasoup Producer. The producer registry only ever
 * reads `kind` (to reject quality layers on non-video producers), subscribes
 * to the observer's `close` event and calls `close()`, so a real producer -
 * which would need a connected WebRTC transport - is not required here.
 */
const createFakeProducer = (
  overrides: {
    kind?: 'audio' | 'video';
    type?: Producer['type'];
    rtpParameters?: Producer['rtpParameters'];
  } = {}
) => {
  let closeHandler: (() => void) | undefined;
  let closed = false;

  const producer = {
    kind: overrides.kind ?? ('audio' as const),
    type: overrides.type,
    rtpParameters: overrides.rtpParameters ?? { encodings: [] },
    get closed() {
      return closed;
    },
    observer: {
      on: (event: string, handler: () => void) => {
        if (event === 'close') {
          closeHandler = handler;
        }
      }
    },
    close: () => {
      closed = true;
      closeHandler?.();
    },
    // Lets a test simulate mediasoup closing the producer on its own (e.g.
    // when the producer transport goes away) without going through
    // removeProducer.
    emitObserverClose: () => {
      closed = true;
      closeHandler?.();
    }
  };

  return producer;
};

const asProducer = (fake: ReturnType<typeof createFakeProducer>) =>
  fake as unknown as Producer;

let runtime: VoiceRuntime | undefined;

afterEach(async () => {
  await runtime?.destroy();
  runtime = undefined;
});

describe('VoiceRuntime soundboard producers', () => {
  test('registers a soundboard producer and hands it back via getProducer', () => {
    runtime = new VoiceRuntime(TEST_CHANNEL_ID);

    const fake = createFakeProducer();

    runtime.addProducer(TEST_USER_ID, StreamKind.SOUNDBOARD, asProducer(fake));

    expect(runtime.getProducer(StreamKind.SOUNDBOARD, TEST_USER_ID)).toBe(
      asProducer(fake)
    );
  });

  test('removeProducer closes the soundboard producer and drops the entry', () => {
    runtime = new VoiceRuntime(TEST_CHANNEL_ID);

    const fake = createFakeProducer();

    runtime.addProducer(TEST_USER_ID, StreamKind.SOUNDBOARD, asProducer(fake));
    runtime.removeProducer(TEST_USER_ID, StreamKind.SOUNDBOARD);

    expect(fake.closed).toBe(true);
    expect(
      runtime.getProducer(StreamKind.SOUNDBOARD, TEST_USER_ID)
    ).toBeUndefined();
  });

  test('a soundboard producer closing on its own clears the registry entry', () => {
    runtime = new VoiceRuntime(TEST_CHANNEL_ID);

    const fake = createFakeProducer();

    runtime.addProducer(TEST_USER_ID, StreamKind.SOUNDBOARD, asProducer(fake));

    fake.emitObserverClose();

    expect(
      runtime.getProducer(StreamKind.SOUNDBOARD, TEST_USER_ID)
    ).toBeUndefined();
  });

  test('leaving the channel removes a still-playing soundboard producer', () => {
    runtime = new VoiceRuntime(TEST_CHANNEL_ID);

    runtime.addUser(TEST_USER_ID, { micMuted: false, soundMuted: false });
    runtime.addProducer(
      TEST_USER_ID,
      StreamKind.SOUNDBOARD,
      asProducer(createFakeProducer())
    );

    runtime.removeUser(TEST_USER_ID);

    expect(
      runtime.getProducer(StreamKind.SOUNDBOARD, TEST_USER_ID)
    ).toBeUndefined();
  });
});

describe('VoiceRuntime SVC screen share quality layers', () => {
  test('accepts quality layers for an svc producer matching its scalabilityMode spatial layer count', () => {
    runtime = new VoiceRuntime(TEST_CHANNEL_ID);

    const fake = createFakeProducer({
      kind: 'video',
      type: 'svc',
      rtpParameters: {
        codecs: [],
        encodings: [{ scalabilityMode: 'L3T3_KEY' }]
      }
    });

    runtime.addProducer(TEST_USER_ID, StreamKind.SCREEN, asProducer(fake), [
      { spatialLayer: 0, label: '270p' },
      { spatialLayer: 1, label: '540p' },
      { spatialLayer: 2, label: '1080p' }
    ]);

    expect(
      runtime.getProducerQualityLayers(TEST_USER_ID, StreamKind.SCREEN)
    ).toEqual([
      { spatialLayer: 0, label: '270p' },
      { spatialLayer: 1, label: '540p' },
      { spatialLayer: 2, label: '1080p' }
    ]);
  });

  test('rejects a layer count that does not match the scalabilityMode spatial layer count', () => {
    runtime = new VoiceRuntime(TEST_CHANNEL_ID);

    const fake = createFakeProducer({
      kind: 'video',
      type: 'svc',
      rtpParameters: {
        codecs: [],
        encodings: [{ scalabilityMode: 'L3T3_KEY' }]
      }
    });

    expect(() =>
      runtime!.addProducer(TEST_USER_ID, StreamKind.SCREEN, asProducer(fake), [
        { spatialLayer: 0, label: '270p' },
        { spatialLayer: 1, label: '1080p' }
      ])
    ).toThrow('Quality layer count must match simulcast encoding count');
  });
});
